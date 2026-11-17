import net from "node:net";
import type { NextRequest } from "next/server";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 5 MB file + multipart framing overhead

/**
 * Resolve the server-side backend origin without exposing Docker hostnames in client bundles.
 */
export function getBackendUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:3000";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid backend URL configuration.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid backend URL protocol.");
  }

  return parsed.origin;
}

/**
 * Extract a validated client IP from Cloudflare/proxy headers for backend rate limiting.
 */
export function extractClientIp(request: NextRequest): string | null {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && net.isIP(cfIp)) {
    return cfIp;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && net.isIP(first)) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && net.isIP(realIp)) {
    return realIp;
  }

  return null;
}

/**
 * Build outbound headers for backend proxy requests, forwarding auth and client IP safely.
 */
export function buildBackendHeaders(
  request: NextRequest,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  const clientIp = extractClientIp(request);
  if (clientIp) {
    headers["X-Forwarded-For"] = clientIp;
  }
  return headers;
}

export class BackendProxyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendProxyError";
    this.status = status;
  }
}

/**
 * Forward a JSON/GET/PUT/POST request to the Express backend with timeout and safe status mapping.
 */
export async function fetchBackend(
  request: NextRequest,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<unknown> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? 15000;
  const headers = buildBackendHeaders(
    request,
    options.body !== undefined ? { "Content-Type": "application/json" } : {}
  );

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    headers,
    body: options.body,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Backend request failed.";
    throw new BackendProxyError(message, response.status);
  }

  return payload;
}

/**
 * Stream/bound a multipart upload before buffering and forwarding to the Express backend.
 */
export async function forwardMultipartToBackend(
  request: NextRequest,
  path: string,
  timeoutMs = 45000
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new BackendProxyError("Multipart form-data request required.", 400);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      throw new BackendProxyError("Invalid Content-Length header.", 400);
    }
    if (declaredLength > MAX_UPLOAD_BYTES) {
      throw new BackendProxyError("File exceeds the 5 MB upload limit.", 413);
    }
  }

  if (!request.body) {
    throw new BackendProxyError("No file uploaded.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new BackendProxyError("File exceeds the 5 MB upload limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = buildBackendHeaders(request, { "Content-Type": contentType });
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to parse file.";
    throw new BackendProxyError(message, response.status);
  }

  return payload;
}

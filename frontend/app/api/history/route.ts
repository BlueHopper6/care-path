import { NextRequest, NextResponse } from "next/server";
import { BackendProxyError, fetchBackend } from "@/lib/backend";

/**
 * GET /api/history
 * Proxies to the Express backend, forwarding the Authorization header.
 */
export async function GET(request: NextRequest) {
  try {
    if (!request.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = encodeURIComponent(searchParams.get("page") ?? "1");
    const limit = encodeURIComponent(searchParams.get("limit") ?? "20");

    const json = await fetchBackend(request, `/api/history?page=${page}&limit=${limit}`);
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to fetch history." },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

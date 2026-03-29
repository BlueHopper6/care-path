import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/parse-file
 * Proxies a multipart file upload to the Express backend for text extraction.
 */
export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Forward the raw multipart body directly — do NOT re-parse it
    const contentType = request.headers.get("content-type") ?? "";
    const body = await request.arrayBuffer();

    const response = await fetch(`${apiUrl}/api/parse-file`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Backend error: ${response.statusText}`);
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("[CarePath parse-file route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}

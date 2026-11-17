import { NextRequest, NextResponse } from "next/server";
import { BackendProxyError, forwardMultipartToBackend } from "@/lib/backend";

/**
 * POST /api/parse-file
 * Proxies a bounded multipart file upload to the Express backend for text extraction.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await forwardMultipartToBackend(request, "/api/parse-file");
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to parse file." },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}

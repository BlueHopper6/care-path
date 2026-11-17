import { NextRequest, NextResponse } from "next/server";
import { BackendProxyError, fetchBackend } from "@/lib/backend";

/**
 * POST /api/analyze/save
 * Proxies the save request to the Express backend.
 */
export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const json = await fetchBackend(request, "/api/analyze/save", {
      method: "POST",
      body: JSON.stringify(data),
    });

    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to save analysis." },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
  }
}

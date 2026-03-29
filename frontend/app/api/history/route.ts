import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/history
 * Proxies to the Express backend, forwarding the Authorization header.
 */
export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? "1";
    const limit = searchParams.get("limit") ?? "20";

    const response = await fetch(
      `${apiUrl}/api/history?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Backend error: ${response.statusText}`);
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("[CarePath history route error]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch history",
      },
      { status: 500 }
    );
  }
}

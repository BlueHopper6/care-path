import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/analyze/save
 * Proxies the save request to the Express backend.
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${apiUrl}/api/analyze/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Backend error: ${response.statusText}`);
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("[CarePath save analysis route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save analysis" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${apiUrl}/api/preferences`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Backend error: ${response.statusText}`);
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("[CarePath get preferences route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${apiUrl}/api/preferences`, {
      method: "PUT",
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
    console.error("[CarePath update preferences route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update preferences" },
      { status: 500 }
    );
  }
}

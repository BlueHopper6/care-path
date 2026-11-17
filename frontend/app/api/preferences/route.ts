import { NextRequest, NextResponse } from "next/server";
import { BackendProxyError, fetchBackend } from "@/lib/backend";

export async function GET(request: NextRequest) {
  try {
    if (!request.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await fetchBackend(request, "/api/preferences");
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to get preferences." },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: "Failed to get preferences" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!request.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const json = await fetchBackend(request, "/api/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to update preferences." },
        { status: err.status }
      );
    }

    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}

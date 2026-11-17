import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export const dynamic = "force-dynamic";

function hasFrontendConfig(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !anonKey) return false;
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  if (!hasFrontendConfig()) {
    return NextResponse.json(
      { status: "degraded", ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "degraded", ready: false },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const backend = (await response.json().catch(() => ({}))) as {
      ready?: boolean;
      revision?: string | null;
    };

    if (backend.ready === false) {
      return NextResponse.json(
        { status: "degraded", ready: false },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        ready: true,
        frontendRevision: process.env.APP_REVISION || null,
        backendRevision: backend.revision ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

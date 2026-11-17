import { NextRequest, NextResponse } from "next/server";
import { BackendProxyError, fetchBackend } from "@/lib/backend";

// Map ISO 639-1 language codes to full language names for the AI prompt
const LANGUAGE_MAP: Record<string, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ar: "Arabic",
  pt: "Portuguese",
};

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Normalize mode: frontend sends "detailed", backend expects "default"
    const normalizedMode = data.mode === "simple" ? "simple" : "default";

    // Normalize language: frontend sends ISO codes ("en"), backend needs full name ("English")
    const normalizedLanguage =
      LANGUAGE_MAP[data.language] ?? data.language ?? "English";

    const json = (await fetchBackend(request, "/api/analyze", {
      method: "POST",
      timeoutMs: 75000,
      body: JSON.stringify({
        raw_text: data.raw_text,
        mode: normalizedMode,
        language: normalizedLanguage,
      }),
    })) as { data?: Record<string, unknown> } & Record<string, unknown>;

    const inner = (json.data ?? json) as Record<string, unknown>;

    const normalized = {
      summary: typeof inner.summary === "string" ? inner.summary : "No summary available.",
      action_plan: Array.isArray(inner.action_plan) ? inner.action_plan : [],
      recurring_tasks: Array.isArray(inner.recurring_tasks) ? inner.recurring_tasks : [],
      questions_for_doctor: Array.isArray(inner.questions_for_doctor)
        ? inner.questions_for_doctor
        : [],
      warning_signs: Array.isArray(inner.warning_signs) ? inner.warning_signs : [],
      confidence_level:
        typeof inner.confidence_level === "string" ? inner.confidence_level : "medium",
      disclaimer: typeof inner.disclaimer === "string" ? inner.disclaimer : undefined,
    };

    return NextResponse.json(normalized);
  } catch (err) {
    if (err instanceof BackendProxyError) {
      return NextResponse.json(
        { error: err.status < 500 ? err.message : "Failed to analyze medical text. Please try again." },
        { status: err.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze medical text. Please try again." },
      { status: 500 }
    );
  }
}

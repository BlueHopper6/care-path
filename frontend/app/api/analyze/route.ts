import { NextRequest, NextResponse } from "next/server";

// Map ISO 639-1 language codes to full language names for the AI prompt
const LANGUAGE_MAP: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  pt: "Portuguese",
};

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Normalize mode: frontend sends "detailed", backend expects "default"
    const normalizedMode = data.mode === "simple" ? "simple" : "default";

    // Normalize language: frontend sends ISO codes ("en"), backend needs full name ("English")
    const normalizedLanguage =
      LANGUAGE_MAP[data.language] ?? data.language ?? "English";

    // Forward the Authorization header so the backend can authenticate
    // and save the analysis to the database for logged-in users
    const authHeader = request.headers.get("authorization");
    const outboundHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      outboundHeaders["Authorization"] = authHeader;
    }

    const response = await fetch(`${apiUrl}/api/analyze`, {
      method: "POST",
      headers: outboundHeaders,
      body: JSON.stringify({
        raw_text: data.raw_text,
        mode: normalizedMode,
        language: normalizedLanguage,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Backend error: ${response.statusText}`);
    }

    // Backend wraps response in { success: true, data: { ... } }
    const json = await response.json();
    const inner = json.data ?? json;

    // Normalize shape — guarantee all fields exist so components never crash
    const normalized = {
      summary: inner.summary ?? "No summary available.",
      action_plan: Array.isArray(inner.action_plan) ? inner.action_plan : [],
      recurring_tasks: Array.isArray(inner.recurring_tasks) ? inner.recurring_tasks : [],
      questions_for_doctor: Array.isArray(inner.questions_for_doctor)
        ? inner.questions_for_doctor
        : [],
      warning_signs: Array.isArray(inner.warning_signs)
        ? inner.warning_signs
        : [],
      confidence_level: inner.confidence_level ?? "medium",
      disclaimer: inner.disclaimer,
    };

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("[CarePath API route error]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to analyze medical text",
      },
      { status: 500 }
    );
  }
}

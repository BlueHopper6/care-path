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
    const normalizedLanguage = LANGUAGE_MAP[data.language] ?? data.language ?? "English";

    const response = await fetch(`${apiUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    // Return the inner data object directly so it matches AnalyzeResponse shape
    return NextResponse.json(json.data ?? json);
  } catch (err) {
    console.error("[CarePath API route error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze medical text" },
      { status: 500 }
    );
  }
}

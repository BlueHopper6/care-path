export interface AnalyzeRequest {
  raw_text: string;
  mode: "simple" | "detailed";
  language: string;
}

export interface AnalyzeResponse {
  summary: string;
  action_plan: string[];
  questions_for_doctor: string[];
  warning_signs: string[];
  confidence_level?: string;
  disclaimer?: string;
}

export interface AnalysisHistoryItem {
  id: string;
  raw_text: string;
  mode: "simple" | "detailed";
  language: string;
  result: AnalyzeResponse;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

/**
 * Send medical text for analysis.
 * Always routes through the Next.js API route (/api/analyze) which proxies
 * to the Express backend and normalises the response.
 *
 * @param data        The analysis request payload
 * @param accessToken Optional Supabase access token — when provided, the
 *                    backend will persist the result to the database.
 */
export async function analyzeText(
  data: AnalyzeRequest,
  accessToken?: string
): Promise<AnalyzeResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Backend history (authenticated users)
// ---------------------------------------------------------------------------

export interface BackendHistoryItem {
  id: string;
  summary: string;
  action_plan: string[];
  questions: string[];
  warnings: string[];
  confidence_level: string;
  language: string;
  mode: string;
  created_at: string;
  documents: { id: string; raw_text: string; created_at: string } | null;
}

export async function fetchRemoteHistory(
  accessToken: string
): Promise<BackendHistoryItem[]> {
  const response = await fetch("/api/history", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch history from server");
  }

  const json = await response.json();
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Local storage history (guest users)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "carepath_history";

export function saveToHistory(
  request: AnalyzeRequest,
  result: AnalyzeResponse
): AnalysisHistoryItem {
  const historyItem: AnalysisHistoryItem = {
    id: crypto.randomUUID(),
    ...request,
    result,
    created_at: new Date().toISOString(),
  };

  const existing = getHistory();
  const updated = [historyItem, ...existing].slice(0, 50);

  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  return historyItem;
}

export function getHistory(): AnalysisHistoryItem[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getHistoryItem(id: string): AnalysisHistoryItem | undefined {
  return getHistory().find((item) => item.id === id);
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(HISTORY_KEY);
  }
}

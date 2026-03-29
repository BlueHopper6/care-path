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
}

export interface AnalysisHistoryItem {
  id: string;
  raw_text: string;
  mode: "simple" | "detailed";
  language: string;
  result: AnalyzeResponse;
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function analyzeText(data: AnalyzeRequest): Promise<AnalyzeResponse> {
  // Always call the Next.js API route (relative URL) which proxies to the
  // Express backend and normalizes the response shape.
  const response = await fetch(`/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

// Local storage key for history (temporary until backend history endpoint is available)
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
  const updated = [historyItem, ...existing].slice(0, 50); // Keep last 50 items
  
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  return historyItem;
}

export function getHistory(): AnalysisHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) {
    return [];
  }

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

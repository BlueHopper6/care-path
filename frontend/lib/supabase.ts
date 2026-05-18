import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    "⚠️ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Build-safe singleton — during static generation (SSG/prerender) the env
// vars may be absent. We defer client creation to avoid crashing the build.
// At runtime in the browser these values are always embedded by Next.js.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a stub that won't crash during prerender but will fail
    // gracefully at runtime if env vars are truly missing.
    _client = createClient("https://placeholder.supabase.co", "placeholder");
  } else {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }

  return _client;
}

// Singleton browser client — safe to import anywhere in client components.
// Uses localStorage for session persistence by default.
export const supabase = getClient();

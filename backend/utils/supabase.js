const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Environment variables — standardized on Supabase's official naming
// with backward-compatible fallbacks for legacy .env configurations.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_KEY; // legacy fallback
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY; // legacy fallback

const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn(
    '⚠️  Missing SUPABASE_URL or SUPABASE_ANON_KEY – Supabase features will not work.'
  );
}

if (isConfigured && !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  Missing SUPABASE_SERVICE_ROLE_KEY – Admin operations will fall back to the anon key (reduced privileges).'
  );
}

/**
 * Admin client – uses the service-role key to bypass RLS.
 * Returns null if Supabase is not configured.
 */
const supabaseAdmin = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Creates a Supabase client scoped to a specific user's JWT.
 * This respects Row Level Security policies.
 * Returns null if Supabase is not configured.
 *
 * @param {string} accessToken - The user's Supabase JWT
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
function createUserClient(accessToken) {
  if (!isConfigured) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false },
  });
}

module.exports = { supabaseAdmin, createUserClient, isConfigured };

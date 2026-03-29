const { createClient } = require('@supabase/supabase-js');

/**
 * Optional authentication middleware.
 * If a Bearer token is present, verify it and attach req.user + req.accessToken.
 * If no token is present (guest request), silently continue.
 * Never blocks the request — always calls next().
 */
async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token — continue as guest
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (!error && user) {
      req.user = { id: user.id, email: user.email };
      req.accessToken = token;
    }
    // Even if token is invalid, continue as guest
  } catch {
    // Silently ignore auth errors
  }

  next();
}

module.exports = optionalAuth;

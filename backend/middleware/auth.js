const { createClient } = require('@supabase/supabase-js');

/**
 * Authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it against Supabase, and attaches req.user.
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing access token' });
    }

    // Create a Supabase client with the user's token to verify it
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: { persistSession: false },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info and token to the request
    req.user = {
      id: user.id,
      email: user.email,
    };
    req.accessToken = token;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

module.exports = authMiddleware;

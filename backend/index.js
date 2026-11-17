if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const logger = require('./utils/logger');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const apiRoutes = require('./routes/api');
const { hasValidSupabaseConfig } = require('./utils/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Evaluate runtime configuration readiness without invoking Gemini or leaking secrets.
 * @returns {boolean} True when required runtime settings are present and valid.
 */
function isServiceReady() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasSupabase = hasValidSupabaseConfig();
  const hasFrontendOrigin =
    process.env.NODE_ENV !== 'production' || Boolean(process.env.FRONTEND_URL);
  return hasGemini && hasSupabase && hasFrontendOrigin;
}

// ---------------------------------------------------------------------------
// Trust Proxy — trust immediate proxy hop (Next.js server proxy / Cloudflare)
// ---------------------------------------------------------------------------

app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security Headers (Helmet)
// ---------------------------------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow cross-origin requests from frontend
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

// ---------------------------------------------------------------------------
// CORS — strictly tied to configured frontend origin
// ---------------------------------------------------------------------------

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ---------------------------------------------------------------------------
// Body Parsing
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

// General API limiter — generous for metadata/read endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(generalLimiter);

// Compute-heavy limiter — aggressive for AI analysis & file parsing
const computeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for analysis requests. Please wait before trying again.' },
});

// Export compute limiter so routes can apply it selectively
app.locals.computeLimiter = computeLimiter;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check — checks required runtime configuration without invoking Gemini
app.get('/api/health', (_req, res) => {
  const ready = isServiceReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    ready,
    revision: process.env.APP_REVISION || null,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the 5 MB upload limit.'
        : 'Invalid file upload request.';
    return res.status(status).json({ error: message });
  }

  if (err && err.statusCode === 400) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }

  // Log the error type only — never log full request body or stack traces
  logger.error('Unhandled error:', {
    name: err?.name || 'Error',
  });

  res.status(500).json({
    error: 'Internal server error',
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`CarePath API listening on port ${PORT}`);
  });
  server.requestTimeout = 90000;
  server.headersTimeout = 60000;
  server.keepAliveTimeout = 65000;

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { app, isServiceReady };

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { safetyMiddleware } = require('../middleware/safety');
const {
  validate,
  analyzeSchema,
  saveAnalysisSchema,
  preferencesSchema,
  uploadSchema,
} = require('../middleware/validation');
const { analyzeText, saveAnalyzedText } = require('../controllers/analyze');
const { uploadDocument, getHistory } = require('../controllers/documents');
const { upload, parseFile } = require('../controllers/fileParser');
const { getPreferences, updatePreferences } = require('../controllers/preferences');

// ---------------------------------------------------------------------------
// Compute-heavy rate limiter (applied per-route, not globally)
// Accessed via app.locals set in index.js
// ---------------------------------------------------------------------------

function applyComputeLimiter(req, res, next) {
  const limiter = req.app.locals.computeLimiter;
  if (limiter) return limiter(req, res, next);
  next();
}

// ---------------------------------------------------------------------------
// File parsing — public, no auth needed
// Rate-limited aggressively due to CPU-heavy PDF parsing
// ---------------------------------------------------------------------------

router.post('/parse-file', applyComputeLimiter, upload.single('file'), parseFile);

// ---------------------------------------------------------------------------
// Analyze — just returns analysis, doesn't auto-save
// Rate-limited aggressively due to AI API cost
// ---------------------------------------------------------------------------

router.post(
  '/analyze',
  applyComputeLimiter,
  optionalAuth,
  validate(analyzeSchema),
  safetyMiddleware,
  analyzeText
);

// ---------------------------------------------------------------------------
// Protected routes
// ---------------------------------------------------------------------------

router.post('/upload', authMiddleware, validate(uploadSchema), uploadDocument);
router.get('/history', authMiddleware, getHistory);
router.post(
  '/analyze/save',
  authMiddleware,
  validate(saveAnalysisSchema),
  saveAnalyzedText
);
router.get('/preferences', authMiddleware, getPreferences);
router.put(
  '/preferences',
  authMiddleware,
  validate(preferencesSchema),
  updatePreferences
);

module.exports = router;

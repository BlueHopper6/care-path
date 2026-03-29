const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const { safetyMiddleware } = require('../middleware/safety');
const { analyzeText } = require('../controllers/analyze');
const { uploadDocument, getHistory } = require('../controllers/documents');

// ---------------------------------------------------------------------------
// Public routes (no auth required — useful for quick testing / demo)
// ---------------------------------------------------------------------------

// Analyze medical text (public — results are not persisted)
router.post('/analyze', safetyMiddleware, analyzeText);

// ---------------------------------------------------------------------------
// Protected routes (require Supabase auth)
// ---------------------------------------------------------------------------

// Analyze medical text (authenticated — results are persisted)
router.post('/analyze/save', authMiddleware, safetyMiddleware, analyzeText);

// Upload raw medical text document
router.post('/upload', authMiddleware, uploadDocument);

// Retrieve past analyses
router.get('/history', authMiddleware, getHistory);

module.exports = router;

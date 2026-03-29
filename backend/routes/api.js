const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { safetyMiddleware } = require('../middleware/safety');
const { analyzeText } = require('../controllers/analyze');
const { uploadDocument, getHistory } = require('../controllers/documents');

// ---------------------------------------------------------------------------
// Public analyze route — optionalAuth identifies logged-in users so their
// analyses get saved to the DB. Guests still get full analysis, just no persistence.
// ---------------------------------------------------------------------------

router.post('/analyze', optionalAuth, safetyMiddleware, analyzeText);

// ---------------------------------------------------------------------------
// Protected routes (require Supabase auth)
// ---------------------------------------------------------------------------

// Upload raw medical text document
router.post('/upload', authMiddleware, uploadDocument);

// Retrieve past analyses
router.get('/history', authMiddleware, getHistory);

module.exports = router;

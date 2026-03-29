const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { safetyMiddleware } = require('../middleware/safety');
const { analyzeText, saveAnalyzedText } = require('../controllers/analyze');
const { uploadDocument, getHistory } = require('../controllers/documents');
const { upload, parseFile } = require('../controllers/fileParser');
const { getPreferences, updatePreferences } = require('../controllers/preferences');

// ---------------------------------------------------------------------------
// File parsing — public, no auth needed
// ---------------------------------------------------------------------------

router.post('/parse-file', upload.single('file'), parseFile);

// ---------------------------------------------------------------------------
// Analyze — just returns analysis, doesn't auto-save
// ---------------------------------------------------------------------------

router.post('/analyze', optionalAuth, safetyMiddleware, analyzeText);

// ---------------------------------------------------------------------------
// Protected routes
// ---------------------------------------------------------------------------

router.post('/upload', authMiddleware, uploadDocument);
router.get('/history', authMiddleware, getHistory);
router.post('/analyze/save', authMiddleware, saveAnalyzedText);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, updatePreferences);

module.exports = router;

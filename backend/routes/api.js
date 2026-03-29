const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { safetyMiddleware } = require('../middleware/safety');
const { analyzeText } = require('../controllers/analyze');
const { uploadDocument, getHistory } = require('../controllers/documents');
const { upload, parseFile } = require('../controllers/fileParser');

// ---------------------------------------------------------------------------
// File parsing — public, no auth needed
// ---------------------------------------------------------------------------

router.post('/parse-file', upload.single('file'), parseFile);

// ---------------------------------------------------------------------------
// Analyze — optionalAuth identifies logged-in users for DB persistence
// ---------------------------------------------------------------------------

router.post('/analyze', optionalAuth, safetyMiddleware, analyzeText);

// ---------------------------------------------------------------------------
// Protected routes
// ---------------------------------------------------------------------------

router.post('/upload', authMiddleware, uploadDocument);
router.get('/history', authMiddleware, getHistory);

module.exports = router;

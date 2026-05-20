const multer = require('multer');
const logger = require('../utils/logger');
// Require the lib directly — pdf-parse v1.1.1's index.js crashes on modern
// Node.js because `module.parent` is null, making it run debug/test code.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// ---------------------------------------------------------------------------
// Magic Byte Signatures
// ---------------------------------------------------------------------------

/** PDF files always start with "%PDF" (hex 25 50 44 46). */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

/**
 * Validates that a buffer's leading bytes match the expected file type.
 * - PDF: must start with %PDF
 * - TXT: must not contain null bytes (binary indicator)
 *
 * @param {Buffer} buffer  – File buffer
 * @param {string} claimed – The mimetype the client claims
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMagicBytes(buffer, claimed) {
  if (claimed === 'application/pdf') {
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      return { valid: false, reason: 'File content does not match PDF format.' };
    }
    return { valid: true };
  }

  if (claimed === 'text/plain') {
    // A legitimate text file should not contain null bytes
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
    if (sample.includes(0x00)) {
      return { valid: false, reason: 'File content does not match plain text format.' };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'Unsupported file type.' };
}

// ---------------------------------------------------------------------------
// Multer Configuration
// ---------------------------------------------------------------------------

// Store files in memory (no disk writes) — reduced from 10 MB to 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are supported.'));
    }
  },
});

// ---------------------------------------------------------------------------
// Timeout wrapper for CPU-bound PDF parsing
// ---------------------------------------------------------------------------

/**
 * Wraps a promise with a timeout to prevent indefinite CPU-bound hangs.
 */
function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * POST /api/parse-file
 * Accepts a single file upload (PDF or TXT) and returns the extracted text.
 */
async function parseFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { mimetype, buffer, originalname } = req.file;

    // Magic byte validation — do not trust client-reported mimetype alone
    const magicCheck = validateMagicBytes(buffer, mimetype);
    if (!magicCheck.valid) {
      return res.status(400).json({ error: magicCheck.reason });
    }

    let text = '';

    if (mimetype === 'text/plain') {
      // TXT — just decode the buffer
      text = buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf') {
      // PDF — extract text with pdf-parse, with a 30-second timeout
      const data = await withTimeout(
        pdfParse(buffer),
        30000,
        'PDF parsing timed out. The file may be too large or complex.'
      );
      text = data.text;
    } else {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return res.status(422).json({
        error: 'Could not extract text from file. The file may be empty or image-based.',
      });
    }

    return res.json({
      success: true,
      data: {
        text: trimmed,
        filename: originalname,
        characters: trimmed.length,
      },
    });
  } catch (err) {
    logger.error('File parse error:', { message: err.message, stack: err.stack });
    // Never expose internal library error messages to the client
    const isTimeout = err.message?.includes('timed out');
    return res.status(isTimeout ? 408 : 500).json({
      error: isTimeout
        ? 'PDF parsing timed out. Please try a smaller file.'
        : 'Failed to parse file.',
    });
  }
}

module.exports = { upload, parseFile };

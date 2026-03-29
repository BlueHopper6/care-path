const multer = require('multer');
// Require the lib directly — pdf-parse v1.1.1's index.js crashes on modern
// Node.js because `module.parent` is null, making it run debug/test code.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Store files in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are supported.'));
    }
  },
});

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
    let text = '';

    if (mimetype === 'text/plain') {
      // TXT — just decode the buffer
      text = buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf') {
      // PDF — extract text with pdf-parse
      const data = await pdfParse(buffer);
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
    console.error('File parse error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to parse file.',
    });
  }
}

module.exports = { upload, parseFile };

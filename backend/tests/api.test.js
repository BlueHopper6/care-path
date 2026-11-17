const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

/**
 * Build a minimal, valid PDF 1.4 buffer with exact XRef byte offsets for testing.
 */
function buildMinimalPdf(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const streamContent = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

test('health endpoint reflects configuration readiness without calling Gemini', async () => {
  const prevEnv = { ...process.env };
  process.env.NODE_ENV = 'test';
  delete process.env.GEMINI_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  delete require.cache[require.resolve('../utils/supabase')];
  delete require.cache[require.resolve('../services/ai')];
  delete require.cache[require.resolve('../index')];
  const { app } = require('../index');

  const { server, baseUrl } = await startServer(app);
  try {
    const degraded = await fetch(`${baseUrl}/api/health`);
    assert.equal(degraded.status, 503);
    const degradedBody = await degraded.json();
    assert.equal(degradedBody.ready, false);

    process.env.GEMINI_API_KEY = 'test-gemini-placeholder';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    delete require.cache[require.resolve('../utils/supabase')];
    delete require.cache[require.resolve('../services/ai')];
    delete require.cache[require.resolve('../index')];
    const { app: readyApp } = require('../index');
    const readySrv = await startServer(readyApp);
    try {
      const healthy = await fetch(`${readySrv.baseUrl}/api/health`);
      assert.equal(healthy.status, 200);
      const healthyBody = await healthy.json();
      assert.equal(healthyBody.status, 'ok');
      assert.equal(healthyBody.ready, true);
    } finally {
      readySrv.server.close();
    }
  } finally {
    server.close();
    process.env = prevEnv;
  }
});

test('auth middleware rejects missing or malformed bearer tokens', async () => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-gemini-placeholder';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  delete require.cache[require.resolve('../utils/supabase')];
  delete require.cache[require.resolve('../index')];
  const { app } = require('../index');
  const { server, baseUrl } = await startServer(app);

  try {
    const missing = await fetch(`${baseUrl}/api/history`);
    assert.equal(missing.status, 401);

    const malformed = await fetch(`${baseUrl}/api/history`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(malformed.status, 401);
  } finally {
    server.close();
  }
});

test('validation strips HTML tags and safety middleware detects emergencies', async () => {
  const { analyzeSchema } = require('../middleware/validation');
  const { safetyMiddleware } = require('../middleware/safety');

  const parsed = analyzeSchema.safeParse({
    raw_text: '<b>Patient has chest pain</b>',
    mode: 'simple',
    language: 'English',
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.raw_text, 'Patient has chest pain');

  const req = { body: parsed.data };
  let nextCalled = false;
  safetyMiddleware(req, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.emergencyDetected, true);
  assert.ok(req.emergencyWarnings.some((w) => w.includes('Chest pain')));
});

test('parse-file validates magic bytes and extracts PDF and TXT text', async () => {
  process.env.NODE_ENV = 'test';
  const { app } = require('../index');
  const { server, baseUrl } = await startServer(app);

  try {
    const fakePdf = new FormData();
    fakePdf.append(
      'file',
      new Blob(['NOT-A-PDF-HEADER'], { type: 'application/pdf' }),
      'fake.pdf'
    );
    const badRes = await fetch(`${baseUrl}/api/parse-file`, {
      method: 'POST',
      body: fakePdf,
    });
    assert.equal(badRes.status, 400);

    const validTxt = new FormData();
    validTxt.append(
      'file',
      new Blob(['Take 10mg once daily.'], { type: 'text/plain' }),
      'note.txt'
    );
    const okRes = await fetch(`${baseUrl}/api/parse-file`, {
      method: 'POST',
      body: validTxt,
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.data.text, 'Take 10mg once daily.');

    const pdfBytes = buildMinimalPdf('Patient takes vitamin D daily.');
    const realPdf = new FormData();
    realPdf.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'sample.pdf');
    const pdfRes = await fetch(`${baseUrl}/api/parse-file`, {
      method: 'POST',
      body: realPdf,
    });
    assert.equal(pdfRes.status, 200);
    const pdfBody = await pdfRes.json();
    assert.ok(pdfBody.data.text.includes('Patient takes vitamin D daily.'));
  } finally {
    server.close();
  }
});

test('production logger writes without file transport or stack leaks', () => {
  const loggerPath = path.resolve(__dirname, '../utils/logger.js');
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete require.cache[loggerPath];
  try {
    const logger = require(loggerPath);
    assert.equal(logger.transports.length, 1);
    assert.equal(logger.transports[0].name, 'console');
  } finally {
    process.env.NODE_ENV = prevEnv;
    delete require.cache[loggerPath];
  }
});

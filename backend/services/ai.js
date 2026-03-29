const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------------------------------------------------------------------------
// Initialise Gemini
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️  Missing GEMINI_API_KEY – AI analysis will not work.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(rawText, { mode = 'default', language = 'English' } = {}) {
  const simpleModeInstruction =
    mode === 'simple'
      ? `
IMPORTANT - "Explain Like I'm 12" mode is ON.
- Use very simple words a 12-year-old would understand.
- Keep sentences short (under 15 words each).
- Avoid ALL medical terminology - replace with everyday words.
- Use analogies and comparisons to everyday life where helpful.`
      : '';

  const languageInstruction =
    language && language.toLowerCase() !== 'english'
      ? `\nIMPORTANT: Write the ENTIRE response in ${language}. All fields must be in ${language}.`
      : '';

  return `You are a healthcare navigation assistant called CarePath. Your job is to help patients understand medical documents by converting them into plain, easy-to-understand language.

STRICT RULES — YOU MUST FOLLOW THESE:
1. NEVER diagnose any condition.
2. NEVER recommend medication changes.
3. NEVER suggest starting, stopping, or adjusting any treatment.
4. ALWAYS frame information as "what the document says" rather than giving medical opinions.
5. If the document mentions something concerning, tell the patient to discuss it with their doctor.
${simpleModeInstruction}${languageInstruction}

Analyze the following medical text and return a JSON object with exactly these fields:

{
  "summary": "A clear, plain-language summary of what the document says. 2-4 sentences.",
  "action_plan": ["Step 1...", "Step 2...", "Step 3..."],
  "recurring_tasks": [
    {
      "title": "Short title for calendar (e.g. Take Amoxicillin)",
      "description": "Details about the task (e.g. 500mg table with food)",
      "frequency": "How often to do it (e.g. Twice daily, Every Friday) or Frequency not specified",
      "rrule": "Standard iCalendar RRULE string (e.g. RRULE:FREQ=DAILY;INTERVAL=1) or empty string if no frequency is given"
    }
  ],
  "questions_for_doctor": ["Question 1?", "Question 2?", "Question 3?"],
  "warning_signs": ["Warning sign 1", "Warning sign 2"],
  "confidence_level": "low" | "medium" | "high"
}

Guidelines for each field:
- summary: Explain what happened and what the patient needs to know, in plain English (${mode === 'simple' ? '4th-6th' : '6th-8th'} grade reading level).
- action_plan: Concrete steps the patient should take, in chronological order. Include medications to continue (do NOT change them), follow-up appointments, lifestyle instructions.
- recurring_tasks: CRITICAL: You MUST extract discrete measurable repeating tasks like taking specific medication or attending follow ups. For example, if the text says "take antibiotics twice a day", you MUST extract { "title": "Take antibiotics", "frequency": "Twice a day", "description": "Take for a week", "rrule": "RRULE:FREQ=DAILY;INTERVAL=1" }. Do NOT include continuous lifestyle modifications like diet exercise or weight management. If a specific frequency is not explicitly stated in the text you MUST leave the rrule field as an empty string and set frequency to Frequency not specified. The rrule MUST be a valid Google Calendar RRULE formatted string (FREQ=DAILY, FREQ=WEEKLY, etc). Do this EVEN IF you also included it in the action_plan. If absolutely no recurring schedule exists, output [].
- questions_for_doctor: Important questions the patient should ask at their next visit.
- warning_signs: Symptoms that should prompt the patient to seek immediate care or call their doctor.
- confidence_level: "high" if the text is clear and complete, "medium" if some details are missing, "low" if the text is unclear or incomplete.

MEDICAL TEXT:
"""
${rawText}
"""

Respond with ONLY the JSON object. No markdown, no code fences, no explanation.`;
}

// ---------------------------------------------------------------------------
// Analyse medical text
// ---------------------------------------------------------------------------

const DISCLAIMER =
  'This is not medical advice. Always consult a qualified healthcare professional before making any medical decisions.';

/**
 * Sends medical text to Gemini for analysis.
 *
 * @param {string} rawText   – The raw medical document text
 * @param {object} options
 * @param {string} [options.mode]     – "default" or "simple"
 * @param {string} [options.language] – Target output language
 * @returns {Promise<object>} The structured analysis result
 */
async function analyzeMedicalText(rawText, options = {}) {
  if (!genAI) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // do not work
  // const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  // const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const prompt = buildPrompt(rawText, options);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Clean the response — Gemini sometimes wraps JSON in markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse Gemini response:', cleaned);
    throw new Error('AI returned an invalid response. Please try again.');
  }

  // Validate and normalise the response shape
  return {
    summary: parsed.summary || 'Unable to generate summary.',
    action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan : [],
    recurring_tasks: Array.isArray(parsed.recurring_tasks) ? parsed.recurring_tasks : [],
    questions_for_doctor: Array.isArray(parsed.questions_for_doctor) ? parsed.questions_for_doctor : [],
    warning_signs: Array.isArray(parsed.warning_signs) ? parsed.warning_signs : [],
    confidence_level: ['low', 'medium', 'high'].includes(parsed.confidence_level)
      ? parsed.confidence_level
      : 'medium',
    disclaimer: DISCLAIMER,
  };
}

module.exports = { analyzeMedicalText, DISCLAIMER };

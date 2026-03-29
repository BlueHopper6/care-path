/**
 * Safety middleware — rule-based detection for emergency medical phrases.
 *
 * This does NOT block the request. It flags emergency content so controllers
 * can inject appropriate warnings into the response.
 */

const EMERGENCY_PATTERNS = [
  { pattern: /chest\s*pain/i, warning: 'Chest pain detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /trouble\s*breathing/i, warning: 'Breathing difficulty detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /difficulty\s*breathing/i, warning: 'Breathing difficulty detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /shortness\s*of\s*breath/i, warning: 'Shortness of breath detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /severe\s*bleeding/i, warning: 'Severe bleeding detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /uncontrolled\s*bleeding/i, warning: 'Uncontrolled bleeding detected — seek immediate medical attention or call emergency services (911).' },
  { pattern: /unconscious/i, warning: 'Unconsciousness mentioned — seek immediate medical attention or call emergency services (911).' },
  { pattern: /loss\s*of\s*consciousness/i, warning: 'Loss of consciousness mentioned — seek immediate medical attention or call emergency services (911).' },
  { pattern: /stroke/i, warning: 'Stroke symptoms mentioned — seek immediate medical attention or call emergency services (911). Remember FAST: Face drooping, Arm weakness, Speech difficulty, Time to call.' },
  { pattern: /seizure/i, warning: 'Seizure mentioned — seek immediate medical attention or call emergency services (911).' },
  { pattern: /suicid/i, warning: 'If you or someone you know is in crisis, call the Suicide & Crisis Lifeline at 988 or go to your nearest emergency room.' },
  { pattern: /self[- ]?harm/i, warning: 'If you or someone you know is in crisis, call the Suicide & Crisis Lifeline at 988 or go to your nearest emergency room.' },
  { pattern: /overdose/i, warning: 'Possible overdose — call Poison Control (1-800-222-1222) or emergency services (911) immediately.' },
  { pattern: /anaphyla/i, warning: 'Possible anaphylaxis — seek immediate medical attention or call emergency services (911). Use an epinephrine auto-injector if available.' },
  { pattern: /can'?t\s*breathe/i, warning: 'Breathing emergency detected — call emergency services (911) immediately.' },
  { pattern: /heart\s*attack/i, warning: 'Heart attack symptoms — call emergency services (911) immediately.' },
];

function safetyMiddleware(req, _res, next) {
  const text = req.body?.raw_text || '';
  const detectedWarnings = [];

  for (const { pattern, warning } of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) {
      detectedWarnings.push(warning);
    }
  }

  // Deduplicate warnings (in case multiple patterns trigger similar ones)
  req.emergencyDetected = detectedWarnings.length > 0;
  req.emergencyWarnings = [...new Set(detectedWarnings)];

  next();
}

module.exports = { safetyMiddleware, EMERGENCY_PATTERNS };

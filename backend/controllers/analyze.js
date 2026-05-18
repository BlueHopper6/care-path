const { analyzeMedicalText, DISCLAIMER } = require('../services/ai');
const { createUserClient } = require('../utils/supabase');

/**
 * POST /api/analyze
 *
 * Accepts medical text, runs it through the AI service,
 * merges any emergency warnings, and returns the result.
 *
 * Input validation is handled by the validation middleware.
 */
async function analyzeText(req, res) {
  try {
    const { raw_text, language } = req.body;
    const mode = req.query.mode || req.body.mode || 'default';

    // Run AI analysis
    const analysis = await analyzeMedicalText(raw_text, { mode, language });

    // Merge emergency warnings from the safety middleware
    if (req.emergencyDetected && req.emergencyWarnings?.length > 0) {
      // Prepend emergency warnings so they appear first
      analysis.warning_signs = [...req.emergencyWarnings, ...analysis.warning_signs];
    }

    return res.json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    // Log error type only — never log raw medical text (PHI)
    console.error('Analyze error:', { name: err.name, message: err.message });
    return res.status(500).json({
      error: 'Failed to analyze medical text.',
      disclaimer: DISCLAIMER,
    });
  }
}

/**
 * POST /api/analyze/save
 * Explicitly saves a pre-analyzed result to the database for logged in users.
 *
 * Input validation is handled by the validation middleware.
 */
async function saveAnalyzedText(req, res) {
  try {
    const { raw_text, analysis, mode, language } = req.body;

    if (req.user && req.accessToken) {
      const supabase = createUserClient(req.accessToken);

      // Store the document
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: req.user.id,
          raw_text: raw_text.substring(0, 100000), // safety cap
        })
        .select('id')
        .single();

      if (docError) {
        console.error('Error storing document:', { code: docError.code, hint: docError.hint });
        return res.status(500).json({ error: 'Failed to store document.' });
      }

      // Store the analysis
      if (doc) {
        const { error: analysisError } = await supabase.from('analyses').insert({
          user_id: req.user.id,
          document_id: doc.id,
          summary: analysis.summary,
          action_plan: analysis.action_plan,
          recurring_tasks: analysis.recurring_tasks || [],
          questions: analysis.questions_for_doctor,
          warnings: analysis.warning_signs,
          confidence_level: analysis.confidence_level,
          language: language || 'English',
          mode: mode || 'default',
        });

        if (analysisError) {
          console.error('Error storing analysis:', { code: analysisError.code, hint: analysisError.hint });
          return res.status(500).json({ error: 'Failed to store analysis.' });
        }
      }

      return res.json({ success: true, message: 'Analysis saved successfully' });
    }

    return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    console.error('Save error:', { name: err.name, message: err.message });
    return res.status(500).json({ error: 'Failed to save analysis.' });
  }
}

module.exports = { analyzeText, saveAnalyzedText };

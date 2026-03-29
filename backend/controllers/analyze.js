const { analyzeMedicalText, DISCLAIMER } = require('../services/ai');
const { createUserClient } = require('../utils/supabase');

/**
 * POST /api/analyze
 *
 * Accepts medical text, runs it through the AI service,
 * merges any emergency warnings, and stores the result.
 */
async function analyzeText(req, res) {
  try {
    const { raw_text, language } = req.body;
    const mode = req.query.mode || req.body.mode || 'default';

    // Validation
    if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length === 0) {
      return res.status(400).json({ error: 'raw_text is required and must be a non-empty string.' });
    }

    if (raw_text.length > 50000) {
      return res.status(400).json({ error: 'raw_text exceeds the 50,000 character limit.' });
    }

    // Run AI analysis
    const analysis = await analyzeMedicalText(raw_text, { mode, language });

    // Merge emergency warnings from the safety middleware
    if (req.emergencyDetected && req.emergencyWarnings?.length > 0) {
      // Prepend emergency warnings so they appear first
      analysis.warning_signs = [...req.emergencyWarnings, ...analysis.warning_signs];
    }

    // If user is authenticated, persist to Supabase
    if (req.user && req.accessToken) {
      try {
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
          console.error('Error storing document:', docError);
        }

        // Store the analysis
        if (doc) {
          const { error: analysisError } = await supabase.from('analyses').insert({
            user_id: req.user.id,
            document_id: doc.id,
            summary: analysis.summary,
            action_plan: analysis.action_plan,
            questions: analysis.questions_for_doctor,
            warnings: analysis.warning_signs,
            confidence_level: analysis.confidence_level,
            language: language || 'English',
            mode: mode,
          });

          if (analysisError) {
            console.error('Error storing analysis:', analysisError);
          }
        }
      } catch (dbErr) {
        // Don't fail the request if DB storage fails
        console.error('Database storage error (non-fatal):', dbErr.message);
      }
    }

    return res.json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    console.error('Analyze error:', err);
    return res.status(500).json({
      error: 'Failed to analyze medical text.',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      disclaimer: DISCLAIMER,
    });
  }
}

module.exports = { analyzeText };

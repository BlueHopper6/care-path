const { createUserClient } = require('../utils/supabase');
const logger = require('../utils/logger');

/**
 * POST /api/upload
 *
 * Store raw medical text in the documents table.
 * Input validation is handled by the validation middleware.
 */
async function uploadDocument(req, res) {
  try {
    const { raw_text } = req.body;

    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: req.user.id,
        raw_text,
      })
      .select('id, created_at')
      .single();

    if (error) {
      logger.error('Upload error:', { code: error.code, hint: error.hint });
      return res.status(500).json({ error: 'Failed to store document.' });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: data.id,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    logger.error('Upload error:', { name: err.name, message: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to upload document.' });
  }
}

/**
 * GET /api/history
 *
 * Return past analyses for the authenticated user,
 * ordered by most recent first.
 */
async function getHistory(req, res) {
  try {
    const supabase = createUserClient(req.accessToken);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 50);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('analyses')
      .select(
        `
        id,
        summary,
        action_plan,
        questions,
        warnings,
        confidence_level,
        language,
        mode,
        created_at,
        documents ( id, raw_text, created_at )
      `,
        { count: 'exact' }
      )
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('History fetch error:', { code: error.code, hint: error.hint });
      return res.status(500).json({ error: 'Failed to fetch history.' });
    }

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    logger.error('History error:', { name: err.name, message: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
}

module.exports = { uploadDocument, getHistory };

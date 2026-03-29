const { createUserClient } = require('../utils/supabase');

/**
 * GET /api/preferences
 * Fetch the user's preferences from the public.users table.
 */
async function getPreferences(req, res) {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('users')
      .select('auto_save_history')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching preferences:', error);
      return res.status(500).json({ error: 'Failed to fetch preferences.' });
    }

    // Default to false if no row exists yet
    return res.json({
      success: true,
      data: {
        auto_save_history: data?.auto_save_history ?? false,
      },
    });
  } catch (err) {
    console.error('Preferences error:', err);
    return res.status(500).json({ error: 'Internal server error fetching preferences.' });
  }
}

/**
 * PUT /api/preferences
 * Update the user's preferences in the public.users table.
 * Uses upsert since the row might not exist yet for new signups.
 */
async function updatePreferences(req, res) {
  try {
    if (typeof req.body.auto_save_history !== 'boolean') {
      return res.status(400).json({ error: 'auto_save_history must be a boolean.' });
    }

    const supabase = createUserClient(req.accessToken);

    const { error } = await supabase
      .from('users')
      .upsert({
        id: req.user.id,
        auto_save_history: req.body.auto_save_history,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('Error updating preferences:', error);
      return res.status(500).json({ error: 'Failed to update preferences.' });
    }

    return res.json({
      success: true,
      data: { auto_save_history: req.body.auto_save_history },
    });
  } catch (err) {
    console.error('Preferences update error:', err);
    return res.status(500).json({ error: 'Internal server error updating preferences.' });
  }
}

module.exports = { getPreferences, updatePreferences };

const { Router } = require('express');
const { getConsentUrl, exchangeCode, saveRefreshToken, isAuthenticated } = require('../auth/youtube');

const router = Router();

// Check auth status
router.get('/auth/status', async (_req, res) => {
  const authed = await isAuthenticated();
  res.json({ authenticated: authed });
});

// Redirect straight to Google consent screen
router.get('/auth/init', (_req, res) => {
  const url = getConsentUrl();
  res.redirect(url);
});

// Google redirects back here — save token and redirect to dashboard
router.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code parameter');

    const tokens = await exchangeCode(code);

    if (tokens.refresh_token) {
      await saveRefreshToken(tokens.refresh_token);
    }

    // Redirect to dashboard
    res.redirect('/');
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.status(500).send('Authentication failed. <a href="/api/auth/init">Try again</a>');
  }
});

// Disconnect / clear token
router.post('/auth/disconnect', async (_req, res) => {
  try {
    const pool = require('../db/pool');
    await pool.query("DELETE FROM app_settings WHERE key = 'youtube_refresh_token'");
    res.json({ message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

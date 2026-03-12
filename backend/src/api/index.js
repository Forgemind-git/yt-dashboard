const { Router } = require('express');

const router = Router();

// Shared-secret API key middleware
// Skip if DASHBOARD_API_KEY is not set (development fallback)
// Skip for auth callback (called by Google) and health endpoint
router.use((req, res, next) => {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (!apiKey) return next(); // dev mode — no key configured

  // Allow Google OAuth callback without auth
  if (req.path === '/auth/callback') return next();

  const authHeader = req.headers['authorization'] || '';
  const keyHeader = req.headers['x-api-key'] || '';

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : keyHeader;
  if (token === apiKey) return next();

  return res.status(401).json({ error: 'Unauthorized' });
});

router.use(require('./auth'));
router.use(require('./overview'));
router.use(require('./channel'));
router.use(require('./videos'));
router.use(require('./trafficSources'));
router.use(require('./geography'));
router.use(require('./devices'));
router.use(require('./demographics'));
router.use(require('./realtime'));
router.use(require('./collection'));
router.use(require('./insights'));
router.use(require('./ai-insights'));

module.exports = router;

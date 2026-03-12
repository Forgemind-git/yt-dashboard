const { Router } = require('express');
const { runAnalysis, runAllAnalyses, getAnalysisTypes, clearCache, chatWithData, generateVideoTitles, getSmartNotifications } = require('../ai/analyzer');

const router = Router();

// List available analysis types
router.get('/ai-insights/types', (_req, res) => {
  res.json({ types: getAnalysisTypes() });
});

// Smart notifications (lightweight, cached 15 min)
router.get('/ai-insights/notifications', async (_req, res) => {
  try {
    const notifications = await getSmartNotifications();
    res.json({ notifications });
  } catch (err) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// AI Chat — ask anything about channel data
router.post('/ai-insights/chat', async (req, res) => {
  try {
    const { question, history } = req.body || {};
    if (!question) return res.status(400).json({ error: 'Question is required' });
    const result = await chatWithData(question, history || []);
    res.json(result);
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Video title generator
router.post('/ai-insights/generate-titles', async (req, res) => {
  try {
    const { topic } = req.body || {};
    const result = await generateVideoTitles(topic);
    res.json(result);
  } catch (err) {
    console.error('Title generator error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Run all analyses (heavy — use sparingly)
router.post('/ai-insights/generate-all', async (_req, res) => {
  try {
    const results = await runAllAnalyses();
    res.json({ analyses: results, count: results.length });
  } catch (err) {
    console.error('AI generate-all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear cache (force fresh analysis)
router.post('/ai-insights/refresh', (req, res) => {
  const { type } = req.body || {};
  clearCache(type);
  res.json({ cleared: type || 'all', message: 'Cache cleared — next request will generate fresh analysis' });
});

// Run a specific analysis (must be LAST because of :type wildcard)
router.get('/ai-insights/:type', async (req, res) => {
  try {
    const result = await runAnalysis(req.params.type);
    res.json(result);
  } catch (err) {
    console.error(`AI insight error (${req.params.type}):`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

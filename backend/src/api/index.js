const { Router } = require('express');

const router = Router();

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

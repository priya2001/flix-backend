const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

router.get('/analytics', auth, analyticsController.getAnalytics);
router.get('/analytics/users-timeline', auth, analyticsController.getUsersTimeline);

module.exports = router;

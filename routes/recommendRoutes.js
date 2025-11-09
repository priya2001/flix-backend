const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // optional but useful
const recController = require('../controllers/recommendationController');

// return personalized recommendations; if token not present, returns general
router.get('/', auth, recController.getRecommendations);

module.exports = router;

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authMiddleware, optionalAuth } = require('../middlewares/auth');

router.get('/stats', dashboardController.getStats);
router.get('/average-tuition', optionalAuth, dashboardController.getAverageTuition);
router.get('/:path', dashboardController.getPath);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/refresh-tokens', authController.refreshTokens);
router.post('/logout', authController.logout);
router.get('/user-who', authMiddleware, authController.userWho);

module.exports = router;

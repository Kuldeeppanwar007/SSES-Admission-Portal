const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, getMe } = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/register', protect, authorizeRoles('admin'), register); // admin only

module.exports = router;

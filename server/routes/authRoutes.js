const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, getMe, changePassword } = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validate');

router.post('/login', validate(schemas.login), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/register', protect, authorizeRoles('admin'), register);

module.exports = router;

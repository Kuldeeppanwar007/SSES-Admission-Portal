const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { setTarget, getTargets } = require('../controllers/targetController');

router.get('/', protect, getTargets);
router.post('/', protect, authorizeRoles('admin'), setTarget);

module.exports = router;

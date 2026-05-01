const express = require('express');
const router  = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getDailyDistance, getWeeklyDistance, getInactiveNow } = require('../controllers/analyticsController');

router.use(protect, authorizeRoles('admin'));
router.get('/daily-distance',  getDailyDistance);
router.get('/weekly-distance', getWeeklyDistance);
router.get('/inactive-now',    getInactiveNow);

module.exports = router;

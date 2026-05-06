const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getDailySummary, getWeeklySummary } = require('../controllers/dailySummaryController');

router.use(protect, authorizeRoles('admin', 'track_incharge', 'interviewer'));
router.get('/', getDailySummary);
router.get('/weekly', getWeeklySummary);

module.exports = router;

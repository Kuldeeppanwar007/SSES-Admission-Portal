const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { markAttendance, getMyAttendance, getAllAttendance, getMonthlyStats, saveLocation, getLocationLogs, getDayView } = require('../controllers/attendanceController');

router.post('/mark', protect, authorizeRoles('track_incharge'), markAttendance);
router.get('/my', protect, authorizeRoles('track_incharge'), getMyAttendance);
router.get('/all', protect, authorizeRoles('admin'), getAllAttendance);
router.get('/monthly-stats', protect, authorizeRoles('admin'), getMonthlyStats);
router.get('/day-view', protect, authorizeRoles('admin'), getDayView);
router.post('/location', protect, authorizeRoles('track_incharge'), saveLocation);
router.get('/location-logs', protect, authorizeRoles('admin'), getLocationLogs);

module.exports = router;

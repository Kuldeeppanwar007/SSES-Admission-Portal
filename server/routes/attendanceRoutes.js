const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { markAttendance, getMyAttendance, getAllAttendance, getMonthlyStats, saveLocation, getLocationLogs, getDayView, getTimeline, geocodePoints, getLiveLocations } = require('../controllers/attendanceController');

const { validate, schemas } = require('../middleware/validate');

router.post('/mark', protect, authorizeRoles('track_incharge'), validate(schemas.markAttendance), markAttendance);
router.get('/my', protect, authorizeRoles('track_incharge'), getMyAttendance);
router.get('/all', protect, authorizeRoles('admin'), getAllAttendance);
router.get('/monthly-stats', protect, authorizeRoles('admin'), getMonthlyStats);
router.get('/day-view', protect, authorizeRoles('admin'), getDayView);
router.get('/timeline', protect, authorizeRoles('admin'), getTimeline);
router.post('/geocode', protect, authorizeRoles('admin'), geocodePoints);
router.post('/location', protect, authorizeRoles('track_incharge'), saveLocation);
router.get('/location-logs', protect, authorizeRoles('admin'), getLocationLogs);
router.get('/live-locations', protect, authorizeRoles('admin'), getLiveLocations);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { syncSingleStudent, syncBulkStudents, getEligibleStudents } = require('../controllers/centralSyncController');

// Sirf admin aur manager hi central sync kar sakte hain
router.get('/eligible', protect, authorizeRoles('admin', 'manager'), getEligibleStudents);
router.post('/bulk', protect, authorizeRoles('admin', 'manager'), syncBulkStudents);
router.post('/:id', protect, authorizeRoles('admin', 'manager'), syncSingleStudent);

module.exports = router;

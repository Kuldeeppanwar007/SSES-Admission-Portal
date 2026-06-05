const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { syncSingleStudent, syncBulkStudents, getEligibleStudents } = require('../controllers/centralSyncController');

// Eligible list sabhi authenticated roles dekh sakte hain, sync sirf admin/manager
router.get('/eligible', protect, getEligibleStudents);
router.post('/bulk', protect, authorizeRoles('admin', 'manager'), syncBulkStudents);
router.post('/:id', protect, authorizeRoles('admin', 'manager'), syncSingleStudent);

module.exports = router;

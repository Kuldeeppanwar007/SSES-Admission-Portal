const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getEntries, getInterviewers, createEntry, getLatestByFormNo, getLatestByStudentId } = require('../controllers/receptionController');

// Sabhi logged-in users ke liye — interviewer bhi access kar sake
router.get('/interviewers', protect, getInterviewers);
router.get('/by-form/:formNo', protect, getLatestByFormNo);
router.get('/by-student/:studentId', protect, getLatestByStudentId);

// Sirf admin aur receptionist ke liye
router.use(protect, authorizeRoles('admin', 'receptionist'));
router.get('/', getEntries);
router.post('/', createEntry);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getEntries, getInterviewers, createEntry, getLatestByFormNo, getLatestByStudentId, getAllByStudentId, deleteEntry } = require('../controllers/receptionController');

// Sabhi logged-in users ke liye — interviewer bhi access kar sake
router.get('/interviewers', protect, getInterviewers);
router.get('/by-form/:formNo', protect, getLatestByFormNo);
router.get('/by-student/:studentId', protect, getLatestByStudentId);
router.get('/all-by-student/:studentId', protect, getAllByStudentId);

// Admin, receptionist aur track_incharge ke liye
router.get('/', protect, authorizeRoles('admin', 'receptionist', 'track_incharge'), getEntries);

// Sirf admin aur receptionist ke liye
router.post('/', protect, authorizeRoles('admin', 'receptionist'), createEntry);
router.delete('/:id', protect, authorizeRoles('admin', 'receptionist'), deleteEntry);

module.exports = router;

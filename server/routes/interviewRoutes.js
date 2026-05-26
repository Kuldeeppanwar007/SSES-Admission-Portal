const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { addInterview, getInterviews, addFinalInterview, getLastDates, deleteInterview, deleteFinalInterview } = require('../controllers/interviewController');

router.post('/last-dates', protect, getLastDates);
router.post('/:studentId/final', protect, authorizeRoles('admin'), addFinalInterview);
router.post('/:studentId',  protect, addInterview);
router.get('/:studentId',   protect, getInterviews);
router.delete('/:id', protect, authorizeRoles('admin'), deleteInterview);
router.delete('/:studentId/final', protect, authorizeRoles('admin'), deleteFinalInterview);

module.exports = router;

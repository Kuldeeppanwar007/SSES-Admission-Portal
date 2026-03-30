const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { addInterview, getInterviews, addFinalInterview } = require('../controllers/interviewController');

router.post('/:studentId/final', protect, authorizeRoles('admin'), addFinalInterview);
router.post('/:studentId',  protect, addInterview);
router.get('/:studentId',   protect, getInterviews);

module.exports = router;

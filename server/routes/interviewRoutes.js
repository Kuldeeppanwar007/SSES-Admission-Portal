const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { addInterview, getInterviews } = require('../controllers/interviewController');

router.post('/:studentId',  protect, addInterview);
router.get('/:studentId',   protect, getInterviews);

module.exports = router;

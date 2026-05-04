const express = require('express');
const router  = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { markLeave, unmarkLeave, getLeaves } = require('../controllers/leaveController');

router.use(protect, authorizeRoles('admin'));
router.get('/',    getLeaves);
router.post('/',   markLeave);
router.delete('/', unmarkLeave);

module.exports = router;

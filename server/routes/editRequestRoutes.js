const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { createEditRequest, getEditRequests, reviewEditRequest, getMyEditRequests } = require('../controllers/editRequestController');

router.post('/:studentId',        protect, createEditRequest);                          // track_incharge/admin
router.get('/my/requests',        protect, getMyEditRequests);                          // apni requests
router.get('/',                   protect, authorizeRoles('admin'), getEditRequests);   // admin — sab
router.patch('/:id/review',       protect, authorizeRoles('admin'), reviewEditRequest); // admin — approve/reject

module.exports = router;

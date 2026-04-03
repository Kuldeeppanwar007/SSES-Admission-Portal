const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getTrackConfigs, createTrackConfig, updateTrackConfig, deleteTrackConfig } = require('../controllers/trackConfigController');

router.use(protect, authorizeRoles('admin'));
router.get('/', getTrackConfigs);
router.post('/', createTrackConfig);
router.put('/:id', updateTrackConfig);
router.delete('/:id', deleteTrackConfig);

module.exports = router;

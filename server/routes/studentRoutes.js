const express = require('express');
const router = express.Router();
const multer = require('multer');
const { upload } = require('../config/cloudinary');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getStudents, getStudent, addStudent, updateStudent,
  deleteStudent, updateStatus, getStatusHistory, bulkUpload, downloadTemplate, exportStudents, getStats, getTrackStats, selfRegister,
} = require('../controllers/studentController');

const memStorage = multer({ storage: multer.memoryStorage() });

// Public self-registration endpoint (no auth required)
router.post('/self-register', selfRegister);

router.get('/stats', protect, getStats);
router.get('/track-stats', protect, async (req, res, next) => {
  if (req.user.role === 'admin') {
    if (!req.query.track) return res.status(400).json({ message: 'track query param required' });
    req.user.track = req.query.track;
    return getTrackStats(req, res, next);
  }
  if (req.user.role === 'track_incharge') return getTrackStats(req, res, next);
  return res.status(403).json({ message: 'Access denied' });
});
router.get('/weekly-bonus-history', protect, async (req, res) => {
  const WeeklyBonus = require('../models/WeeklyBonus');
  const history = await WeeklyBonus.find({}).sort({ weekStart: -1 }).limit(10);
  res.json(history);
});
router.post('/weekly-bonus-manual', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { runWeeklyBonus } = require('../utils/weeklyBonus');
    const result = await runWeeklyBonus();
    if (result?.skipped) return res.status(400).json({ message: 'Bonus already distributed this week' });
    res.json({ message: 'Weekly bonus distributed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/download-template', protect, downloadTemplate);
router.get('/', protect, getStudents);
router.get('/:id', protect, getStudent);

router.post('/bulk-upload', protect, memStorage.single('file'), bulkUpload);
router.post('/export', protect, exportStudents);
router.post('/', protect, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'marksheet10th', maxCount: 1 },
  { name: 'marksheet12th', maxCount: 1 },
  { name: 'incomeCertificate', maxCount: 1 },
  { name: 'jaatiPraman', maxCount: 1 },
  { name: 'abcId', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
]), addStudent);
router.put('/:id', protect, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'marksheet10th', maxCount: 1 },
  { name: 'marksheet12th', maxCount: 1 },
  { name: 'incomeCertificate', maxCount: 1 },
  { name: 'jaatiPraman', maxCount: 1 },
  { name: 'abcId', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
]), updateStudent);
router.delete('/:id', protect, authorizeRoles('admin', 'manager'), deleteStudent);
router.get('/:id/status-history', protect, getStatusHistory);
router.patch('/:id/status', protect, authorizeRoles('admin', 'manager', 'track_incharge'), updateStatus);

module.exports = router;

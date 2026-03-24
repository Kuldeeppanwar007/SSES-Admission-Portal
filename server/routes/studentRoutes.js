const express = require('express');
const router = express.Router();
const multer = require('multer');
const { upload } = require('../config/cloudinary');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getStudents, getStudent, addStudent, updateStudent,
  deleteStudent, updateStatus, bulkUpload, downloadTemplate, getStats, getTrackStats,
} = require('../controllers/studentController');

const memStorage = multer({ storage: multer.memoryStorage() });

router.get('/stats', protect, getStats);
router.get('/track-stats', protect, authorizeRoles('track_incharge'), getTrackStats);
router.get('/download-template', protect, downloadTemplate);
router.get('/', protect, getStudents);
router.get('/:id', protect, getStudent);

router.post('/bulk-upload', protect, memStorage.single('file'), bulkUpload);
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
router.patch('/:id/status', protect, authorizeRoles('admin', 'manager', 'track_incharge'), updateStatus);

module.exports = router;

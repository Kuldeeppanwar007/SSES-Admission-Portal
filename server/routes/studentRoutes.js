const express = require('express');
const router = express.Router();
const multer = require('multer');
const { upload } = require('../config/cloudinary');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getStudents, getStudent, addStudent, updateStudent,
  deleteStudent, updateStatus, bulkUpload, downloadTemplate, getStats,
} = require('../controllers/studentController');

const memStorage = multer({ storage: multer.memoryStorage() });

router.get('/stats', protect, getStats);
router.get('/download-template', protect, downloadTemplate);
router.get('/', protect, getStudents);
router.get('/:id', protect, getStudent);

router.post('/bulk-upload', protect, memStorage.single('file'), bulkUpload);
router.post('/', protect, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'marksheet', maxCount: 1 }]), addStudent);
router.put('/:id', protect, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'marksheet', maxCount: 1 }]), updateStudent);
router.delete('/:id', protect, authorizeRoles('admin', 'manager'), deleteStudent);
router.patch('/:id/status', protect, authorizeRoles('admin', 'manager'), updateStatus);

module.exports = router;

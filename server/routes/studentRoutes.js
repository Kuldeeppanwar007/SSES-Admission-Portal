const express = require('express');
const router = express.Router();
const multer = require('multer');
const { upload } = require('../config/cloudinary');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validate');
const {
  getStudents, getStudent, addStudent, updateStudent,
  deleteStudent, updateStatus, getStatusHistory, getActivityLog, bulkUpload, downloadTemplate, downloadCSVTemplate, exportStudents, getStats, getTrackStats, selfRegister, getDistinctBranches, getDistinctVillages, getDistinctSchools,
} = require('../controllers/studentController');

const memStorage = multer({ storage: multer.memoryStorage() });

// Public self-registration endpoint (no auth required)
router.post('/self-register', validate(schemas.selfRegister), selfRegister);

// External website se student field update (webhook secret secured)
router.patch('/external-update/:id', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET)
    return res.status(401).json({ message: 'Unauthorized' });
  try {
    const allowedFields = [
      'name', 'fatherName', 'mobileNo', 'whatsappNo', 'track',
      'subject', 'fullAddress', 'otherTrack', 'status', 'remarks',
      'email', 'dob', 'gender', 'category', 'aadharNo', 'district',
      'village', 'pincode', 'tehsil', 'schoolName', 'persentage10',
      'persentage12', 'jeeScore', 'branch', 'year', 'feesScheme',
    ];
    const updates = {};
    Object.keys(req.body).forEach(k => {
      if (allowedFields.includes(k)) updates[k] = req.body[k];
    });
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: 'No valid fields to update' });
    const updated = await require('../models/Student').findByIdAndUpdate(
      req.params.id, updates, { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Updated successfully', student: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/max-interview-round', protect, async (req, res) => {
  try {
    const Interview = require('../models/Interview');
    const result = await Interview.aggregate([{ $group: { _id: null, max: { $max: '$round' } } }]);
    res.json({ maxRound: result[0]?.max || 1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
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

// Admin — TrackPoints recalculate from scratch
router.post('/recalculate-points', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const Student     = require('../models/Student');
    const TrackPoints = require('../models/TrackPoints');
    const Target      = require('../models/Target');

    const BTECH_SUBJECTS = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)'];

    // Target model se points fetch karo (same as getStats + weeklyBonus)
    const targets = await Target.find({});
    const pointsPerSubject = {}; // { track: { subject: pts } }
    targets.forEach(({ track, subject, points }) => {
      if (!pointsPerSubject[track]) pointsPerSubject[track] = {};
      pointsPerSubject[track][subject] = points || 0;
    });

    // Reset all track points to 0
    await TrackPoints.updateMany({}, { points: 0 });

    // Admission points recalculate — Target model se
    const admittedStudents = await Student.find({ status: 'Admitted', isDisabled: { $ne: true } });
    const pointsMap = {};
    admittedStudents.forEach(({ track, subject }) => {
      if (!track || !subject) return;
      const subjectKey = BTECH_SUBJECTS.includes(subject) ? 'B.Tech' : subject;
      const pts = pointsPerSubject[track]?.[subjectKey] || 0;
      pointsMap[track] = (pointsMap[track] || 0) + pts;
    });

    // Weekly bonus points preserve karo (TrackPoints mein jo extra points hain wo bonus se aaye hain)
    // Note: recalculate sirf admission points reset karta hai, bonus history WeeklyBonus model mein safe hai

    // Save
    await Promise.all(Object.entries(pointsMap).map(([track, points]) =>
      TrackPoints.findOneAndUpdate({ track }, { points }, { upsert: true })
    ));

    res.json({ message: 'Points recalculated successfully', pointsMap });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/download-template', protect, downloadTemplate);
router.get('/download-csv-template', protect, downloadCSVTemplate);
router.get('/distinct-branches', protect, getDistinctBranches);
router.get('/distinct-villages', protect, getDistinctVillages);
router.get('/distinct-schools', protect, getDistinctSchools);

// Admin — Data cleanup for wrong mappings
router.post('/cleanup-data', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const Student = require('../models/Student');
    
    const TOWN_TO_MAIN_TRACK = {
      'harda': 'Harda', 'timarni': 'Harda', 'seoni malwa': 'Harda', 'seoni malav': 'Harda',
      'khategaon': 'Khategaon', 'nemawar': 'Khategaon', 'sandalpur': 'Khategaon',
      'rehti': 'Rehti', 'gopalpur': 'Rehti', 'bherunda': 'Rehti', 'narmadapuram': 'Rehti',
      'satwas': 'Satwas & Kannod', 'kannod': 'Satwas & Kannod',
    };
    
    const MAIN_TRACKS = ['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'];
    
    // Find students with wrong track mappings
    const students = await Student.find({
      track: { $nin: [...MAIN_TRACKS, '', null] }
    });
    
    let fixedCount = 0;
    const issues = [];
    
    for (const student of students) {
      const lowerTrack = student.track.toLowerCase();
      const resolvedTrack = TOWN_TO_MAIN_TRACK[lowerTrack];
      
      if (resolvedTrack) {
        // Valid town name - fix it
        await Student.findByIdAndUpdate(student._id, {
          trackName: student.track, // Move original to town field
          track: resolvedTrack // Set main track
        });
        fixedCount++;
      } else {
        // Invalid track value
        issues.push({
          id: student._id,
          name: student.name,
          wrongTrack: student.track
        });
      }
    }
    
    res.json({
      message: `Data cleanup completed. Fixed ${fixedCount} students.`,
      fixed: fixedCount,
      issues: issues.slice(0, 10), // Show first 10 issues
      totalIssues: issues.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/activity-log', protect, authorizeRoles('admin', 'track_incharge'), getActivityLog);
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
router.patch('/:id/status', protect, authorizeRoles('admin', 'manager', 'track_incharge'), validate(schemas.updateStatus), updateStatus);

module.exports = router;

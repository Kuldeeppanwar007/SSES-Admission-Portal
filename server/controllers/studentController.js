const Student = require('../models/Student');
const User = require('../models/User');
const xlsx = require('xlsx');

// Get all students (admin/manager = all, track_incharge = own track)
const getStudents = async (req, res) => {
  try {
    const { track, status, search, formSource, interviewFilter, page = 1, limit = 10 } = req.query;
    const filter = {};
    const _limit = Math.min(Number(limit), 100);
    const _page = Number(page);

    if (req.user.role === 'track_incharge') filter.track = { $regex: `^${req.user.track}$`, $options: 'i' };
    else if (track) filter.track = { $regex: `^${track}$`, $options: 'i' };

    if (status === 'Disabled') filter.isDisabled = true;
    else { filter.isDisabled = { $ne: true }; if (status) filter.status = status; }

    if (formSource) filter.formSource = formSource;

    if (interviewFilter === 'finalCleared') {
      filter['finalInterview.result'] = 'Pass';
    } else if (interviewFilter === 'hasAttempts') {
      const Interview = require('../models/Interview');
      const studentIdsWithInterviews = await Interview.distinct('student');
      filter._id = { $in: studentIdsWithInterviews };
      filter['finalInterview.result'] = { $ne: 'Pass' };
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // ReDoS fix
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { fatherName: { $regex: safeSearch, $options: 'i' } },
        { mobileNo: { $regex: safeSearch, $options: 'i' } },
        { subject: { $regex: safeSearch, $options: 'i' } },
        { track: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const total = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .populate('addedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((_page - 1) * _limit)
      .limit(_limit);

    // Attach interviewCount to each student
    const Interview = require('../models/Interview');
    const ids = students.map(s => s._id);
    const counts = await Interview.aggregate([
      { $match: { student: { $in: ids } } },
      { $group: { _id: '$student', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(({ _id, count }) => { countMap[_id.toString()] = count; });
    const studentsWithCount = students.map(s => ({
      ...s.toObject(), interviewCount: countMap[s._id.toString()] || 0,
    }));

    res.json({ students: studentsWithCount, total, page: _page, pages: Math.ceil(total / _limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single student
const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('addedBy', 'name role')
    .populate('finalInterview.doneBy', 'name');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });
  res.json(student);
};

const DOCS = ['photo', 'marksheet10th', 'marksheet12th', 'incomeCertificate', 'jaatiPraman', 'abcId', 'aadharCard'];

// Add student manually
const addStudent = async (req, res) => {
  const count = await Student.countDocuments();
  const data = { ...req.body, sn: count + 1, addedBy: req.user._id, formSource: req.body.formSource || 'manual' };
  DOCS.forEach((d) => { if (req.files?.[d]) data[d] = req.files[d][0].path; });
  const student = await Student.create(data);
  res.status(201).json(student);
};

const TRACK_GROUP = {
  'Satwas': 1, 'Harda': 1, 'Gopalpur': 1,
  'Khategaon': 2, 'Kannod': 2, 'Bherunda': 2,
  'Timarni': 3, 'Nemawar': 3, 'Narmadapuram': 3, 'Seoni Malva': 3,
};

// Points per admission: [group1, group2, group3]
const SUBJECT_POINTS_BY_GROUP = {
  'B.Tech': [180, 198, 225],
  'BCA':    [120, 132, 150],
  'BBA':    [130, 143, 163],
  'Bcom':   [130, 143, 163],
  'Bio':    [120, 132, 150],
  'Micro':  [120, 132, 150],
};

const getSubjectPoints = (track, subject) => {
  const group = (TRACK_GROUP[track] || 1) - 1; // 0-indexed
  return (SUBJECT_POINTS_BY_GROUP[subject] || [0, 0, 0])[group];
};

const FUNNEL_POINTS = {
  'Call Completed': 5,
  'Lead Interested': 10,
  'Admission Closed': 100,
};

const ALLOWED_FUNNEL = {
  'Calling':  ['Call Completed', 'Lead Interested'],
  'Admitted': ['Admission Closed'],
};

// Update student
const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });

  const prevStatus = student.status;
  const prevFunnel = student.funnelStage || '';
  const prevTrack  = student.track || '';
  const updates = { ...req.body };

  // Validate funnel stage against status
  const effectiveStatus = updates.status || prevStatus;
  const allowedFunnels = ALLOWED_FUNNEL[effectiveStatus] || [];
  if (updates.funnelStage && !allowedFunnels.includes(updates.funnelStage)) {
    updates.funnelStage = ''; // silently clear invalid funnel stage
  }

  // If status changed and prevFunnel is no longer valid for new status, rollback those points
  let pointsDelta = 0;
  if (updates.status && updates.status !== prevStatus && prevFunnel) {
    const prevAllowed = ALLOWED_FUNNEL[prevStatus] || [];
    const newAllowed = ALLOWED_FUNNEL[updates.status] || [];
    if (prevAllowed.includes(prevFunnel) && !newAllowed.includes(prevFunnel)) {
      pointsDelta -= FUNNEL_POINTS[prevFunnel] || 0;
      await Student.findByIdAndUpdate(req.params.id, { $pull: { awardedFunnelStages: prevFunnel } });
      updates.funnelStage = '';
    }
  }
  if (updates.status === 'Disabled') updates.isDisabled = true;
  else if (updates.status && updates.status !== 'Disabled') updates.isDisabled = false;
  DOCS.forEach((d) => { if (req.files?.[d]) updates[d] = req.files[d][0].path; });
  const updated = await Student.findByIdAndUpdate(req.params.id, updates, { new: true });

  const newTrack = updated.track || '';
  const trackChanged = updates.track && updates.track !== prevTrack;
  const TrackPoints = require('../models/TrackPoints');

  // Track change hone par — purane track se sab points hataao, naye track mein daalo
  if (trackChanged && prevTrack && newTrack) {
    let migratePoints = 0;

    // Admission points
    if (prevStatus === 'Admitted' || effectiveStatus === 'Admitted') {
      const subject = updated.subject || student.subject;
      if (subject) {
        migratePoints += getSubjectPoints(newTrack, subject) - getSubjectPoints(prevTrack, subject);
        // Purane track se admission points ghataao
        await TrackPoints.findOneAndUpdate(
          { track: prevTrack },
          { $inc: { points: -getSubjectPoints(prevTrack, subject) } },
          { upsert: true }
        );
        // Naye track mein admission points daalo
        await TrackPoints.findOneAndUpdate(
          { track: newTrack },
          { $inc: { points: getSubjectPoints(newTrack, subject) } },
          { upsert: true }
        );
      }
    }

    // Funnel points migrate karo (jo awarded ho chuke hain)
    const awardedFunnels = updated.awardedFunnelStages || [];
    if (awardedFunnels.length > 0) {
      const funnelTotal = awardedFunnels.reduce((sum, f) => sum + (FUNNEL_POINTS[f] || 0), 0);
      if (funnelTotal > 0) {
        await TrackPoints.findOneAndUpdate({ track: prevTrack }, { $inc: { points: -funnelTotal } }, { upsert: true });
        await TrackPoints.findOneAndUpdate({ track: newTrack },  { $inc: { points:  funnelTotal } }, { upsert: true });
      }
    }

    // Calling points migrate karo
    if (updated.callingPointsAwarded) {
      await TrackPoints.findOneAndUpdate({ track: prevTrack }, { $inc: { points: -5 } }, { upsert: true });
      await TrackPoints.findOneAndUpdate({ track: newTrack },  { $inc: { points:  5 } }, { upsert: true });
    }

    // pointsDelta reset — track migration already handle ho gayi upar
    pointsDelta = 0;
  } else {
    // Normal (track nahi badla) — existing logic
    // Subject admission points
    if (prevStatus !== 'Admitted' && updates.status === 'Admitted' && updates.subject)
      pointsDelta += getSubjectPoints(newTrack, updates.subject);
    if (prevStatus === 'Admitted' && updates.status !== 'Admitted' && student.subject)
      pointsDelta -= getSubjectPoints(prevTrack, student.subject);

    // Funnel stage points — sirf ek baar per stage per student
    const newFunnel = updates.funnelStage || '';
    const awardedFunnelStages = student.awardedFunnelStages || [];
    if (newFunnel && newFunnel !== prevFunnel && !awardedFunnelStages.includes(newFunnel)) {
      pointsDelta += FUNNEL_POINTS[newFunnel] || 0;
      await Student.findByIdAndUpdate(req.params.id, { $addToSet: { awardedFunnelStages: newFunnel } });
    }

    // Calling status remark points — sirf ek baar milenge per student
    if (updates.status === 'Calling' && updates.remarks && updates.remarks.trim() && !student.callingPointsAwarded) {
      pointsDelta += 5;
      await Student.findByIdAndUpdate(req.params.id, { callingPointsAwarded: true });
    }

    if (pointsDelta !== 0 && newTrack) {
      await TrackPoints.findOneAndUpdate(
        { track: newTrack },
        { $inc: { points: pointsDelta } },
        { upsert: true, new: true }
      );
    }
  }

  // Save to status history if status or funnelStage changed
  const StatusHistory = require('../models/StatusHistory');
  const currentFunnel = updated.funnelStage || '';
  if (updates.status !== prevStatus || currentFunnel !== prevFunnel || updates.remarks) {
    await StatusHistory.create({
      student: req.params.id,
      status: updated.status,
      funnelStage: currentFunnel,
      remarks: updates.remarks || '',
      changedBy: req.user._id,
    });
  }

  res.json(updated);
};

// Delete student
const deleteStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  await student.deleteOne();
  res.json({ message: 'Student deleted' });
};

// Update status (Approve/Reject/Verify)
const updateStatus = async (req, res) => {
  const StatusHistory = require('../models/StatusHistory');
  const TrackPoints = require('../models/TrackPoints');
  const { status, remarks } = req.body;
  const isDisabled = status === 'Disabled';
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const prevStatus = student.status;
  const updated = await Student.findByIdAndUpdate(
    req.params.id,
    { status, remarks, isDisabled },
    { new: true }
  );

  // Points logic
  let pointsDelta = 0;
  if (prevStatus !== 'Admitted' && status === 'Admitted' && student.subject)
    pointsDelta += getSubjectPoints(student.track, student.subject);
  if (prevStatus === 'Admitted' && status !== 'Admitted' && student.subject)
    pointsDelta -= getSubjectPoints(student.track, student.subject);
  if (pointsDelta !== 0 && student.track) {
    await TrackPoints.findOneAndUpdate(
      { track: student.track },
      { $inc: { points: pointsDelta } },
      { upsert: true }
    );
  }

  await StatusHistory.create({ student: req.params.id, status, remarks, changedBy: req.user._id });
  res.json(updated);
};

// Get status history
const getStatusHistory = async (req, res) => {
  const StatusHistory = require('../models/StatusHistory');
  const history = await StatusHistory.find({ student: req.params.id })
    .populate('changedBy', 'name role')
    .sort({ createdAt: -1 });
  res.json(history);
};

const fieldMap = {
  'S.N.': 'sn', 'SN': 'sn', 'Sr No': 'sn', 'S.N': 'sn',
  'Name': 'name', 'Student Name': 'name',
  'Father Name': 'fatherName', "Father's Name": 'fatherName',
  'Track': 'track',
  'Mob. No': 'mobileNo', 'Mobile': 'mobileNo', 'Mobile No': 'mobileNo',
  'Mob. no': 'mobileNo', 'Mob. No.': 'mobileNo', 'mob. no': 'mobileNo',
  'Mob No.': 'mobileNo', 'Mob No': 'mobileNo', 'mob no': 'mobileNo', 'mob no.': 'mobileNo',
  'Whatsapp No': 'whatsappNo', 'WhatsApp': 'whatsappNo', 'Whatsapp no.': 'whatsappNo',
  'Whatsapp No.': 'whatsappNo', 'whatsapp no.': 'whatsappNo', 'Whatsapp No': 'whatsappNo',
  'Subject': 'subject',
  'Full Address': 'fullAddress', 'Address': 'fullAddress',
  'Full Adress': 'fullAddress', 'full adress': 'fullAddress',
  'Other Track': 'otherTrack',
};

const mapRowToStudent = (row, addedBy) => {
  // Normalize key: lowercase, remove dots/spaces
  const normalize = (s) => s.toLowerCase().replace(/[.\s]/g, '');
  const normalizedMap = {};
  Object.keys(fieldMap).forEach((k) => { normalizedMap[normalize(k)] = fieldMap[k]; });

  const student = { addedBy, status: 'Applied', formSource: 'manual' };
  Object.keys(row).forEach((key) => {
    const mapped = normalizedMap[normalize(key)];
    if (mapped) student[mapped] = String(row[key]).trim();
  });
  return student;
};


// Bulk upload via Excel
const bulkUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer', codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Get all rows as array of arrays (raw)
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find the header row (row that contains 'Name' or 'name')
  let headerRowIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some((cell) => String(cell).trim().toLowerCase() === 'name')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1)
    return res.status(400).json({ message: 'Header row not found. Make sure your file has a "Name" column.' });

  const headers = rawRows[headerRowIndex].map((h) => String(h).trim());
  const dataRows = rawRows.slice(headerRowIndex + 1);

  const rows = dataRows
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(row[i] ?? '').trim(); });
      return obj;
    });

  if (rows.length === 0)
    return res.status(400).json({ message: 'No data rows found after header.' });

  const students = rows.map((row) => mapRowToStudent(row, req.user._id));

  let insertedCount = 0;
  let skippedCount = 0;
  for (const student of students) {
    try {
      // Check duplicate by name + fatherName + mobileNo
      const query = { name: { $regex: `^${student.name}$`, $options: 'i' } };
      if (student.fatherName) query.fatherName = { $regex: `^${student.fatherName}$`, $options: 'i' };
      if (student.mobileNo) query.mobileNo = student.mobileNo;
      const exists = await Student.findOne(query);
      if (exists) { skippedCount++; continue; }
      const count = await Student.countDocuments();
      student.sn = count + 1;
      await Student.create(student);
      insertedCount++;
    } catch (err) {
      console.log('Row skip:', err.message, student);
    }
  }

  if (insertedCount === 0 && skippedCount > 0)
    return res.json({ message: `0 students uploaded. ${skippedCount} duplicate records skipped.` });

  if (insertedCount === 0)
    return res.status(400).json({ message: 'No rows could be saved. Check your file format.' });

  res.json({ message: `${insertedCount} students uploaded successfully${skippedCount ? `, ${skippedCount} duplicates skipped` : ''}.` });
};

// Export students to Excel
const exportStudents = async (req, res) => {
  try {
    const { ids } = req.body; // array of IDs, empty = export all (with current filters)
    const { track, status, search } = req.query;

    let students;
    if (ids && ids.length > 0) {
      students = await Student.find({ _id: { $in: ids } }).populate('addedBy', 'name');
    } else {
      const filter = {};
      if (req.user.role === 'track_incharge') filter.track = { $regex: `^${req.user.track}$`, $options: 'i' };
      else if (track) filter.track = { $regex: `^${track}$`, $options: 'i' };
      if (status === 'Disabled') filter.isDisabled = true;
      else { filter.isDisabled = { $ne: true }; if (status) filter.status = status; }
      if (search) filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { mobileNo: { $regex: search, $options: 'i' } },
      ];
      students = await Student.find(filter).populate('addedBy', 'name').sort({ sn: 1 });
    }

    const rows = students.map((s, i) => ({
      'S.N.':             i + 1,
      'Name':             s.name || '',
      'Father Name':      s.fatherName || '',
      'Track':            s.track || '',
      'Mobile No':        s.mobileNo || '',
      'WhatsApp No':      s.whatsappNo || '',
      'Subject':          s.subject || '',
      'Full Address':     s.fullAddress || '',
      'Other Track':      s.otherTrack || '',
      'Status':           s.status || '',
      'Remarks':          s.remarks || '',
      'Added By':         s.addedBy?.name || '',
      'Added On':         s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    ws['!cols'] = [6, 22, 22, 14, 14, 14, 12, 30, 14, 12, 30, 16, 14].map((w) => ({ wch: w }));
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Filename: date + student name (single export) ya "all"
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;
    const namePart = (ids && ids.length === 1)
      ? `_${students[0].name.replace(/[^a-zA-Z0-9]/g, '_')}`
      : '';
    const filename = `students_export_${dateStr}${namePart}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Download Excel template
const downloadTemplate = (req, res) => {
  const headers = [['S.N.', 'Name', 'Father Name', 'Track', 'Mob. no', 'Whatsapp no.', 'Subject', 'Full Adress', 'Other Track']];
  const sampleRows = [
    [1, 'Ali Ahmed', 'Ahmed Khan', 'Harda', '9876543210', '9876543210', 'Science', 'Village Harda, MP', ''],
    [2, 'Sara Begum', 'Mohd Raza', 'Nemawar', '9123456789', '9123456789', 'Arts', 'Village Nemawar, MP', ''],
  ];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([...headers, ...sampleRows]);
  ws['!cols'] = [8, 20, 20, 14, 14, 14, 14, 30, 14].map((w) => ({ wch: w }));
  xlsx.utils.book_append_sheet(wb, ws, 'Students');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=students_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

// Track Dashboard stats (track_incharge ka apna track)
const getTrackStats = async (req, res) => {
  try {
    const Target = require('../models/Target');
    const track = req.user.track;
    if (!track) return res.status(400).json({ message: 'No track assigned' });

    const filter = { track };
    const [total, applied, admitted, rejected] = await Promise.all([
      Student.countDocuments(filter),
      Student.countDocuments({ ...filter, status: 'Applied' }),
      Student.countDocuments({ ...filter, status: 'Admitted' }),
      Student.countDocuments({ ...filter, status: 'Rejected' }),
    ]);

    const disabled = await Student.countDocuments({ track, isDisabled: true });

    const subjectAdmitted = await Student.aggregate([
      { $match: { track, status: 'Admitted' } },
      { $group: { _id: '$subject', admitted: { $sum: 1 } } },
    ]);

    const targets = await Target.find({ track });
    const subjectMap = {};
    targets.forEach(({ subject, target }) => {
      subjectMap[subject] = { target, admitted: 0 };
    });
    subjectAdmitted.forEach(({ _id, admitted }) => {
      if (!subjectMap[_id]) subjectMap[_id] = { target: 0, admitted: 0 };
      subjectMap[_id].admitted = admitted;
    });

    const subjects = Object.entries(subjectMap).map(([subject, data]) => ({ subject, ...data }));
    const TrackPoints = require('../models/TrackPoints');
    const trackPoints = await TrackPoints.findOne({ track });

    // Status-wise breakdown
    const statusBreakdown = await Student.aggregate([
      { $match: { track } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Funnel-wise breakdown with points earned
    const FUNNEL_POINTS_MAP = {
      'Call Completed': 5, 'Lead Interested': 10,
      'Admission Closed': 100,
    };
    const funnelBreakdown = await Student.aggregate([
      { $match: { track, funnelStage: { $ne: '' }, funnelStage: { $exists: true } } },
      { $group: { _id: '$funnelStage', count: { $sum: 1 } } },
    ]);
    const funnelData = funnelBreakdown.map(({ _id, count }) => ({
      stage: _id,
      count,
      pointsPerStudent: FUNNEL_POINTS_MAP[_id] || 0,
      totalPoints: count * (FUNNEL_POINTS_MAP[_id] || 0),
    }));

    // Calling points breakdown
    const callingCount = await Student.countDocuments({ track, callingPointsAwarded: true });

    res.json({
      track, total, applied, admitted, rejected, disabled, subjects,
      points: trackPoints?.points || 0,
      statusBreakdown: statusBreakdown.map(({ _id, count }) => ({ status: _id, count })),
      funnelBreakdown: funnelData,
      callingPointsCount: callingCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dashboard stats
const getStats = async (req, res) => {
  try {
    const Target = require('../models/Target');
    const total = await Student.countDocuments();
    const applied = await Student.countDocuments({ status: 'Applied' });
    const admitted = await Student.countDocuments({ status: 'Admitted' });
    const rejected = await Student.countDocuments({ status: 'Rejected' });
    const disabled = await Student.countDocuments({ isDisabled: true });
    const unassigned = await Student.countDocuments({ $or: [{ track: '' }, { track: null }, { track: { $exists: false } }] });

    const trackSubjectAdmitted = await Student.aggregate([
      { $match: { status: 'Admitted' } },
      { $group: { _id: { track: '$track', subject: '$subject' }, admitted: { $sum: 1 } } },
    ]);

    const targets = await Target.find({});

    const trackMap = {};
    targets.forEach(({ track, subject, target }) => {
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
      trackMap[track].subjects[subject] = { target, admitted: 0 };
    });

    trackSubjectAdmitted.forEach(({ _id, admitted }) => {
      const { track, subject } = _id;
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
      if (!trackMap[track].subjects[subject]) trackMap[track].subjects[subject] = { target: 0, admitted: 0 };
      trackMap[track].subjects[subject].admitted = admitted;
    });

    const TrackPoints = require('../models/TrackPoints');
    const trackPointsDocs = await TrackPoints.find({});
    const pointsMap = {};
    trackPointsDocs.forEach(({ track, points }) => {
      pointsMap[track] = points || 0;
    });

    Object.keys(pointsMap).forEach((track) => {
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
    });

    const trackWise = Object.entries(trackMap).map(([track, { subjects }]) => ({
      track,
      subjects: Object.entries(subjects).map(([subject, data]) => ({ subject, ...data })),
      points: pointsMap[track] || 0,
    }));

    // B.Tech branch-wise admitted count (priority1 field)
    const btechBranches = await Student.aggregate([
      { $match: { status: 'Admitted', formSource: 'btech', priority1: { $nin: [null, ''] } } },
      { $group: { _id: '$priority1', admitted: { $sum: 1 } } },
    ]);
    const btechByBranch = {};
    btechBranches.forEach(({ _id, admitted }) => { btechByBranch[_id] = admitted; });

    res.json({ total, applied, admitted, rejected, disabled, unassigned, trackWise, btechByBranch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Self-registration from external forms (webhook — secured by secret)
const selfRegister = async (req, res) => {
  // Verify webhook secret
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET)
    return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { formSource, firstName, lastName, fathersName, mobile, email, whatsappNumber, address, ...rest } = req.body;

    if (!firstName || !mobile || !email)
      return res.status(400).json({ message: 'firstName, mobile, email are required' });

    const validSources = ['btech', 'ssism'];
    const resolvedSource = validSources.includes(formSource) ? formSource : null;

    // Duplicate check by mobile or email
    const existing = await Student.findOne({ $or: [{ mobileNo: String(mobile) }, { email }] });
    if (existing) return res.status(409).json({ message: 'Already registered', id: existing._id });

    const count = await Student.countDocuments();
    const student = await Student.create({
      sn: count + 1,
      name: `${firstName} ${lastName || ''}`.trim(),
      fatherName: fathersName || '',
      mobileNo: String(mobile),
      whatsappNo: whatsappNumber || rest.whatsappNo || '',
      fullAddress: address || rest.fullAddress || '',
      email,
      formSource: resolvedSource,
      status: 'Applied',
      ...rest,
    });
    res.status(201).json({ message: 'Registration successful', id: student._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, getStatusHistory, bulkUpload, downloadTemplate, exportStudents, getStats, getTrackStats, selfRegister };

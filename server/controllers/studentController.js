const Student = require('../models/Student');
const User = require('../models/User');
const xlsx = require('xlsx');

// Get all students (admin/manager = all, track_incharge = own track)
const getStudents = async (req, res) => {
  const { track, status, search, page = 1, limit = 10 } = req.query;
  const filter = {};
  const _limit = Number(limit);
  const _page = Number(page);

  if (req.user.role === 'track_incharge') filter.track = { $regex: `^${req.user.track}$`, $options: 'i' };
  else if (track) filter.track = { $regex: `^${track}$`, $options: 'i' };

  // by default disabled profiles exclude — only show if status=Disabled explicitly requested
  if (status === 'Disabled') filter.isDisabled = true;
  else { filter.isDisabled = { $ne: true }; if (status) filter.status = status; }
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { fatherName: { $regex: search, $options: 'i' } },
    { mobileNo: { $regex: search, $options: 'i' } },
    { subject: { $regex: search, $options: 'i' } },
    { track: { $regex: search, $options: 'i' } },
  ];

  const total = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .populate('addedBy', 'name role')
    .sort({ sn: 1, createdAt: 1 })
    .skip((_page - 1) * _limit)
    .limit(_limit);

  res.json({ students, total, page: _page, pages: Math.ceil(total / _limit) });
};

// Get single student
const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).populate('addedBy', 'name role');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });
  res.json(student);
};

const DOCS = ['photo', 'marksheet10th', 'marksheet12th', 'incomeCertificate', 'jaatiPraman', 'abcId', 'aadharCard'];

// Add student manually
const addStudent = async (req, res) => {
  const count = await Student.countDocuments();
  const data = { ...req.body, sn: count + 1, addedBy: req.user._id };
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
  'Visit Scheduled': 20,
  'Visit Completed': 30,
  'Admission Closed': 100,
};

const ALLOWED_FUNNEL = {
  'Calling':  ['Call Completed', 'Lead Interested'],
  'Verified': ['Visit Scheduled', 'Visit Completed'],
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

  // Subject admission points
  if (prevStatus !== 'Admitted' && updates.status === 'Admitted' && updates.subject)
    pointsDelta += getSubjectPoints(updated.track, updates.subject);
  if (prevStatus === 'Admitted' && updates.status !== 'Admitted' && student.subject)
    pointsDelta -= getSubjectPoints(student.track, student.subject);

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

  if (pointsDelta !== 0 && updated.track) {
    const TrackPoints = require('../models/TrackPoints');
    await TrackPoints.findOneAndUpdate(
      { track: updated.track },
      { $inc: { points: pointsDelta } },
      { upsert: true, new: true }
    );
  }

  // Save to status history if status or funnelStage changed
  const StatusHistory = require('../models/StatusHistory');
  if (updates.status !== prevStatus || newFunnel !== prevFunnel || updates.remarks) {
    await StatusHistory.create({
      student: req.params.id,
      status: updated.status,
      funnelStage: newFunnel,
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

  const student = { addedBy, status: 'Applied' };
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
    res.setHeader('Content-Disposition', `attachment; filename=students_export_${Date.now()}.xlsx`);
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
    const [total, applied, verified, admitted, rejected] = await Promise.all([
      Student.countDocuments(filter),
      Student.countDocuments({ ...filter, status: 'Applied' }),
      Student.countDocuments({ ...filter, status: 'Verified' }),
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
      'Visit Scheduled': 20, 'Visit Completed': 30, 'Admission Closed': 100,
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
      track, total, applied, verified, admitted, rejected, disabled, subjects,
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
    const verified = await Student.countDocuments({ status: 'Verified' });
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

    res.json({ total, applied, verified, admitted, rejected, disabled, unassigned, trackWise });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, getStatusHistory, bulkUpload, downloadTemplate, exportStudents, getStats, getTrackStats };

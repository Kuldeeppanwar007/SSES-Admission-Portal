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

const TOWN_TO_MAIN_TRACK = {
  'harda':        'Harda',
  'timarni':      'Harda',
  'seoni malwa':  'Harda',
  'seoni malav':  'Harda',
  'khategaon':    'Khategaon',
  'nemawar':      'Khategaon',
  'rehti':        'Rehti',
  'gopalpur':     'Rehti',
  'bherunda':     'Rehti',
  'satwas':       'Satwas & Kannod',
  'kannod':       'Satwas & Kannod',
};

// Town string se main track resolve karo
const resolveMainTrack = (track) => {
  if (!track) return track;
  const key = track.toLowerCase().trim();
  return TOWN_TO_MAIN_TRACK[key] || track;
};

// Target model se points fetch karo (main track + subject)
const getSubjectPoints = async (track, subject) => {
  const Target = require('../models/Target');
  const mainTrack = resolveMainTrack(track);
  const t = await Target.findOne({ track: mainTrack, subject });
  return t?.points || 0;
};

const FUNNEL_POINTS = {
  'Call Completed':  5,
  'Lead Interested': 10,
  // 'Admission Closed' ke points ab Target model se aayenge (per subject)
};

// Funnel points get karo — Admission Closed ke liye Target se, baaki hardcoded
const getFunnelPoints = async (funnelStage, track, subject) => {
  if (funnelStage === 'Admission Closed') {
    // Target model mein 'Admission Closed' subject ke liye points check karo
    // Agar nahi mila to 100 default
    const Target = require('../models/Target');
    const mainTrack = resolveMainTrack(track);
    const t = await Target.findOne({ track: mainTrack, subject: 'Admission Closed' });
    return t?.points ?? 100;
  }
  return FUNNEL_POINTS[funnelStage] || 0;
};

const ALLOWED_FUNNEL = {
  'Calling':  ['Call Completed', 'Lead Interested'],
  'Admitted': ['Admission Closed'],
};

// Calling points — flat 5 pts per student (ek baar), leaderboard efficiency se rank hoga
const CALLING_POINTS_PER_STUDENT = 5;

// Update student
const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });

  const prevStatus = student.status;
  const prevFunnel = student.funnelStage || '';
  const prevTrack  = student.track || '';

  // Whitelist — sirf allowed fields accept karo, raw req.body directly use mat karo
  const ALLOWED_FIELDS = ['status', 'remarks', 'funnelStage', 'subject',
    'name', 'fatherName', 'track', 'mobileNo', 'whatsappNo', 'fullAddress', 'otherTrack',
    'formSource', 'email', 'schoolName', 'district', 'village', 'whatsappNumber',
    'priority1', 'priority2', 'priority3', 'jeeScore', 'persentage12', 'persentage10',
    'persentage11', 'branch', 'year', 'joinBatch', 'feesScheme', 'category', 'gender',
    'school12Sub', 'dob', 'aadharNo', 'fatherOccupation', 'fatherIncome',
    'fatherContactNumber', 'pincode', 'tehsil', 'trackName',
  ];
  const updates = {};
  ALLOWED_FIELDS.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

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
      pointsDelta -= await getFunnelPoints(prevFunnel, prevTrack, student.subject);
      await Student.findByIdAndUpdate(req.params.id, { $pull: { awardedFunnelStages: prevFunnel } });
      updates.funnelStage = '';
    }
  }
  if (updates.status === 'Disabled') updates.isDisabled = true;
  else if (updates.status && updates.status !== 'Disabled') updates.isDisabled = false;
  DOCS.forEach((d) => { if (req.files?.[d]) updates[d] = req.files[d][0].path; });
  const updated = await Student.findByIdAndUpdate(req.params.id, updates, { new: true });

  const newTrack = resolveMainTrack(updated.track || '');
  const prevMainTrack = resolveMainTrack(prevTrack);
  const trackChanged = updates.track && resolveMainTrack(updates.track) !== prevMainTrack;
  const TrackPoints = require('../models/TrackPoints');

  // Track change hone par — purane track se sab points hataao, naye track mein daalo
  if (trackChanged && prevMainTrack && newTrack) {
    // Admission points
    if (prevStatus === 'Admitted' || effectiveStatus === 'Admitted') {
      const subject = updated.subject || student.subject;
      if (subject) {
        const prevPts = await getSubjectPoints(prevMainTrack, subject);
        const newPts  = await getSubjectPoints(newTrack, subject);
        await TrackPoints.findOneAndUpdate({ track: prevMainTrack }, { $inc: { points: -prevPts } }, { upsert: true });
        await TrackPoints.findOneAndUpdate({ track: newTrack },      { $inc: { points:  newPts  } }, { upsert: true });
      }
    }

    // Funnel points migrate
    const awardedFunnels = updated.awardedFunnelStages || [];
    if (awardedFunnels.length > 0) {
      const funnelTotal = awardedFunnels.reduce((sum, f) => sum + (FUNNEL_POINTS[f] || 0), 0);
      if (funnelTotal > 0) {
        await TrackPoints.findOneAndUpdate({ track: prevMainTrack }, { $inc: { points: -funnelTotal } }, { upsert: true });
        await TrackPoints.findOneAndUpdate({ track: newTrack },      { $inc: { points:  funnelTotal } }, { upsert: true });
      }
    }

    // Calling points migrate
    if (updated.callingPointsAwarded) {
      await TrackPoints.findOneAndUpdate({ track: prevMainTrack }, { $inc: { points: -CALLING_POINTS_PER_STUDENT } }, { upsert: true });
      await TrackPoints.findOneAndUpdate({ track: newTrack },      { $inc: { points:  CALLING_POINTS_PER_STUDENT } }, { upsert: true });
    }

    pointsDelta = 0;
  } else {
    // Normal (track nahi badla) — existing logic
    const newFunnel = updates.funnelStage !== undefined ? updates.funnelStage : prevFunnel;
    const awardedFunnelStages = student.awardedFunnelStages || [];

    // Subject admission points — status Admitted ho ya subject change ho Admitted state mein
    const becomingAdmitted = prevStatus !== 'Admitted' && effectiveStatus === 'Admitted';
    const leavingAdmitted  = prevStatus === 'Admitted' && effectiveStatus !== 'Admitted';
    const subjectForPoints = updates.subject || student.subject;

    if (becomingAdmitted && subjectForPoints)
      pointsDelta += await getSubjectPoints(newTrack, subjectForPoints);
    if (leavingAdmitted && student.subject)
      pointsDelta -= await getSubjectPoints(newTrack, student.subject);

  // Funnel stage points — sirf ek baar per stage per student
    // NOTE: becomingAdmitted ke saath bhi funnel check karo — dono ek saath aa sakte hain
    const effectiveFunnel = updates.funnelStage !== undefined ? updates.funnelStage : prevFunnel;
    if (effectiveFunnel && effectiveFunnel !== prevFunnel && !awardedFunnelStages.includes(effectiveFunnel)) {
      pointsDelta += await getFunnelPoints(effectiveFunnel, newTrack || prevMainTrack, subjectForPoints);
      await Student.findByIdAndUpdate(req.params.id, { $addToSet: { awardedFunnelStages: effectiveFunnel } });
    }

    // Calling status remark points — sirf ek baar per student, flat 5 pts
    if (updates.status === 'Calling' && updates.remarks && updates.remarks.trim() && !student.callingPointsAwarded) {
      pointsDelta += CALLING_POINTS_PER_STUDENT;
      await Student.findByIdAndUpdate(req.params.id, { callingPointsAwarded: true });
    }

    const trackForPoints = newTrack || prevMainTrack;
    if (pointsDelta !== 0 && trackForPoints) {
      await TrackPoints.findOneAndUpdate(
        { track: trackForPoints },
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
    pointsDelta += await getSubjectPoints(student.track, student.subject);
  if (prevStatus === 'Admitted' && status !== 'Admitted' && student.subject)
    pointsDelta -= await getSubjectPoints(student.track, student.subject);
  if (pointsDelta !== 0 && student.track) {
    const mainTrack = resolveMainTrack(student.track);
    await TrackPoints.findOneAndUpdate(
      { track: mainTrack },
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
  const normalize = (s) => s.toLowerCase().replace(/[.\s]/g, '');
  const normalizedMap = {};
  Object.keys(fieldMap).forEach((k) => { normalizedMap[normalize(k)] = fieldMap[k]; });

  const student = { addedBy, status: 'Applied', formSource: 'manual' };
  Object.keys(row).forEach((key) => {
    const mapped = normalizedMap[normalize(key)];
    if (mapped) student[mapped] = String(row[key]).trim();
  });

  // Excel me jo bhi track likha ho (satwas, kannod, harda etc.) — resolve karke valid track set karo
  if (student.track) student.track = resolveMainTrack(student.track);

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

    // Calling points breakdown + efficiency
    const callingCount = await Student.countDocuments({ track, callingPointsAwarded: true });
    const totalActive  = await Student.countDocuments({ track, isDisabled: { $ne: true } });
    const callingEfficiency = totalActive > 0 ? Math.round((callingCount / totalActive) * 100) : 0;

    res.json({
      track, total, applied, admitted, rejected, disabled, subjects,
      points: trackPoints?.points || 0,
      statusBreakdown: statusBreakdown.map(({ _id, count }) => ({ status: _id, count })),
      funnelBreakdown: funnelData,
      callingPointsCount: callingCount,
      callingEfficiency,
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
    const pointsPerSubject = {}; // track -> subject -> points per admission
    targets.forEach(({ track, subject, target, points: pts }) => {
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
      trackMap[track].subjects[subject] = { target, admitted: 0 };
      if (!pointsPerSubject[track]) pointsPerSubject[track] = {};
      pointsPerSubject[track][subject] = pts || 0;
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

    // Har track ki calling efficiency calculate karo
    const callingData = await Student.aggregate([
      { $match: { isDisabled: { $ne: true } } },
      { $group: {
        _id: '$track',
        total: { $sum: 1 },
        called: { $sum: { $cond: ['$callingPointsAwarded', 1, 0] } },
      }},
    ]);
    const callingMap = {};
    callingData.forEach(({ _id, total, called }) => {
      callingMap[_id] = { calledCount: called, totalCount: total, efficiency: total > 0 ? Math.round((called / total) * 100) : 0 };
    });

    // Funnel points per track — awardedFunnelStages se calculate karo
    const funnelData = await Student.aggregate([
      { $match: { awardedFunnelStages: { $exists: true, $ne: [] } } },
      { $unwind: '$awardedFunnelStages' },
      { $group: { _id: { track: '$track', stage: '$awardedFunnelStages' }, count: { $sum: 1 } } },
    ]);
    const FUNNEL_PTS = { 'Call Completed': 5, 'Lead Interested': 10, 'Admission Closed': 100 };
    const funnelPointsMap = {}; // track -> total funnel points
    funnelData.forEach(({ _id: { track, stage }, count }) => {
      funnelPointsMap[track] = (funnelPointsMap[track] || 0) + count * (FUNNEL_PTS[stage] || 0);
    });

    const trackWise = Object.entries(trackMap).map(([track, { subjects }]) => {
      const admissionPoints = Object.entries(subjects).reduce((sum, [subject, { admitted }]) => {
        return sum + (admitted || 0) * (pointsPerSubject[track]?.[subject] || 0);
      }, 0);
      const callingPoints = (callingMap[track]?.calledCount || 0) * 5;
      const funnelPoints  = funnelPointsMap[track] || 0;
      return ({
        track,
        subjects: Object.entries(subjects).map(([subject, data]) => ({ subject, ...data })),
        points: pointsMap[track] || 0,
        admissionPoints,
        callingPoints,
        funnelPoints,
        calledCount:       callingMap[track]?.calledCount  || 0,
        totalCount:        callingMap[track]?.totalCount   || 0,
        callingEfficiency: callingMap[track]?.efficiency   || 0,
      });
    });

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

// Town → Track mapping
const TOWN_TO_TRACK = {
  'harda':       { track: 'Harda',           trackName: 'Harda' },
  'timarni':     { track: 'Harda',           trackName: 'Timarni' },
  'seoni malwa': { track: 'Harda',           trackName: 'Seoni Malwa' },
  'seoni malav': { track: 'Harda',           trackName: 'Seoni Malwa' },
  'khategaon':   { track: 'Khategaon',       trackName: 'Khategaon' },
  'nemawar':     { track: 'Khategaon',       trackName: 'Nemawar' },
  'gopalpur':    { track: 'Rehti',           trackName: 'Gopalpur' },
  'bherunda':    { track: 'Rehti',           trackName: 'Bherunda' },
  'rehti':       { track: 'Rehti',           trackName: 'Rehti' },
  'kannod':      { track: 'Satwas & Kannod', trackName: 'Kannod' },
  'satwas':      { track: 'Satwas & Kannod', trackName: 'Satwas' },
};

const resolveTrack = (trackName, village) => {
  const candidates = [trackName, village].filter(Boolean);
  for (const val of candidates) {
    const key = String(val).toLowerCase().trim();
    if (TOWN_TO_TRACK[key]) return TOWN_TO_TRACK[key];
    // partial match
    const found = Object.keys(TOWN_TO_TRACK).find(k => key.includes(k) || k.includes(key));
    if (found) return TOWN_TO_TRACK[found];
  }
  return null;
};

// Self-registration from external forms (webhook — secured by secret)
const selfRegister = async (req, res) => {
  // Verify webhook secret — header se ya body ke prkey se
  const secret = req.headers['x-webhook-secret'] || req.body.prkey;
  if (!secret || secret !== process.env.WEBHOOK_SECRET)
    return res.status(401).json({ message: 'Unauthorized' });

  try {
    const {
      formSource, firstName, lastName, fathersName, mobile, email,
      whatsappNumber, address,
      // SSISM form ke actual field names (central DB se aate hain)
      fatherName: fatherNameAlt,
      fathersName: fathersNameAlt,
      fatherContactNumber, parentMobile,
      course, branch: branchField,
      percent10, persentage10: persentage10Field,
      percent12, persentage12: persentage12Field,
      persentage11,
      stream, school12Sub: school12SubField,
      subject12, schoolName, trackName: trackNameField,
      track: trackField,
      joinBatch, year,
      regFees, tutionFee, fatherIncome,
      rollNumber10, rollNumber12,
      sRank, linkSource, photo,
      isTop20, prkey,
      accRegFeesStatus, applicationTyp, applicationType, createdBy,
      locationURL, payMode, paymentRequired, batch,
      village, district, tehsil, pincode,
      category, gender, dob, aadharNo, feesScheme,
      priority1, priority2, priority3,
      jeeScore,
      ...rest
    } = req.body;

    if (!firstName || !mobile)
      return res.status(400).json({ message: 'firstName and mobile are required' });

    const validSources = ['btech', 'ssism'];
    const resolvedSource = validSources.includes(formSource) ? formSource : null;

    const orConditions = [{ mobileNo: String(mobile) }];
    if (email) orConditions.push({ email });
    const existing = await Student.findOne({ $or: orConditions });
    if (existing) return res.status(409).json({ message: 'Already registered', id: existing._id });

    const count = await Student.countDocuments();

    // trackName — central DB 'trackName' ya 'track' field se aata hai (town name hota hai)
    const resolvedTrackNameRaw = trackNameField || trackField || '';
    const mapped = resolveTrack(resolvedTrackNameRaw, village);
    const resolvedTrack         = mapped?.track     || '';
    const resolvedTrackNameFinal= mapped?.trackName || resolvedTrackNameRaw || '';

    const student = await Student.create({
      sn:          count + 1,
      name:        `${firstName} ${lastName || ''}`.trim(),
      fatherName:  fathersName || fathersNameAlt || fatherNameAlt || '',
      mobileNo:    String(mobile),
      whatsappNo:  whatsappNumber || '',
      fullAddress: address || '',
      email:       email  || '',
      formSource:  resolvedSource,
      status:      'Applied',
      track:       resolvedTrack,
      trackName:   resolvedTrackNameFinal,
      village:     village    || '',
      district:    district   || '',
      tehsil:      tehsil     || '',
      category:    category   || '',
      gender:      gender     || '',
      dob:         dob        || '',
      aadharNo:    aadharNo   || '',
      feesScheme:  feesScheme || '',
      schoolName:  schoolName || '',
      branch:      branchField || course || '',
      school12Sub: school12SubField || stream || subject12 || '',
      fatherContactNumber: fatherContactNumber || parentMobile || '',
      linkSource:  linkSource || '',
      sRank:       sRank      || '',
      applicationType:  applicationType || applicationTyp || '',
      accRegFeesStatus: accRegFeesStatus || '',
      locationURL:      locationURL || '',
      payMode:          payMode || '',
      paymentRequired:  paymentRequired != null ? Boolean(paymentRequired) : null,
      persentage10: Number(persentage10Field || percent10)  || null,
      persentage11: persentage11 ? String(persentage11) : null,
      persentage12: Number(persentage12Field || percent12)  || null,
      rollNumber10: Number(rollNumber10) || null,
      rollNumber12: Number(rollNumber12) || null,
      jeeScore:     Number(jeeScore)     || null,
      fatherIncome: Number(fatherIncome) || null,
      regFees:      Number(regFees)      || null,
      joinBatch:    Number(joinBatch || year) || null,
      pincode:      Number(pincode)      || null,
      isTop20:      Boolean(Number(isTop20)),
      ...(priority1 && { priority1 }),
      ...(priority2 && { priority2 }),
      ...(priority3 && { priority3 }),
    });
    res.status(201).json({ message: 'Registration successful', id: student._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, getStatusHistory, bulkUpload, downloadTemplate, exportStudents, getStats, getTrackStats, selfRegister };

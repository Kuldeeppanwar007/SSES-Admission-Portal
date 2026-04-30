const Student = require('../models/Student');
const User = require('../models/User');
const xlsx = require('xlsx');
const { sendPriorityAlert } = require('../utils/mailer');

// Branch normalization map — duplicate/alias values ko ek canonical name pe map karo
const BRANCH_NORMALIZE = {
  'ai/ml':         'B.Tech(AIML)',
  'b.tech(ai/ml)': 'B.Tech(AIML)',
  'aiml':          'B.Tech(AIML)',
  'b.tech(aiml)':  'B.Tech(AIML)',
  'cs':            'B.Tech(CS)',
  'b.tech(cs)':    'B.Tech(CS)',
  'it':            'B.Tech(IT)',
  'b.tech(it)':    'B.Tech(IT)',
  'b.tech(ece)':   'B.Tech(ECE)',
  'ece':           'B.Tech(ECE)',
  'bca(iteg)':     'BCA',
  'bca':           'BCA',
  'bsc(micro)':    'BSC(MICRO)',
  'bsc(bt)':       'BSC(BT)',
  'b.com(ca)':     'B.com(CA)',
  'bba':           'BBA',
  'iteg diploma':  'ITEG Diploma',
};

const normalizeBranch = (val) => {
  if (!val) return null;
  const key = val.trim().toLowerCase();
  return BRANCH_NORMALIZE[key] || val.trim();
};

// Get all students (admin/manager = all, track_incharge = own track)
const getStudents = async (req, res) => {
  try {
    const { track, town, status, search, formSource, interviewFilter, page = 1, limit = 20 } = req.query;
    const filter = {};
    const _limit = Math.min(Number(limit), 50); // Increased default limit
    const _page = Number(page);

    // Optimize track filter
    if (req.user.role === 'track_incharge') {
      filter.track = req.user.track; // Exact match instead of regex
    } else if (track) {
      filter.track = track; // Exact match instead of regex
    }
    
    // Add town filter
    if (town) {
      filter.$or = [
        { trackName: { $regex: `^${town}$`, $options: 'i' } },
        { village: { $regex: `^${town}$`, $options: 'i' } }
      ];
    }

    // Optimize status filter
    if (req.query.shiftCentral === 'true') {
      filter.isDisabled = { $ne: true };
      filter['finalInterview.result'] = 'Pass';
      filter.status = 'Admitted';
      filter.shiftedToCentral = { $ne: true };
    } else if (req.query.shiftedStudents === 'true') {
      filter.isDisabled = { $ne: true };
      filter.shiftedToCentral = true;
    } else if (status === 'Disabled') {
      filter.isDisabled = true;
    } else {
      filter.isDisabled = { $ne: true };
      if (status) filter.status = status;
    }

    if (formSource) filter.formSource = formSource;

    // Village filter
    if (req.query.village) filter.village = { $regex: `^${req.query.village.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };

    // Branch filter — normalized values ke saath branch ya priority1 dono check karo
    if (req.query.branch) {
      // Sab aliases jo is normalized value se map hote hain
      const selectedNorm = req.query.branch.trim().toLowerCase();
      const aliases = Object.entries(BRANCH_NORMALIZE)
        .filter(([, v]) => v.toLowerCase() === selectedNorm || v === req.query.branch)
        .map(([k]) => k);
      // Original raw values jo is normalized value se match karti hain
      const rawMatches = [...new Set([
        req.query.branch,
        ...aliases,
        ...Object.entries(BRANCH_NORMALIZE)
          .filter(([, v]) => v === req.query.branch)
          .map(([k]) => k),
      ])];
      const branchOr = rawMatches.map(v => ({
        $or: [
          { branch: { $regex: `^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { priority1: { $regex: `^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        ]
      }));
      const branchCondition = { $or: branchOr.flatMap(x => x.$or) };
      if (filter.$or) {
        filter.$and = [...(filter.$and || []), { $or: filter.$or }, branchCondition];
        delete filter.$or;
      } else if (filter.$and) {
        filter.$and.push(branchCondition);
      } else {
        Object.assign(filter, branchCondition);
      }
    }

    // Funnel stage filter
    if (req.query.funnelStage) filter.funnelStage = req.query.funnelStage;

    // Admission type filter
    if (req.query.admissionType) filter.admissionType = req.query.admissionType;

    // Subject filter (dashboard capacity cards se)
    if (req.query.subjectFilter) filter.subject = req.query.subjectFilter;

    // School filter
    if (req.query.schoolName) filter.schoolName = { $regex: `^${req.query.schoolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };

    // Optimize interview filter
    if (interviewFilter === 'finalCleared') {
      filter['finalInterview.result'] = 'Pass';
      if (req.query.subjectFilter) {
        const sf = req.query.subjectFilter;
        const SUBJECT_TO_BRANCHES = {
          'BCA':           ['BCA', 'BCA(ITEG)'],
          'BBA':           ['BBA'],
          'Bio':           ['Bio', 'BSC(BT)', 'BSC(Bt)', 'Biology'],
          'Micro':         ['Micro', 'BSC(MICRO)'],
          'Bcom':          ['Bcom', 'B.com(CA)', 'B.COM(CA)'],
          'ITEG Diploma':  ['ITEG Diploma'],
          'B.Tech(CS)':    ['B.Tech(CS)', 'CS'],
          'B.Tech(IT)':    ['B.Tech(IT)', 'IT'],
          'B.Tech(ECE)':   ['B.Tech(ECE)', 'ECE'],
          'B.Tech(AI/ML)': ['B.Tech(AI/ML)', 'AI/ML', 'AIML'],
        };
        const aliases = SUBJECT_TO_BRANCHES[sf] || [sf];
        // Sirf branch se filter karo — subject ignore
        filter.branch = { $in: aliases };
        delete filter.subject;
        if (filter.$and) {
          filter.$and = filter.$and.filter(c => !c.$or || !c.$or.some(x => x.subject));
        }
      }
    } else if (interviewFilter === 'hasAttempts') {
      const Interview = require('../models/Interview');
      const studentIdsWithInterviews = await Interview.distinct('student');
      filter._id = { $in: studentIdsWithInterviews };
      filter['finalInterview.result'] = { $ne: 'Pass' };
    } else if (interviewFilter?.startsWith('round_')) {
      const round = Number(interviewFilter.split('_')[1]);
      const Interview = require('../models/Interview');
      // Sirf wahi students jinka last (max) round = N ho
      const lastRoundAgg = await Interview.aggregate([
        { $group: { _id: '$student', lastRound: { $max: '$round' } } },
        { $match: { lastRound: round } },
      ]);
      const studentIds = lastRoundAgg.map(x => x._id);
      filter._id = { $in: studentIds };
      filter['finalInterview.result'] = { $ne: 'Pass' };
    }

    // Optimize search with text index
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { fatherName: { $regex: safeSearch, $options: 'i' } },
        { mobileNo: { $regex: safeSearch, $options: 'i' } },
        { track: { $regex: safeSearch, $options: 'i' } },
        { remarks: { $regex: safeSearch, $options: 'i' } },
        { receiptNo: { $regex: safeSearch, $options: 'i' } },
      ];
      
      if (filter.$or) {
        filter.$and = [...(filter.$and || []), { $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else if (filter.$and) {
        filter.$and.push({ $or: searchConditions });
      } else {
        filter.$or = searchConditions;
      }
    }

    // Use Promise.all for parallel execution
    const [total, students] = await Promise.all([
      Student.countDocuments(filter),
      Student.find(filter)
        .select('name fatherName track trackName village mobileNo formSource status finalInterview createdAt isTopper isPriority branch remarks shiftedAt') // Select only needed fields
        .populate('addedBy', 'name')
        .sort({ createdAt: -1 })
        .skip((_page - 1) * _limit)
        .limit(_limit)
        .lean() // Use lean for better performance
    ]);

    // Optimize interview count query
    const Interview = require('../models/Interview');
    const ids = students.map(s => s._id);
    const counts = await Interview.aggregate([
      { $match: { student: { $in: ids } } },
      { $group: { _id: '$student', count: { $sum: 1 } } },
    ]);
    
    const countMap = new Map();
    counts.forEach(({ _id, count }) => countMap.set(_id.toString(), count));
    
    const studentsWithCount = students.map(s => ({
      ...s,
      interviewCount: countMap.get(s._id.toString()) || 0,
    }));

    res.json({ 
      students: studentsWithCount, 
      total, 
      page: _page, 
      pages: Math.ceil(total / _limit),
      hasMore: _page < Math.ceil(total / _limit)
    });
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
  'sandalpur':    'Khategaon',
  'rehti':        'Rehti',
  'gopalpur':     'Rehti',
  'bherunda':     'Rehti',
  'nasrullaganj': 'Rehti',
  'narmadapuram': 'Rehti',
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
  // 'Call Completed':  5,
  // 'Lead Interested': 10,
  // 'Call Not Received': 5,
  // 'Wrong Number':    5,
  // 'Switch Off':      5,
  // 'Admission Closed' ke points ab Target model se aayenge (per subject)
};

// Naye calling stages jo sirf remark ke saath points denge
// const CALLING_ONLY_STAGES = ['Call Not Received', 'Wrong Number', 'Switch Off'];

// Funnel points get karo — sirf Admission Closed ke liye Target se
const getFunnelPoints = async (funnelStage, track, subject) => {
  if (funnelStage === 'Admission Closed') {
    const Target = require('../models/Target');
    const mainTrack = resolveMainTrack(track);
    const t = await Target.findOne({ track: mainTrack, subject: 'Admission Closed' });
    return t?.points ?? 100;
  }
  // Calling funnel stages ke points disabled hain
  return 0;
};

const ALLOWED_FUNNEL = {
  'Calling':  ['Call Completed', 'Lead Interested', 'Call Not Received', 'Wrong Number', 'Switch Off'],
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
  const ALLOWED_FIELDS = ['status', 'remarks', 'funnelStage', 'subject', 'admissionType',
    'name', 'fatherName', 'track', 'mobileNo', 'whatsappNo', 'fullAddress', 'otherTrack',
    'formSource', 'email', 'schoolName', 'district', 'village', 'whatsappNumber',
    'jeeScore', 'persentage12', 'persentage10',
    'persentage11', 'branch', 'year', 'joinBatch', 'feesScheme', 'category', 'gender',
    'school12Sub', 'dob', 'aadharNo', 'fatherOccupation', 'fatherIncome',
    'fatherContactNumber', 'pincode', 'tehsil', 'trackName', 'isTopper', 'isPriority',
    'bookNo', 'receiptNo',
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

    // Funnel points migrate (calling stage points disabled hain, sirf Admission Closed migrate hoga)
    // const awardedFunnels = updated.awardedFunnelStages || [];
    // if (awardedFunnels.length > 0) {
    //   const funnelTotal = awardedFunnels.reduce((sum, f) => sum + (FUNNEL_POINTS[f] || 0), 0);
    //   if (funnelTotal > 0) {
    //     await TrackPoints.findOneAndUpdate({ track: prevMainTrack }, { $inc: { points: -funnelTotal } }, { upsert: true });
    //     await TrackPoints.findOneAndUpdate({ track: newTrack },      { $inc: { points:  funnelTotal } }, { upsert: true });
    //   }
    // }

    // Calling points migrate — disabled (callingPointsAwarded ab award nahi hota)
    // if (updated.callingPointsAwarded) {
    //   await TrackPoints.findOneAndUpdate({ track: prevMainTrack }, { $inc: { points: -CALLING_POINTS_PER_STUDENT } }, { upsert: true });
    //   await TrackPoints.findOneAndUpdate({ track: newTrack },      { $inc: { points:  CALLING_POINTS_PER_STUDENT } }, { upsert: true });
    // }

    pointsDelta = 0;
  } else {
    // Normal (track nahi badla) — existing logic
    const awardedFunnelStages = student.awardedFunnelStages || [];

    // Subject admission points — status Admitted ho ya subject change ho Admitted state mein
    const becomingAdmitted = prevStatus !== 'Admitted' && effectiveStatus === 'Admitted';
    const leavingAdmitted  = prevStatus === 'Admitted' && effectiveStatus !== 'Admitted';
    const subjectForPoints = updates.subject || student.subject;

    if (becomingAdmitted && subjectForPoints)
      pointsDelta += await getSubjectPoints(newTrack, subjectForPoints);
    if (leavingAdmitted && student.subject)
      pointsDelta -= await getSubjectPoints(newTrack, student.subject);

  // Funnel stage points — ek time pe sirf ek active stage
    const effectiveFunnel = updates.funnelStage !== undefined ? updates.funnelStage : prevFunnel;
    if (effectiveFunnel !== prevFunnel) {
      // Purani stage ke points revert karo
      if (prevFunnel && awardedFunnelStages.includes(prevFunnel)) {
        const prevFunnelPts = await getFunnelPoints(prevFunnel, newTrack || prevMainTrack, subjectForPoints);
        pointsDelta -= prevFunnelPts;
        await Student.findByIdAndUpdate(req.params.id, { $pull: { awardedFunnelStages: prevFunnel } });
      }
      // Nayi stage ke points add karo
      if (effectiveFunnel) {
        pointsDelta += await getFunnelPoints(effectiveFunnel, newTrack || prevMainTrack, subjectForPoints);
        await Student.findByIdAndUpdate(req.params.id, { $addToSet: { awardedFunnelStages: effectiveFunnel } });
      }
    }

    // Calling status remark points — sirf ek baar per student, flat 5 pts
    // if (updates.status === 'Calling' && updates.remarks && updates.remarks.trim() && !student.callingPointsAwarded) {
    //   pointsDelta += CALLING_POINTS_PER_STUDENT;
    //   await Student.findByIdAndUpdate(req.params.id, { callingPointsAwarded: true });
    // }

    const trackForPoints = newTrack || prevMainTrack;
    if (pointsDelta !== 0 && trackForPoints) {
      await TrackPoints.findOneAndUpdate(
        { track: trackForPoints },
        { $inc: { points: pointsDelta } },
        { upsert: true, new: true }
      );
    }
  }

  // Save to status history if anything changed
  const StatusHistory = require('../models/StatusHistory');
  const currentFunnel = updated.funnelStage || '';

  // Track which fields changed
  const TRACKED_FIELDS = ['name', 'fatherName', 'mobileNo', 'whatsappNo', 'track', 'subject',
    'fullAddress', 'otherTrack', 'status', 'funnelStage', 'remarks', 'email', 'schoolName',
    'district', 'village', 'branch', 'category', 'gender', 'trackName'];

  const changedFields = TRACKED_FIELDS
    .filter(f => updates[f] !== undefined && String(updates[f]) !== String(student[f] ?? ''))
    .map(f => ({ field: f, oldValue: String(student[f] ?? ''), newValue: String(updates[f]) }));

  if (changedFields.length > 0) {
    await StatusHistory.create({
      student: req.params.id,
      status: updated.status,
      funnelStage: currentFunnel,
      remarks: updates.remarks || '',
      changedBy: req.user._id,
      changedFields,
    });
  }

  // Priority flag true hone par track ke sabhi users ko mail bhejo
  if (updates.isPriority === true && !student.isPriority && updated.track) {
    try {
      const trackUsers = await User.find({ track: updated.track, isActive: true }).select('email').lean();
      const emails = trackUsers.map(u => u.email).filter(Boolean);
      if (emails.length > 0) {
        await sendPriorityAlert({
          studentName: updated.name,
          fatherName:  updated.fatherName,
          track:       updated.track,
          mobileNo:    updated.mobileNo,
          subject:     updated.subject,
          status:      updated.status,
          recipients:  emails,
        });
      }
    } catch (mailErr) {
      console.error('Priority mail error:', mailErr.message);
    }
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
  const filter = { student: req.params.id };
  if (req.user.role === 'track_incharge') filter['changedBy'] = req.user._id;
  const history = await StatusHistory.find(filter)
    .populate('changedBy', 'name role')
    .sort({ createdAt: -1 });
  res.json(history);
};

// Get all activity history (for Activity Log page)
const getActivityLog = async (req, res) => {
  try {
    const StatusHistory = require('../models/StatusHistory');
    const { from, to, userId } = req.query;
    const filter = { 'changedFields.0': { $exists: true } };

    if (req.user.role === 'track_incharge') {
      const trackUsers = await User.find({ track: req.user.track, role: 'track_incharge' }).select('_id');
      filter.changedBy = { $in: trackUsers.map(u => u._id) };
    } else if (userId) {
      filter.changedBy = userId;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }

    // Logs — limit 500 for feed display
    const history = await StatusHistory.find(filter)
      .populate('changedBy', 'name role track')
      .populate('student', 'name track')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Stats — aggregate WITHOUT limit so all records are counted
    const statsFilter = { 'changedFields.0': { $exists: true } };
    if (req.user.role === 'track_incharge') {
      const trackUsers = await User.find({ track: req.user.track, role: 'track_incharge' }).select('_id');
      statsFilter.changedBy = { $in: trackUsers.map(u => u._id) };
    } else if (userId) {
      statsFilter.changedBy = require('mongoose').Types.ObjectId.createFromHexString(userId);
    }
    if (from || to) {
      statsFilter.createdAt = {};
      if (from) statsFilter.createdAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); statsFilter.createdAt.$lte = d; }
    }

    const statsAgg = await StatusHistory.aggregate([
      { $match: statsFilter },
      { $unwind: '$changedFields' },
      {
        $group: {
          _id: '$changedBy',
          totalUpdates:  { $addToSet: '$_id' },
          statusChanges: { $sum: { $cond: [{ $eq: ['$changedFields.field', 'status'] }, 1, 0] } },
          funnelChanges: { $sum: { $cond: [{ $eq: ['$changedFields.field', 'funnelStage'] }, 1, 0] } },
          remarksAdded:  { $sum: { $cond: [{ $and: [{ $eq: ['$changedFields.field', 'remarks'] }, { $gt: ['$changedFields.newValue', ''] }] }, 1, 0] } },
          // Unique students jinka status Calling set hua
          calledStudents: {
            $addToSet: {
              $cond: [
                { $and: [{ $eq: ['$changedFields.field', 'status'] }, { $eq: ['$changedFields.newValue', 'Calling'] }] },
                '$student',
                null
              ]
            }
          },
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId:        { $toString: '$_id' },
          name:          '$user.name',
          role:          '$user.role',
          track:         '$user.track',
          totalUpdates:  { $size: '$totalUpdates' },
          statusChanges: 1,
          funnelChanges: 1,
          remarksAdded:  1,
          // null values hata ke unique called students count karo
          callingUpdates: {
            $size: {
              $filter: { input: '$calledStudents', as: 'x', cond: { $ne: ['$$x', null] } }
            }
          },
        }
      },
      { $sort: { totalUpdates: -1 } }
    ]);

    res.json({ logs: history, stats: statsAgg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const fieldMap = {
  // Serial Number variations
  'S.N.': 'sn', 'SN': 'sn', 'Sr No': 'sn', 'S.N': 'sn', 'Serial': 'sn', 'Sr.': 'sn',
  'S.No.': 'sn', 'S No': 'sn', 'SNo': 'sn', // Added S.No. variations
  
  // Name variations
  'Name': 'name', 'Student Name': 'name', 'name': 'name', 'NAME': 'name',
  'Student': 'name', 'Full Name': 'name',
  
  // Father Name variations
  'Father Name': 'fatherName', "Father's Name": 'fatherName', 'father name': 'fatherName',
  'FATHER NAME': 'fatherName', 'Father': 'fatherName', 'Papa Name': 'fatherName',
  'FatherName': 'fatherName', 'Fathers Name': 'fatherName',
  
  // Track variations
  'Track': 'track', 'track': 'track', 'TRACK': 'track', 'Location': 'track',
  'Area': 'track', 'Region': 'track',
  
  // Mobile variations
  'Mob. No': 'mobileNo', 'Mobile': 'mobileNo', 'Mobile No': 'mobileNo',
  'Mob. no': 'mobileNo', 'Mob. No.': 'mobileNo', 'mob. no': 'mobileNo',
  'Mob No.': 'mobileNo', 'Mob No': 'mobileNo', 'mob no': 'mobileNo', 'mob no.': 'mobileNo',
  'mobile': 'mobileNo', 'MOBILE': 'mobileNo', 'Phone': 'mobileNo', 'Contact': 'mobileNo',
  'Mobile Number': 'mobileNo', 'Phone Number': 'mobileNo',
  
  // WhatsApp variations
  'Whatsapp No': 'whatsappNo', 'WhatsApp': 'whatsappNo', 'Whatsapp no.': 'whatsappNo',
  'Whatsapp No.': 'whatsappNo', 'whatsapp no.': 'whatsappNo', 'Whatsapp No': 'whatsappNo',
  'WhatsApp No': 'whatsappNo', 'WhatsApp Number': 'whatsappNo', 'WA No': 'whatsappNo',
  
  // Subject variations
  'Subject': 'subject', 'subject': 'subject', 'SUBJECT': 'subject',
  'Stream': 'subject', 'Course': 'subject',
  
  // Address variations
  'Full Address': 'fullAddress', 'Address': 'fullAddress', 'address': 'fullAddress',
  'Full Adress': 'fullAddress', 'full adress': 'fullAddress', 'ADDRESS': 'fullAddress',
  'Village': 'fullAddress', 'Location Address': 'fullAddress',
  
  // School variations
  'School': 'schoolName', 'School Name': 'schoolName', 'school': 'schoolName',
  'SCHOOL': 'schoolName', 'College': 'schoolName', 'Institute': 'schoolName',
  
  // Other Track variations
  'Other Track': 'otherTrack', 'other track': 'otherTrack', 'Alternative Track': 'otherTrack',
};

const mapRowToStudent = (row, addedBy) => {
  const normalize = (s) => s.toLowerCase().replace(/[.\s]/g, '');
  const normalizedMap = {};
  Object.keys(fieldMap).forEach((k) => { normalizedMap[normalize(k)] = fieldMap[k]; });

  const student = { addedBy, status: 'Applied', formSource: 'manual' };
  
  // Debug: Log the row headers to see what we're working with
  console.log('Processing row with headers:', Object.keys(row));
  
  Object.keys(row).forEach((key) => {
    const mapped = normalizedMap[normalize(key)];
    if (mapped) {
      const value = String(row[key]).trim();
      if (value && value !== '') {
        student[mapped] = value;
        console.log(`Mapped: ${key} -> ${mapped} = ${value}`);
      }
    } else {
      console.log(`Unmapped column: ${key}`);
    }
  });

  // Validate critical fields
  if (!student.name || student.name.trim() === '') {
    console.log('Warning: No name found in row:', row);
  }

  // Handle track mapping logic
  if (student.track) {
    const originalTrackFromSheet = student.track;
    const mainTracks = ['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'];
    
    // Check if sheet track name exactly matches one of the 4 main tracks
    if (mainTracks.includes(originalTrackFromSheet)) {
      // Exact match - keep as is and also set as trackName
      student.track = originalTrackFromSheet;
      student.trackName = originalTrackFromSheet; // Also set in town field
    } else {
      // Not exact match - resolve to main track and move original to trackName
      const resolvedMainTrack = resolveMainTrack(originalTrackFromSheet);
      student.trackName = originalTrackFromSheet; // Original goes to town field
      student.track = resolvedMainTrack; // Main track goes to track field
    }
  }

  return student;
};


// Bulk upload via Excel or CSV
const bulkUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
  let rows = [];

  try {
    if (fileExtension === 'csv') {
      // Handle CSV file
      const csvData = req.file.buffer.toString('utf8');
      const lines = csvData.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return res.status(400).json({ message: 'CSV file is empty' });
      }

      // Find header row (contains 'Name' or 'name')
      let headerRowIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const cells = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
        if (cells.some(cell => cell.toLowerCase() === 'name')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return res.status(400).json({ message: 'Header row not found. Make sure your CSV has a "Name" column.' });
      }

      const headers = lines[headerRowIndex].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(headerRowIndex + 1);

      rows = dataLines.map(line => {
        const cells = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = cells[index] || '';
        });
        return obj;
      }).filter(row => Object.values(row).some(val => val.trim() !== ''));

    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      // Handle Excel file (existing logic)
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

      rows = dataRows
        .filter((row) => row.some((cell) => String(cell).trim() !== ''))
        .map((row) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = String(row[i] ?? '').trim(); });
          return obj;
        });
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV (.csv) file.' });
    }

    if (rows.length === 0)
      return res.status(400).json({ message: 'No data rows found after header.' });

    const students = rows.map((row) => mapRowToStudent(row, req.user._id));

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    console.log(`Processing ${students.length} students from ${fileExtension.toUpperCase()} file...`);
    
    for (const [index, student] of students.entries()) {
      try {
        // Validate required field
        if (!student.name || student.name.trim() === '') {
          errorCount++;
          errors.push(`Row ${index + 1}: Name is required`);
          continue;
        }
        
        // Check for duplicate by name + father name combination
        let isDuplicate = false;
        if (student.name && student.fatherName) {
          // Both name and father name present - check combination
          const query = {
            name: { $regex: `^${student.name.trim()}$`, $options: 'i' },
            fatherName: { $regex: `^${student.fatherName.trim()}$`, $options: 'i' }
          };
          const exists = await Student.findOne(query);
          if (exists) {
            isDuplicate = true;
            console.log(`Duplicate found: ${student.name} - ${student.fatherName}`);
          }
        } else if (student.name && !student.fatherName) {
          // Only name present, no father name - check if exact same name with no father name exists
          const query = {
            name: { $regex: `^${student.name.trim()}$`, $options: 'i' },
            $or: [
              { fatherName: { $exists: false } },
              { fatherName: '' },
              { fatherName: null }
            ]
          };
          const exists = await Student.findOne(query);
          if (exists) {
            isDuplicate = true;
            console.log(`Duplicate found (no father name): ${student.name}`);
          }
        }
        
        if (isDuplicate) { 
          skippedCount++; 
          continue; 
        }
        
        const count = await Student.countDocuments();
        student.sn = count + 1;
        await Student.create(student);
        insertedCount++;
        
        if (insertedCount % 50 === 0) {
          console.log(`Processed ${insertedCount} students...`);
        }
      } catch (err) {
        errorCount++;
        errors.push(`Row ${index + 1} (${student.name || 'Unknown'}): ${err.message}`);
        console.log('Row error:', err.message, student);
      }
    }

    console.log(`Upload completed: ${insertedCount} inserted, ${skippedCount} skipped, ${errorCount} errors`);
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 10)); // Log first 10 errors
    }

    if (insertedCount === 0 && skippedCount > 0)
      return res.json({ 
        message: `0 students uploaded. ${skippedCount} duplicate records skipped.`,
        details: { inserted: insertedCount, skipped: skippedCount, errors: errorCount }
      });

    if (insertedCount === 0)
      return res.status(400).json({ 
        message: 'No rows could be saved. Check your file format.',
        details: { inserted: insertedCount, skipped: skippedCount, errors: errorCount },
        errorSamples: errors.slice(0, 5)
      });

    const responseMessage = `${insertedCount} students uploaded successfully${skippedCount ? `, ${skippedCount} duplicates skipped` : ''}${errorCount ? `, ${errorCount} errors` : ''}.`;
    
    res.json({ 
      message: responseMessage,
      details: { 
        inserted: insertedCount, 
        skipped: skippedCount, 
        errors: errorCount,
        totalProcessed: students.length
      },
      ...(errorCount > 0 && { errorSamples: errors.slice(0, 5) })
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ message: 'Error processing file: ' + err.message });
  }
};

// Export students to Excel
const exportStudents = async (req, res) => {
  try {
    const { ids } = req.body; // array of IDs, empty = export all (with current filters)
    const { track, town, status, search } = req.query;

    let students;
    if (ids && ids.length > 0) {
      students = await Student.find({ _id: { $in: ids } }).populate('addedBy', 'name');
    } else {
      const filter = {};
      if (req.user.role === 'track_incharge') filter.track = { $regex: `^${req.user.track}$`, $options: 'i' };
      else if (track) filter.track = { $regex: `^${track}$`, $options: 'i' };
      
      // Add town filter
      if (town) {
        filter.$or = [
          { trackName: { $regex: `^${town}$`, $options: 'i' } },
          { village: { $regex: `^${town}$`, $options: 'i' } }
        ];
      }
      
      if (status === 'Disabled') filter.isDisabled = true;
      else { filter.isDisabled = { $ne: true }; if (status) filter.status = status; }
      
      if (search) {
        const searchConditions = [
          { name: { $regex: search, $options: 'i' } },
          { fatherName: { $regex: search, $options: 'i' } },
          { mobileNo: { $regex: search, $options: 'i' } },
        ];
        
        if (filter.$or) {
          // If town filter exists, combine with search using $and
          filter.$and = [
            { $or: filter.$or }, // town filter
            { $or: searchConditions } // search filter
          ];
          delete filter.$or;
        } else {
          filter.$or = searchConditions;
        }
      }
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
      'School':           s.schoolName || '',
      'Full Address':     s.fullAddress || '',
      'Other Track':      s.otherTrack || '',
      'Status':           s.status || '',
      'Remarks':          s.remarks || '',
      'Added By':         s.addedBy?.name || '',
      'Added On':         s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    ws['!cols'] = [6, 22, 22, 14, 14, 14, 12, 20, 30, 14, 12, 30, 16, 14].map((w) => ({ wch: w }));
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
  const headers = [['S.N.', 'Name', 'Father Name', 'Track', 'Mob. no', 'Whatsapp no.', 'Subject', 'School', 'Full Adress', 'Other Track']];
  const sampleRows = [
    [1, 'Ali Ahmed', 'Ahmed Khan', 'Harda', '9876543210', '9876543210', 'Science', 'ABC High School', 'Village Harda, MP', ''],
    [2, 'Sara Begum', 'Mohd Raza', 'Sandalpur', '9123456789', '9123456789', 'Arts', 'XYZ School', 'Village Sandalpur, MP', ''],
    [3, 'Rahul Kumar', 'Suresh Kumar', 'Narmadapuram', '9876543211', '9876543211', 'Commerce', 'PQR College', 'Village Narmadapuram, MP', ''],
  ];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([...headers, ...sampleRows]);
  ws['!cols'] = [8, 20, 20, 14, 14, 14, 14, 20, 30, 14].map((w) => ({ wch: w }));
  xlsx.utils.book_append_sheet(wb, ws, 'Students');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=students_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

// Download CSV template
const downloadCSVTemplate = (req, res) => {
  const headers = ['S.N.', 'Name', 'Father Name', 'Track', 'Mob. no', 'Whatsapp no.', 'Subject', 'School', 'Full Adress', 'Other Track'];
  const sampleRows = [
    [1, 'Ali Ahmed', 'Ahmed Khan', 'Harda', '9876543210', '9876543210', 'Science', 'ABC High School', 'Village Harda, MP', ''],
    [2, 'Sara Begum', 'Mohd Raza', 'Sandalpur', '9123456789', '9123456789', 'Arts', 'XYZ School', 'Village Sandalpur, MP', ''],
    [3, 'Rahul Kumar', 'Suresh Kumar', 'Narmadapuram', '9876543211', '9876543211', 'Commerce', 'PQR College', 'Village Narmadapuram, MP', ''],
  ];
  
  const csvContent = [headers, ...sampleRows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  res.setHeader('Content-Disposition', 'attachment; filename=students_template.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csvContent);
};

// Track Dashboard stats (track_incharge ka apna track)
const getTrackStats = async (req, res) => {
  try {
    const Target = require('../models/Target');
    const track = req.user.role === 'admin' ? (req.query.track || req.user.track) : req.user.track;
    if (!track) return res.status(400).json({ message: 'No track assigned' });

    const filter = { track };
    const [total, applied, calling, admitted, rejected] = await Promise.all([
      Student.countDocuments(filter),
      Student.countDocuments({ ...filter, status: 'Applied' }),
      Student.countDocuments({ ...filter, status: 'Calling' }),
      Student.countDocuments({ ...filter, status: 'Admitted' }),
      Student.countDocuments({ ...filter, status: 'Rejected' }),
    ]);

    const disabled = await Student.countDocuments({ track, isDisabled: true });

    const BTECH_SUBJECTS_TRACK = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)'];
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
      const mapped = BTECH_SUBJECTS_TRACK.includes(_id) ? 'B.Tech' : _id;
      if (!subjectMap[mapped]) subjectMap[mapped] = { target: 0, admitted: 0 };
      subjectMap[mapped].admitted += admitted;
    });

    const subjects = Object.entries(subjectMap).map(([subject, data]) => ({ subject, ...data }));
    const TrackPoints = require('../models/TrackPoints');
    const trackPoints = await TrackPoints.findOne({ track });

    // Status-wise breakdown
    const statusBreakdown = await Student.aggregate([
      { $match: { track } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Funnel-wise breakdown — sirf Admission Closed ke points active hain
    const FUNNEL_POINTS_MAP = {
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
      track, total, applied, calling, admitted, rejected, disabled, subjects,
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
    const calling = await Student.countDocuments({ status: 'Calling' });
    const admitted = await Student.countDocuments({ status: 'Admitted' });
    const rejected = await Student.countDocuments({ status: 'Rejected' });
    const disabled = await Student.countDocuments({ isDisabled: true });
    const unassigned = await Student.countDocuments({ $or: [{ track: '' }, { track: null }, { track: { $exists: false } }] });

    const BTECH_SUBJECTS = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)'];

    const trackSubjectAdmitted = await Student.aggregate([
      { $match: { status: 'Admitted', admissionType: 'Full Fees' } },
      { $group: { _id: { track: '$track', subject: '$subject' }, admitted: { $sum: 1 } } },
    ]);

    // Capacity cards ke liye — sabhi admitted (all admission types)
    const allAdmittedBySubject = await Student.aggregate([
      { $match: { status: 'Admitted' } },
      { $group: { _id: '$subject', admitted: { $sum: 1 } } },
    ]);
    const admittedBySubjectMap = {};
    allAdmittedBySubject.forEach(({ _id, admitted }) => { if (_id) admittedBySubjectMap[_id] = admitted; });

    // B.Tech branch-wise admitted count — sabhi admitted
    const btechBranches = await Student.aggregate([
      { $match: { status: 'Admitted', subject: { $in: BTECH_SUBJECTS } } },
      { $group: { _id: '$subject', admitted: { $sum: 1 } } },
    ]);
    const btechByBranch = {};
    btechBranches.forEach(({ _id, admitted }) => { btechByBranch[_id] = admitted; });

    // SSISM capacity — trackWise subjects mein bhi sab admitted chahiye (capacity display ke liye)
    // trackWise subjects admitted count ko allAdmittedBySubject se override karo
    const allTrackSubjectAdmitted = await Student.aggregate([
      { $match: { status: 'Admitted' } },
      { $group: { _id: { track: '$track', subject: '$subject' }, admitted: { $sum: 1 } } },
    ]);
    const allTrackSubjectMap = {};
    allTrackSubjectAdmitted.forEach(({ _id, admitted }) => {
      const { track, subject } = _id;
      const mappedSubject = BTECH_SUBJECTS.includes(subject) ? 'B.Tech' : subject;
      if (!allTrackSubjectMap[track]) allTrackSubjectMap[track] = {};
      allTrackSubjectMap[track][mappedSubject] = (allTrackSubjectMap[track][mappedSubject] || 0) + admitted;
    });

    const targets = await Target.find({});

    const trackMap = {};
    const pointsPerSubject = {};
    targets.forEach(({ track, subject, target, points: pts }) => {
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
      trackMap[track].subjects[subject] = { target, admitted: 0 };
      if (!pointsPerSubject[track]) pointsPerSubject[track] = {};
      pointsPerSubject[track][subject] = pts || 0;
    });

    trackSubjectAdmitted.forEach(({ _id, admitted }) => {
      const { track, subject } = _id;
      // B.Tech ke 4 subjects ko 'B.Tech' ke under group karo
      const mappedSubject = BTECH_SUBJECTS.includes(subject) ? 'B.Tech' : subject;
      if (!trackMap[track]) trackMap[track] = { subjects: {} };
      if (!trackMap[track].subjects[mappedSubject]) trackMap[track].subjects[mappedSubject] = { target: trackMap[track].subjects[mappedSubject]?.target || 0, admitted: 0 };
      trackMap[track].subjects[mappedSubject].admitted += admitted;
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
        const pointsKey = BTECH_SUBJECTS.includes(subject) ? 'B.Tech' : subject;
        return sum + (admitted || 0) * (pointsPerSubject[track]?.[pointsKey] || 0);
      }, 0);
      const callingPoints = (callingMap[track]?.calledCount || 0) * 5;
      const funnelPoints  = funnelPointsMap[track] || 0;

      // fullFeesSubjects — Points Table ke liye sirf Full Fees admitted
      const fullFeesSubjects = Object.entries(subjects).map(([subject, data]) => ({
        subject,
        target: data.target,
        admitted: data.admitted || 0, // Full Fees only (trackSubjectAdmitted se)
      }));

      return ({
        track,
        // subjects mein all-admitted count use karo (capacity display ke liye)
        subjects: Object.entries(subjects).map(([subject, data]) => ({
          subject,
          target: data.target,
          admitted: allTrackSubjectMap[track]?.[subject] || 0,
        })),
        fullFeesSubjects,
        points: pointsMap[track] || 0,
        admissionPoints,
        callingPoints,
        funnelPoints,
        calledCount:       callingMap[track]?.calledCount  || 0,
        totalCount:        callingMap[track]?.totalCount   || 0,
        callingEfficiency: callingMap[track]?.efficiency   || 0,
      });
    });

    // B.Tech branch-wise admitted count (subject field se)
    // (already computed above in btechByBranch)

    // Final Cleared (interview pass) — subject-wise
    // branch field bhi check karo (SSISM students mein branch se normalize karo)
    const finalClearedRaw = await Student.find(
      { 'finalInterview.result': 'Pass', status: { $ne: 'Admitted' } },
      { subject: 1, branch: 1 }
    ).lean();
    const finalClearedBySubject = {};
    finalClearedRaw.forEach(({ subject, branch }) => {
      // Branch se resolve karo (primary), subject fallback
      const BRANCH_TO_CANONICAL = {
        'BCA': 'BCA', 'BCA(ITEG)': 'BCA',
        'BBA': 'BBA',
        'BSC(BT)': 'Bio', 'BSC(Bt)': 'Bio', 'Biology': 'Bio', 'Bio': 'Bio',
        'BSC(MICRO)': 'Micro', 'Micro': 'Micro',
        'B.com(CA)': 'Bcom', 'B.COM(CA)': 'Bcom', 'Bcom': 'Bcom',
        'ITEG Diploma': 'ITEG Diploma',
        'B.Tech(CS)': 'B.Tech(CS)', 'CS': 'B.Tech(CS)',
        'B.Tech(IT)': 'B.Tech(IT)', 'IT': 'B.Tech(IT)',
        'B.Tech(ECE)': 'B.Tech(ECE)', 'ECE': 'B.Tech(ECE)',
        'B.Tech(AI/ML)': 'B.Tech(AI/ML)', 'AI/ML': 'B.Tech(AI/ML)', 'AIML': 'B.Tech(AI/ML)',
      };
      // Branch se pehle resolve karo, warna subject se
      const resolved = (branch && BRANCH_TO_CANONICAL[branch]) || BRANCH_TO_CANONICAL[subject] || null;
      if (resolved) finalClearedBySubject[resolved] = (finalClearedBySubject[resolved] || 0) + 1;
    });

    // AdmissionType breakdown
    const admissionTypeData = await Student.aggregate([
      { $match: { status: 'Admitted', admissionType: { $nin: [null, ''] } } },
      { $group: { _id: '$admissionType', count: { $sum: 1 } } },
    ]);
    const admissionTypeBreakdown = {};
    admissionTypeData.forEach(({ _id, count }) => { admissionTypeBreakdown[_id] = count; });

    // Track-wise admission type breakdown (subject-wise)
    const trackAdmissionTypeData = await Student.aggregate([
      { $match: { status: 'Admitted', admissionType: { $in: ['SNS', 'SVS', 'Shri Ram'] } } },
      { $group: { _id: { track: '$track', admissionType: '$admissionType', subject: '$subject' }, count: { $sum: 1 } } },
    ]);
    // { track -> { admissionType -> { subject -> count } } }
    const trackAdmissionTypeBreakdown = {};
    trackAdmissionTypeData.forEach(({ _id: { track, admissionType, subject }, count }) => {
      if (!track) return;
      if (!trackAdmissionTypeBreakdown[track]) trackAdmissionTypeBreakdown[track] = {};
      if (!trackAdmissionTypeBreakdown[track][admissionType]) trackAdmissionTypeBreakdown[track][admissionType] = {};
      trackAdmissionTypeBreakdown[track][admissionType][subject || 'Unknown'] = count;
    });

    res.json({ total, applied, calling, admitted, rejected, disabled, unassigned, trackWise, btechByBranch, finalClearedBySubject, admissionTypeBreakdown, trackAdmissionTypeBreakdown });
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
  'sandalpur':   { track: 'Khategaon',       trackName: 'Sandalpur' },
  'gopalpur':    { track: 'Rehti',           trackName: 'Gopalpur' },
  'bherunda':    { track: 'Rehti',           trackName: 'Bherunda' },
  'nasrullaganj':{ track: 'Rehti',           trackName: 'Bherunda' },
  'rehti':       { track: 'Rehti',           trackName: 'Rehti' },
  'narmadapuram':{ track: 'Rehti',           trackName: 'Narmadapuram' },
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
  const secret = req.headers['x-webhook-secret'] || req.body.webhookSecret;
  if (secret && secret !== process.env.WEBHOOK_SECRET)
    return res.status(401).json({ message: 'Unauthorized' });
  // Agar koi secret nahi aaya — self-register open endpoint hai, allow karo

  try {
    const {
      formSource, firstName, lastName, fathersName, mobile, email,
      whatsappNumber, address,
      fatherName: fatherNameAlt,
      fathersName: fathersNameAlt,
      fatherContactNumber, parentMobile, parentMobil,
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

    // trackName — payload me 'track' ya 'trackName' field se aata hai (town name hota hai)
    const resolvedTrackNameRaw = trackNameField || trackField || '';
    const mainTracks = ['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'];
    
    let resolvedTrack = '';
    let resolvedTrackNameFinal = '';
    
    if (resolvedTrackNameRaw) {
      if (mainTracks.includes(resolvedTrackNameRaw)) {
        resolvedTrack = resolvedTrackNameRaw;
        resolvedTrackNameFinal = resolvedTrackNameRaw;
      } else {
        const mapped = resolveTrack(resolvedTrackNameRaw, village);
        resolvedTrack = mapped?.track || '';
        resolvedTrackNameFinal = mapped?.trackName || resolvedTrackNameRaw;
      }
    }

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
      branch:      branchField || course || priority1 || '',
      school12Sub: school12SubField || stream || subject12 || '',
      fatherContactNumber: fatherContactNumber || parentMobile || parentMobil || '',
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
      regFees:      Number(regFees || tutionFee) || null,
      joinBatch:    Number(joinBatch || year) || null,
      pincode:      Number(pincode)      || null,
      isTop20:      Boolean(Number(isTop20)),
      externalId:   prkey || null,
      ...(priority1 && { priority1 }),
      ...(priority2 && { priority2 }),
      ...(priority3 && { priority3 }),
    });
    res.status(201).json({ message: 'Registration successful', id: student._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Distinct village values
const getDistinctVillages = async (req, res) => {
  try {
    const filter = { village: { $nin: [null, ''] } };
    if (req.user.role === 'track_incharge') filter.track = req.user.track;
    const villages = await Student.distinct('village', filter);
    res.json(villages.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Distinct branch values
const getDistinctBranches = async (req, res) => {
  try {
    const branches = await Student.distinct('branch', { branch: { $nin: [null, ''] } });
    const priority1s = await Student.distinct('priority1', { priority1: { $nin: [null, ''] } });
    const normalized = [...new Set([...branches, ...priority1s].map(normalizeBranch).filter(Boolean))];
    res.json(normalized.sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Distinct school values
const getDistinctSchools = async (req, res) => {
  try {
    const filter = { schoolName: { $nin: [null, ''] } };
    if (req.user.role === 'track_incharge') filter.track = req.user.track;
    const schools = await Student.distinct('schoolName', filter);
    res.json(schools.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, getStatusHistory, getActivityLog, bulkUpload, downloadTemplate, downloadCSVTemplate, exportStudents, getStats, getTrackStats, selfRegister, getDistinctBranches, getDistinctVillages, getDistinctSchools };

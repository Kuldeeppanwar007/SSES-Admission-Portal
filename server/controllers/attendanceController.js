const Attendance = require('../models/Attendance');
const User = require('../models/User');

// POST /api/attendance/mark
const markAttendance = async (req, res) => {
  const { latitude, longitude, locationSource } = req.body;
  if (!latitude || !longitude)
    return res.status(400).json({ message: 'Location required' });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);

  const existing = await Attendance.findOne({ user: req.user._id, date });
  if (existing)
    return res.status(400).json({ message: 'Attendance already marked for today' });

  const record = await Attendance.create({
    user: req.user._id, date, time, latitude, longitude,
    locationSource: locationSource || 'Browser',
  });
  res.status(201).json(record);
};

// GET /api/attendance/my
const getMyAttendance = async (req, res) => {
  const records = await Attendance.find({ user: req.user._id }).sort({ date: -1 });
  res.json(records);
};

// GET /api/attendance/all?from=YYYY-MM-DD&to=YYYY-MM-DD&track=xxx
const getAllAttendance = async (req, res) => {
  const { from, to, track } = req.query;
  const query = {};

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to)   query.date.$lte = to;
  }

  let records = await Attendance.find(query)
    .populate('user', 'name track')
    .sort({ date: -1, time: -1 });

  if (track) records = records.filter(r => r.user?.track === track);

  res.json(records);
};

// GET /api/attendance/monthly-stats?month=YYYY-MM&track=xxx
// Returns per-user attendance count vs working days in that month
const getMonthlyStats = async (req, res) => {
  const { month, track } = req.query; // month = "2025-06"
  if (!month) return res.status(400).json({ message: 'month required (YYYY-MM)' });

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const from = `${month}-01`;
  const to   = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  // Get all track_incharge users
  const userQuery = { role: 'track_incharge', isActive: true };
  if (track) userQuery.track = track;
  const users = await User.find(userQuery).select('name track');

  // Get attendance records for the month
  const records = await Attendance.find({ date: { $gte: from, $lte: to } })
    .populate('user', 'name track');

  const stats = users.map(u => {
    const present = records.filter(r => r.user?._id?.toString() === u._id.toString()).length;
    const pct = Math.round((present / daysInMonth) * 100);
    return { userId: u._id, name: u.name, track: u.track, present, total: daysInMonth, pct };
  });

  res.json(stats);
};

module.exports = { markAttendance, getMyAttendance, getAllAttendance, getMonthlyStats };

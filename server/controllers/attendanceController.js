const Attendance = require('../models/Attendance');
const User = require('../models/User');
const LocationLog = require('../models/LocationLog');

// POST /api/attendance/location  (called by Android foreground service every hour)
const saveLocation = async (req, res) => {
  const { lat, lng, accuracy, timestamp, status } = req.body;

  // unavailable ping — location band thi
  if (status === 'unavailable') {
    await LocationLog.create({
      user: req.user._id,
      lat: null, lng: null,
      accuracy: -1,
      status: 'unavailable',
      timestamp: timestamp ? new Date(Number(timestamp)) : new Date(),
    });
    return res.status(201).json({ ok: true });
  }

  if (lat == null || lng == null) return res.status(400).json({ message: 'lat/lng required' });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return res.status(400).json({ message: 'Invalid coordinates' });

  await LocationLog.create({
    user: req.user._id,
    lat, lng,
    accuracy: accuracy ?? -1,
    status: 'ok',
    timestamp: timestamp ? new Date(Number(timestamp)) : new Date(),
  });
  res.status(201).json({ ok: true });
};

// GET /api/attendance/location-logs?userId=xxx&date=xxx  (admin)
const getLocationLogs = async (req, res) => {
  const { userId, date } = req.query;
  const query = {};
  if (userId) query.user = userId;
  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    query.timestamp = { $gte: start, $lte: end };
  }
  const logs = await LocationLog.find(query)
    .populate('user', 'name track')
    .sort({ timestamp: 1 });
  res.json(logs);
};

// POST /api/attendance/mark
const markAttendance = async (req, res) => {
  const { latitude, longitude, locationSource, accuracy } = req.body;
  if (!latitude || !longitude)
    return res.status(400).json({ message: 'Location required' });

  if (accuracy != null && accuracy > 100)
    return res.status(400).json({ message: 'Location accuracy too low. Move to open area and try again.' });

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    return res.status(400).json({ message: 'Invalid coordinates' });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);

  const existing = await Attendance.findOne({ user: req.user._id, date });
  if (existing)
    return res.status(400).json({ message: 'Attendance already marked for today' });

  // Option C: Block attendance if location was unavailable today (more unavailable than ok)
  const todayStart = new Date(date); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date); todayEnd.setHours(23, 59, 59, 999);
  const todayLogs = await LocationLog.find({
    user: req.user._id,
    timestamp: { $gte: todayStart, $lte: todayEnd },
  });
  if (todayLogs.length > 0) {
    const unavailableCount = todayLogs.filter(l => l.status === 'unavailable').length;
    const okCount = todayLogs.filter(l => l.status === 'ok').length;
    if (unavailableCount > okCount)
      return res.status(400).json({ message: 'Attendance blocked: Location was disabled for most of today. Please contact admin.' });
  }

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

module.exports = { markAttendance, getMyAttendance, getAllAttendance, getMonthlyStats, saveLocation, getLocationLogs };

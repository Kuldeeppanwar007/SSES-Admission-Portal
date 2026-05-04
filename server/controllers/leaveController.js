const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const User  = require('../models/User');

// POST /api/leaves  — leave mark karo
const markLeave = async (req, res) => {
  try {
    const { userId, date, reason } = req.body;
    if (!userId || !date) return res.status(400).json({ message: 'userId and date required' });

    const leave = await Leave.findOneAndUpdate(
      { user: userId, date },
      { user: userId, date, reason: reason || '', markedBy: req.user._id },
      { upsert: true, new: true }
    );

    // Agar us din attendance already mark hai toh delete karo
    const deleted = await Attendance.findOneAndDelete({ user: userId, date });

    res.status(201).json({ leave, attendanceRemoved: !!deleted });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/leaves  — leave hatao
const unmarkLeave = async (req, res) => {
  try {
    const { userId, date } = req.body;
    await Leave.deleteOne({ user: userId, date });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/leaves?date=YYYY-MM-DD&userId=xxx
const getLeaves = async (req, res) => {
  try {
    const query = {};
    if (req.query.date)   query.date = req.query.date;
    if (req.query.userId) query.user = req.query.userId;
    const leaves = await Leave.find(query)
      .populate('user', 'name track role')
      .populate('markedBy', 'name')
      .sort({ date: -1 });
    res.json(leaves);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { markLeave, unmarkLeave, getLeaves };

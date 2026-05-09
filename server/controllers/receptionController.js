const ReceptionEntry = require('../models/ReceptionEntry');
const User = require('../models/User');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getISTDateString = () =>
  new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

// GET /api/reception?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
const getEntries = async (req, res) => {
  try {
    const { date, from, to } = req.query;

    let start, end;
    if (from && to) {
      start = new Date(`${from}T00:00:00+05:30`);
      end   = new Date(`${to}T23:59:59.999+05:30`);
    } else {
      const d = date || getISTDateString();
      start = new Date(`${d}T00:00:00+05:30`);
      end   = new Date(`${d}T23:59:59.999+05:30`);
    }

    const TOWN_TO_TRACK = {
      'Harda': 'Harda', 'Timarni': 'Harda', 'Seoni Malwa': 'Harda',
      'Khategaon': 'Khategaon', 'Nemawar': 'Khategaon', 'Sandalpur': 'Khategaon',
      'Rehti': 'Rehti', 'Gopalpur': 'Rehti', 'Bherunda': 'Rehti', 'Narmadapuram': 'Rehti',
      'Satwas': 'Satwas & Kannod', 'Kannod': 'Satwas & Kannod',
    };

    const query = { date: { $gte: start, $lte: end } };
    if (req.user.role === 'track_incharge' && req.user.track) {
      const towns = Object.entries(TOWN_TO_TRACK)
        .filter(([, t]) => t === req.user.track).map(([town]) => town);
      query.town = { $in: towns };
    }

    const entries = await ReceptionEntry.find(query)
      .populate('enteredBy', 'name')
      .populate('interviewer', 'name')
      .populate('studentId', 'name')
      .sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reception/interviewers
const getInterviewers = async (req, res) => {
  try {
    const interviewers = await User.find({ role: 'interviewer', isActive: true })
      .select('_id name').sort({ name: 1 });
    res.json(interviewers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/reception — create new entry
const createEntry = async (req, res) => {
  try {
    const { date, town, admissionFormNo, visitPurpose, branch, interviewer, studentId } = req.body;
    if (!date || !town || !admissionFormNo || !visitPurpose)
      return res.status(400).json({ message: 'date, town, admissionFormNo aur visitPurpose required hain' });

    // Check: ye form no. kisi aur student ke saath already linked hai?
    const Student = require('../models/Student');
    const existingStudent = await Student.findOne({
      admissionFormNo,
      ...(studentId ? { _id: { $ne: studentId } } : {}),
    }).select('name');
    if (existingStudent) {
      return res.status(400).json({
        message: `Form No. ${admissionFormNo} already assigned to "${existingStudent.name}"`
      });
    }

    const entryDate = new Date(`${date}T00:00:00+05:30`);
    const entry = await ReceptionEntry.create({
      date: entryDate, town, admissionFormNo, visitPurpose,
      branch: branch || null,
      interviewer: interviewer || null,
      studentId: studentId || null,
      enteredBy: req.user._id,
    });

    // Student ke record mein admissionFormNo permanently save karo (sirf pehli baar)
    if (studentId) {
      await require('../models/Student').findOneAndUpdate(
        { _id: studentId, $or: [{ admissionFormNo: null }, { admissionFormNo: '' }, { admissionFormNo: { $exists: false } }] },
        { admissionFormNo }
      );
    }

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reception/by-student/:studentId — aaj ki latest entry by studentId
const getLatestByStudentId = async (req, res) => {
  try {
    const today = getISTDateString();
    const start = new Date(`${today}T00:00:00+05:30`);
    const end   = new Date(`${today}T23:59:59.999+05:30`);
    const entry = await ReceptionEntry.findOne({
      studentId: req.params.studentId,
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 }).select('visitPurpose admissionFormNo town branch');
    res.json(entry || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/reception/by-form/:formNo — aaj ki latest entry by admissionFormNo
const getLatestByFormNo = async (req, res) => {
  try {
    const today = getISTDateString();
    const start = new Date(`${today}T00:00:00+05:30`);
    const end   = new Date(`${today}T23:59:59.999+05:30`);
    const entry = await ReceptionEntry.findOne({
      admissionFormNo: req.params.formNo,
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 }).select('visitPurpose admissionFormNo town branch');
    res.json(entry || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getEntries, getInterviewers, createEntry, getLatestByFormNo, getLatestByStudentId };

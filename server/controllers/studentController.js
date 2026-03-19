const Student = require('../models/Student');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');

// Get all students (admin/manager = all, track_incharge = own track)
const getStudents = async (req, res) => {
  const { track, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'track_incharge') filter.track = req.user.track;
  else if (track) filter.track = track;

  if (status) filter.status = status;
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { fatherName: { $regex: search, $options: 'i' } },
    { mobileNo: { $regex: search, $options: 'i' } },
  ];

  const total = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .populate('addedBy', 'name role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ students, total, page: Number(page), pages: Math.ceil(total / limit) });
};

// Get single student
const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).populate('addedBy', 'name role');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });
  res.json(student);
};

// Add student manually
const addStudent = async (req, res) => {
  const data = { ...req.body, addedBy: req.user._id };
  if (req.files?.photo) data.photo = req.files.photo[0].path;
  if (req.files?.marksheet) data.marksheet = req.files.marksheet[0].path;
  const student = await Student.create(data);
  res.status(201).json(student);
};

// Update student
const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (req.user.role === 'track_incharge' && student.track !== req.user.track)
    return res.status(403).json({ message: 'Access denied' });

  const updates = { ...req.body };
  if (req.files?.photo) updates.photo = req.files.photo[0].path;
  if (req.files?.marksheet) updates.marksheet = req.files.marksheet[0].path;

  const updated = await Student.findByIdAndUpdate(req.params.id, updates, { new: true });
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
  const { status, remarks } = req.body;
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { status, remarks },
    { new: true }
  );
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json(student);
};

const fieldMap = {
  'S.N.': 'sn', 'SN': 'sn', 'Sr No': 'sn',
  'Name': 'name', 'Student Name': 'name',
  'Father Name': 'fatherName', "Father's Name": 'fatherName',
  'Track': 'track',
  'Mob. No': 'mobileNo', 'Mobile': 'mobileNo', 'Mobile No': 'mobileNo',
  'Whatsapp No': 'whatsappNo', 'WhatsApp': 'whatsappNo',
  'Subject': 'subject',
  'Full Address': 'fullAddress', 'Address': 'fullAddress',
  'Other Track': 'otherTrack',
};

const mapRowToStudent = (row, addedBy) => {
  const student = { addedBy, status: 'Applied' };
  Object.keys(row).forEach((key) => {
    const mapped = fieldMap[key.trim()];
    if (mapped) student[mapped] = String(row[key]).trim();
  });
  return student;
};

const parsePdfRows = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const students = [];
  // Expected PDF line format: SN Name FatherName Track Mobile Subject
  // Try to detect header line and parse accordingly
  let headers = [];
  for (const line of lines) {
    const cols = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);
    if (headers.length === 0) {
      // Detect header row
      const isHeader = cols.some((c) => /name|track|mobile|subject/i.test(c));
      if (isHeader) { headers = cols; continue; }
    } else {
      if (cols.length < 2) continue;
      const row = {};
      headers.forEach((h, i) => { if (cols[i]) row[h] = cols[i]; });
      students.push(row);
    }
  }
  return students;
};

// Bulk upload via Excel or PDF
const bulkUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const mime = req.file.mimetype;
  let rows = [];

  if (mime === 'application/pdf') {
    const parsed = await pdfParse(req.file.buffer);
    rows = parsePdfRows(parsed.text);
    if (rows.length === 0)
      return res.status(400).json({ message: 'No data found in PDF. Make sure PDF has tabular data with headers like Name, Father Name, Track, Mobile, Subject.' });
  } else {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  }

  const students = rows.map((row) => mapRowToStudent(row, req.user._id)).filter((s) => s.name);
  if (students.length === 0)
    return res.status(400).json({ message: 'No valid student records found. Check that Name column exists.' });

  const inserted = await Student.insertMany(students, { ordered: false });
  res.json({ message: `${inserted.length} students uploaded successfully` });
};

// Dashboard stats
const getStats = async (req, res) => {
  const filter = req.user.role === 'track_incharge' ? { track: req.user.track } : {};
  const total = await Student.countDocuments(filter);
  const applied = await Student.countDocuments({ ...filter, status: 'Applied' });
  const verified = await Student.countDocuments({ ...filter, status: 'Verified' });
  const admitted = await Student.countDocuments({ ...filter, status: 'Admitted' });
  const rejected = await Student.countDocuments({ ...filter, status: 'Rejected' });

  const trackWise = await Student.aggregate([
    { $match: filter },
    { $group: { _id: '$track', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({ total, applied, verified, admitted, rejected, trackWise });
};

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, bulkUpload, getStats };

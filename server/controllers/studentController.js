const Student = require('../models/Student');
const xlsx = require('xlsx');

// Get all students (admin/manager = all, track_incharge = own track)
const getStudents = async (req, res) => {
  const { track, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'track_incharge') filter.track = { $regex: `^${req.user.track}$`, $options: 'i' };
  else if (track) filter.track = { $regex: `^${track}$`, $options: 'i' };

  if (status) filter.status = status;
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

const DOCS = ['photo', 'marksheet10th', 'marksheet12th', 'incomeCertificate', 'jaatiPraman', 'abcId', 'aadharCard'];

// Add student manually
const addStudent = async (req, res) => {
  const count = await Student.countDocuments();
  const data = { ...req.body, sn: String(count + 1), addedBy: req.user._id };
  DOCS.forEach((d) => { if (req.files?.[d]) data[d] = req.files[d][0].path; });
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
  DOCS.forEach((d) => { if (req.files?.[d]) updates[d] = req.files[d][0].path; });
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
  'S.N.': 'sn', 'SN': 'sn', 'Sr No': 'sn', 'S.N': 'sn',
  'Name': 'name', 'Student Name': 'name',
  'Father Name': 'fatherName', "Father's Name": 'fatherName',
  'Track': 'track',
  'Mob. No': 'mobileNo', 'Mobile': 'mobileNo', 'Mobile No': 'mobileNo',
  'Mob. no': 'mobileNo', 'Mob. No.': 'mobileNo', 'mob. no': 'mobileNo',
  'Whatsapp No': 'whatsappNo', 'WhatsApp': 'whatsappNo', 'Whatsapp no.': 'whatsappNo',
  'Whatsapp No.': 'whatsappNo', 'whatsapp no.': 'whatsappNo',
  'Subject': 'subject',
  'Full Address': 'fullAddress', 'Address': 'fullAddress',
  'Full Adress': 'fullAddress', 'full adress': 'fullAddress',
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
      student.sn = String(count + 1);
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

module.exports = { getStudents, getStudent, addStudent, updateStudent, deleteStudent, updateStatus, bulkUpload, downloadTemplate, getStats };

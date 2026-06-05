const Student = require('../models/Student');
const { sendToCentral, sendBulkToCentral } = require('../utils/centralSync');

// Single student central ko bhejo
const syncSingleStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ success: false, shiftedToCentral: false, message: 'Student not found' });

    if (student.status !== 'Admitted')
      return res.status(400).json({ success: false, shiftedToCentral: false, message: 'Sirf Admitted students ko central bheja ja sakta hai' });

    if (!['btech', 'ssism'].includes(student.formSource))
      return res.status(400).json({ success: false, shiftedToCentral: false, message: 'Sirf btech ya ssism formSource wale students bheje ja sakte hain' });

    const result = await sendToCentral(student);

    if (!result.success) {
      // Missing fields — admin ko batao kaunse fields bharne hain
      if (result.reason === 'MISSING_FIELDS') {
        return res.status(400).json({
          success: false,
          shiftedToCentral: false,
          reason: 'MISSING_FIELDS',
          message: `Central sync failed — ye required fields missing hain: ${result.missingFields.join(', ')}`,
          missingFields: result.missingFields,
        });
      }

      // Duplicate — Central mein already exists
      if (result.reason === 'DUPLICATE') {
        return res.status(409).json({
          success: false,
          shiftedToCentral: false,
          reason: 'DUPLICATE',
          message: result.error || 'Student already exists in Central',
        });
      }

      // Validation error from Central
      if (result.reason === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          shiftedToCentral: false,
          reason: 'VALIDATION_ERROR',
          message: `Central validation error: ${result.error}`,
        });
      }

      // Any other error
      return res.status(400).json({
        success: false,
        shiftedToCentral: false,
        reason: result.reason || 'API_ERROR',
        message: `Central sync failed: ${result.error || 'Unknown error'}`,
      });
    }

    // shiftedToCentral flag set karo
    await Student.findByIdAndUpdate(req.params.id, { shiftedToCentral: true, shiftedAt: new Date() });

    res.json({ success: true, shiftedToCentral: true, message: 'Student successfully sent to central', data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, shiftedToCentral: false, message: err.message });
  }
};

// Bulk students central ko bhejo
const syncBulkStudents = async (req, res) => {
  try {
    const { ids } = req.body; // optional — agar nahi diya toh saare eligible students

    let filter = {
      status: 'Admitted',
      formSource: { $in: ['btech', 'ssism'] },
    };

    if (ids && ids.length > 0) {
      filter._id = { $in: ids };
    }

    const students = await Student.find(filter).lean();

    if (students.length === 0)
      return res.status(400).json({ message: 'Koi eligible student nahi mila (Admitted + btech/ssism)' });

    const results = await sendBulkToCentral(students);

    // Successfully sent students ka flag update karo
    if (results.success.length > 0) {
      const successIds = results.success.map(s => s.id);
      await Student.updateMany(
        { _id: { $in: successIds } },
        { shiftedToCentral: true, shiftedAt: new Date() }
      );
    }

    res.json({
      message: `${results.success.length} students sent, ${results.failed.length} failed`,
      success: results.success.length,
      failed: results.failed.length,
      failedDetails: results.failed,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Eligible students list — jo central bheje ja sakte hain
const getEligibleStudents = async (req, res) => {
  try {
    const { onlyPending, search, track } = req.query;

    const filter = {
      status: 'Admitted',
      formSource: { $in: ['btech', 'ssism'] },
    };

    if (onlyPending === '1') filter.shiftedToCentral = { $ne: true };

    // Track filter
    if (track) filter.track = track;

    // Search filter — name, fatherName, mobileNo
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { fatherName: regex },
        { mobileNo: regex },
      ];
    }

    const students = await Student.find(filter)
      .select('name fatherName mobileNo formSource track shiftedToCentral shiftedAt branch priority1 subject')
      .lean();

    res.json({ students, total: students.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { syncSingleStudent, syncBulkStudents, getEligibleStudents };

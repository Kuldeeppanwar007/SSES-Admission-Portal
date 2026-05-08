const Student = require('../models/Student');
const { sendToCentral, sendBulkToCentral } = require('../utils/centralSync');

// Single student central ko bhejo
const syncSingleStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (student.status !== 'Admitted')
      return res.status(400).json({ message: 'Sirf Admitted students ko central bheja ja sakta hai' });

    if (!['btech', 'ssism'].includes(student.formSource))
      return res.status(400).json({ message: 'Sirf btech ya ssism formSource wale students bheje ja sakte hain' });

    const result = await sendToCentral(student);

    // shiftedToCentral flag set karo
    await Student.findByIdAndUpdate(req.params.id, { shiftedToCentral: true, shiftedAt: new Date() });

    res.json({ message: 'Student successfully sent to central', result });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    const { onlyPending } = req.query; // onlyPending=1 — sirf jo abhi tak nahi bheje

    const filter = {
      status: 'Admitted',
      formSource: { $in: ['btech', 'ssism'] },
    };

    if (onlyPending === '1') filter.shiftedToCentral = { $ne: true };

    const students = await Student.find(filter)
      .select('name fatherName mobileNo formSource track shiftedToCentral shiftedAt branch priority1 subject')
      .lean();

    res.json({ students, total: students.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { syncSingleStudent, syncBulkStudents, getEligibleStudents };

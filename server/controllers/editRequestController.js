const EditRequest = require('../models/EditRequest');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Track incharge — naya edit request bhejo
const createEditRequest = async (req, res) => {
  try {
    const { field, newValue, reason } = req.body;
    const studentId = req.params.studentId;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Track incharge sirf apne track ke students ke liye request kar sakta hai
    if (req.user.role === 'track_incharge' && student.track !== req.user.track)
      return res.status(403).json({ message: 'Access denied' });

    const oldValue = student[field] != null ? String(student[field]) : '';

    const editReq = await EditRequest.create({
      student: studentId,
      requestedBy: req.user._id,
      field,
      oldValue,
      newValue,
      reason: reason || '',
    });

    // Saare admins ko notification bhejo
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const notifications = admins.map((admin) => ({
      user: admin._id,
      title: 'Edit Request',
      message: `${req.user.name} ne "${student.name}" ke "${field}" field ko update karne ki request ki hai.`,
      type: 'edit_request',
      student: studentId,
      editRequest: editReq._id,
    }));
    await Notification.insertMany(notifications);

    res.status(201).json(editReq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin — saari pending requests dekho
const getEditRequests = async (req, res) => {
  try {
    const { status = 'Pending' } = req.query;
    const filter = status === 'all' ? {} : { status };
    const requests = await EditRequest.find(filter)
      .populate('student', 'name track mobileNo')
      .populate('requestedBy', 'name track')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin — approve ya reject
const reviewEditRequest = async (req, res) => {
  try {
    const { status, reviewNote } = req.body; // status: 'Approved' | 'Rejected'
    const editReq = await EditRequest.findById(req.params.id).populate('student');
    if (!editReq) return res.status(404).json({ message: 'Request not found' });
    if (editReq.status !== 'Pending') return res.status(400).json({ message: 'Already reviewed' });

    editReq.status = status;
    editReq.reviewedBy = req.user._id;
    editReq.reviewNote = reviewNote || '';
    await editReq.save();

    // Approve hone par student update nahi karenge — external website se hoga
    // if (status === 'Approved') {
    //   await Student.findByIdAndUpdate(editReq.student._id, { [editReq.field]: editReq.newValue });
    // }

    // Requestor ko notification bhejo
    await Notification.create({
      user: editReq.requestedBy,
      title: `Edit Request ${status}`,
      message: `"${editReq.student.name}" ke "${editReq.field}" field ki request ${status === 'Approved' ? 'approve' : 'reject'} ho gayi.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      type: 'edit_request',
      student: editReq.student._id,
      editRequest: editReq._id,
    });

    res.json(editReq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Track incharge — apni requests dekho
const getMyEditRequests = async (req, res) => {
  try {
    const requests = await EditRequest.find({ requestedBy: req.user._id })
      .populate('student', 'name track')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createEditRequest, getEditRequests, reviewEditRequest, getMyEditRequests };

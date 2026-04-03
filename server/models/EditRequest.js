const mongoose = require('mongoose');

const editRequestSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  field:       { type: String, required: true },  // e.g. 'name', 'mobileNo'
  oldValue:    { type: String, default: '' },
  newValue:    { type: String, required: true },
  reason:      { type: String, default: '' },
  status:      { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNote:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('EditRequest', editRequestSchema);

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  sn: { type: Number },
  name: { type: String, default: '' },
  fatherName: { type: String, default: '' },
  track: { type: String, default: '' },
  mobileNo: { type: String },
  whatsappNo: { type: String },
  subject: { type: String },
  fullAddress: { type: String },
  otherTrack: { type: String },
  photo: { type: String, default: null },
  marksheet10th: { type: String, default: null },
  marksheet12th: { type: String, default: null },
  incomeCertificate: { type: String, default: null },
  jaatiPraman: { type: String, default: null },
  abcId: { type: String, default: null },
  aadharCard: { type: String, default: null },
  status: {
    type: String,
    enum: ['Applied', 'Calling', 'Verified', 'Admitted', 'Rejected', 'Disabled'],
    default: 'Applied',
  },
  remarks: { type: String, default: '' },
  funnelStage: { type: String, default: '' },
  isDisabled: { type: Boolean, default: false },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);

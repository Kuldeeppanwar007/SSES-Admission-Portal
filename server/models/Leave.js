const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: String, required: true }, // YYYY-MM-DD
  reason:    { type: String, default: '' },    // Optional reason
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Ek user ek din me sirf ek leave ho
leaveSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Leave', leaveSchema);

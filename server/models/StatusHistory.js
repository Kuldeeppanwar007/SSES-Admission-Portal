const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, required: true },
  funnelStage: { type: String, default: '' },
  remarks: { type: String, default: '' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('StatusHistory', statusHistorySchema);

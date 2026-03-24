const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  track: { type: String, required: true },
  subject: { type: String, required: true },
  target: { type: Number, default: 0 },
}, { timestamps: true });

targetSchema.index({ track: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Target', targetSchema);

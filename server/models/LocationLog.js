const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number, default: -1 }, // meters, -1 = unknown
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-delete logs older than 30 days
locationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('LocationLog', locationLogSchema);

const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  accuracy: { type: Number, default: -1 },
  status: { type: String, enum: ['ok', 'unavailable', 'mock'], default: 'ok' },
  isMock: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-delete logs older than 7 days (50 users ke saath storage bachane ke liye)
locationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('LocationLog', locationLogSchema);

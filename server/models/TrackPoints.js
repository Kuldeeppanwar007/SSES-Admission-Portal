const mongoose = require('mongoose');

const trackPointsSchema = new mongoose.Schema({
  track:  { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('TrackPoints', trackPointsSchema);

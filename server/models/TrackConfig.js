const mongoose = require('mongoose');

const trackConfigSchema = new mongoose.Schema({
  track: { type: String, required: true, unique: true, trim: true },
  towns: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('TrackConfig', trackConfigSchema);

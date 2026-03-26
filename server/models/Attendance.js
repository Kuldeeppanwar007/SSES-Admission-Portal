const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  locationSource: { type: String, enum: ['GPS', 'Google', 'Browser'], default: 'Browser' },
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

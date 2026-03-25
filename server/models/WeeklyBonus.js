const mongoose = require('mongoose');

const weeklyBonusSchema = new mongoose.Schema({
  weekStart: { type: Date, required: true }, // Monday of that week
  bonuses: [{
    track:  { type: String },
    rank:   { type: Number }, // 1, 2, 3
    points: { type: Number },
  }],
}, { timestamps: true });

module.exports = mongoose.model('WeeklyBonus', weeklyBonusSchema);

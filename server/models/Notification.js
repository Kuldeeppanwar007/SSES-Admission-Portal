const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  type:    { type: String, enum: ['followup', 'general', 'edit_request'], default: 'general' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  editRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'EditRequest', default: null },
  isRead:  { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

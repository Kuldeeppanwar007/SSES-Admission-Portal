const mongoose = require('mongoose');

const receptionEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  town: { type: String, required: true },
  admissionFormNo: { type: String, required: true },
  visitPurpose: { 
    type: String, 
    enum: ['Visit', 'Inquiry', 'Interview', 'Re-Interview'],
    required: true 
  },
  branch: { type: String, default: null },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Index for faster queries (non-unique — multiple entries per date+town allowed)
receptionEntrySchema.index({ date: 1, town: 1 });
receptionEntrySchema.index({ admissionFormNo: 1 });

const ReceptionEntry = mongoose.model('ReceptionEntry', receptionEntrySchema);

// Purana unique index drop karo agar exist karta ho
ReceptionEntry.collection.dropIndex('date_1_town_1').catch(() => {});

module.exports = ReceptionEntry;

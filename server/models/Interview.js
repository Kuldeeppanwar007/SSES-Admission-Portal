const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  date:        { type: Date, required: true },
  round:       { type: Number, required: true },

  // Technical Knowledge & Aptitude
  mathematicsMarks:   { type: Number, min: 1, max: 5, required: true },
  subjectiveKnowledge:{ type: Number, min: 1, max: 5, required: true },
  reasoningMarks:     { type: Number, min: 1, max: 5, required: true },

  // Candidate Behaviour & Soft Skill
  goalClarity:        { type: Number, min: 1, max: 5, required: true },
  sincerity:          { type: Number, min: 1, max: 5, required: true },
  communicationLevel: { type: Number, min: 1, max: 5, required: true },
  confidenceLevel:    { type: Number, min: 1, max: 5, required: true },

  // Assignment Evaluation
  assignmentMarks:    { type: Number, min: 1, max: 5, default: null },

  // Summary
  totalMark:   { type: Number, required: true },
  result:      { type: String, enum: ['Pass', 'Fail', 'Pending'], default: 'Pending' },
  remarks:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);

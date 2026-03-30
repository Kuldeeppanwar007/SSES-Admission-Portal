const Interview = require('../models/Interview');
const Student = require('../models/Student');

const addInterview = async (req, res) => {
  try {
    const {
      date,
      mathematicsMarks, subjectiveKnowledge, reasoningMarks,
      goalClarity, sincerity, communicationLevel, confidenceLevel,
      assignmentMarks, result, remarks,
    } = req.body;

    const studentId = req.params.studentId;
    const lastInterview = await Interview.findOne({ student: studentId }).sort({ round: -1 });
    const round = lastInterview ? lastInterview.round + 1 : 1;

    const totalMark =
      Number(mathematicsMarks || 0) +
      Number(subjectiveKnowledge || 0) +
      Number(reasoningMarks || 0) +
      Number(goalClarity || 0) +
      Number(sincerity || 0) +
      Number(communicationLevel || 0) +
      Number(confidenceLevel || 0) +
      Number(assignmentMarks || 0);

    const interview = await Interview.create({
      student: studentId,
      interviewer: req.user._id,
      date: date ? new Date(date) : new Date(),
      round,
      mathematicsMarks, subjectiveKnowledge, reasoningMarks,
      goalClarity, sincerity, communicationLevel, confidenceLevel,
      assignmentMarks: assignmentMarks || null,
      totalMark,
      result: result || 'Pending',
      remarks: remarks || '',
    });

    const populated = await interview.populate('interviewer', 'name role');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ student: req.params.studentId })
      .populate('interviewer', 'name role')
      .sort({ round: 1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addFinalInterview = async (req, res) => {
  try {
    const { remarks, result } = req.body;
    const lastInterview = await Interview.findOne({ student: req.params.studentId }).sort({ round: -1 });
    const round = lastInterview ? lastInterview.round + 1 : 1;
    const updated = await Student.findByIdAndUpdate(
      req.params.studentId,
      { finalInterview: { round, remarks: remarks || '', result: result || 'Pending', doneBy: req.user._id, doneAt: new Date() } },
      { new: true }
    ).populate('finalInterview.doneBy', 'name');
    res.json(updated.finalInterview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addInterview, getInterviews, addFinalInterview };

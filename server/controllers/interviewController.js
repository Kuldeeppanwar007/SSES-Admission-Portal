const Interview = require('../models/Interview');
const Student = require('../models/Student');
const ReceptionEntry = require('../models/ReceptionEntry');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getISTDateString = () =>
  new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

const addInterview = async (req, res) => {
  try {
    const {
      date,
      mathematicsMarks, subjectiveKnowledge, reasoningMarks,
      goalClarity, sincerity, communicationLevel, confidenceLevel,
      assignmentMarks, result, remarks, visitPurpose, interviewType,
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
      interviewType: interviewType || null,
    });

    // Agar visitPurpose diya hai to aaj ki latest ReceptionEntry update karo
    if (visitPurpose) {
      const today = getISTDateString();
      const start = new Date(`${today}T00:00:00+05:30`);
      const end   = new Date(`${today}T23:59:59.999+05:30`);
      await ReceptionEntry.findOneAndUpdate(
        { studentId, date: { $gte: start, $lte: end } },
        { visitPurpose },
        { sort: { createdAt: -1 } }
      );
    }

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
    const { remarks, result, interviewType } = req.body;
    const lastInterview = await Interview.findOne({ student: req.params.studentId }).sort({ round: -1 });
    const round = lastInterview ? lastInterview.round + 1 : 1;
    const updated = await Student.findByIdAndUpdate(
      req.params.studentId,
      { finalInterview: { round, remarks: remarks || '', result: result || 'Pending', interviewType: interviewType || null, doneBy: req.user._id, doneAt: new Date() } },
      { new: true }
    ).populate('finalInterview.doneBy', 'name');
    res.json(updated.finalInterview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLastDates = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds?.length) return res.json([]);
    const mongoose = require('mongoose');
    const result = await Interview.aggregate([
      { $match: { student: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$student', lastDate: { $first: '$date' } } },
    ]);
    res.json(result.map(r => ({ studentId: r._id, lastDate: r.lastDate })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview round not found' });
    }
    const studentId = interview.student;
    await Interview.findByIdAndDelete(req.params.id);

    // Re-index remaining technical rounds chronologically
    const remainingInterviews = await Interview.find({ student: studentId }).sort({ date: 1, createdAt: 1 });
    for (let i = 0; i < remainingInterviews.length; i++) {
      remainingInterviews[i].round = i + 1;
      await remainingInterviews[i].save();
    }

    res.json({ message: 'Technical round successfully deleted and re-indexed!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteFinalInterview = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    student.finalInterview = {
      round: null,
      remarks: '',
      result: null,
      interviewType: null,
      doneBy: null,
      doneAt: null
    };
    await student.save();
    res.json({ message: 'Final interview successfully deleted!', finalInterview: student.finalInterview });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addInterview, getInterviews, addFinalInterview, getLastDates, deleteInterview, deleteFinalInterview };

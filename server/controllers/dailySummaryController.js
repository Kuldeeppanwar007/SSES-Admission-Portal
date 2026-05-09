const Student = require('../models/Student');
const StatusHistory = require('../models/StatusHistory');
const Interview = require('../models/Interview');
const EditRequest = require('../models/EditRequest');
const User = require('../models/User');
const ReceptionEntry = require('../models/ReceptionEntry');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getISTDateString = () =>
  new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

const getISTDayRange = (istDateStr) => ({
  start: new Date(`${istDateStr}T00:00:00+05:30`),
  end: new Date(`${istDateStr}T23:59:59.999+05:30`),
});

// Normalize subject/branch names to canonical form
function normalizeBranch(raw) {
  if (!raw) return 'Not Defined';
  const s = raw.trim().toLowerCase();

  // PCM group
  if (/pcm|math|maths|12.*math|math.*12|science.*math|phy.*chem.*math/.test(s)) return 'PCM';
  // PCB group
  if (/pcb|bio.*chem|chem.*bio|biology.*phy|phy.*bio/.test(s)) return 'PCB';
  // Biology group (standalone)
  if (/^bio(logy)?$/.test(s)) return 'Biology';
  // Commerce group
  if (/commerce|com$|^com |commercial/.test(s)) return 'Commerce';
  // Arts group
  if (/arts?|humanities|social/.test(s)) return 'Arts';
  // B.Tech branches
  if (/cs[e]?|computer science/.test(s)) return 'CSE';
  if (/aiml|ai.*ml|machine learning/.test(s)) return 'AIML';
  if (/it\b|information tech/.test(s)) return 'IT';
  if (/ec[e]?|electronics/.test(s)) return 'ECE';
  if (/me\b|mechanical/.test(s)) return 'ME';
  if (/civil/.test(s)) return 'Civil';
  // Degree programs
  if (/bca/.test(s)) return 'BCA';
  if (/bba/.test(s)) return 'BBA';
  if (/bsc/.test(s)) return 'B.Sc';
  if (/bcom/.test(s)) return 'B.Com';
  if (/ba\b/.test(s)) return 'BA';
  if (/mba/.test(s)) return 'MBA';
  if (/mca/.test(s)) return 'MCA';

  // Fallback — capitalize first letter of each word
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

// GET /api/daily-summary?date=YYYY-MM-DD
const getDailySummary = async (req, res) => {
  try {
    const { date, from, to } = req.query;

    // Range mode ya single date
    let start, end, displayDate;
    if (from && to) {
      start = new Date(`${from}T00:00:00+05:30`);
      end   = new Date(`${to}T23:59:59.999+05:30`);
      displayDate = from === to ? from : `${from} to ${to}`;
    } else {
      const d = date || getISTDateString();
      ({ start, end } = getISTDayRange(d));
      displayDate = d;
    }

    // track_incharge ke liye sirf apna track
    const isTrackIncharge = req.user.role === 'track_incharge';
    const userTrack = req.user.track;
    const trackFilter = isTrackIncharge && userTrack ? { track: userTrack } : {};

    // Students added today
    const studentsAddedList = await Student.find({
      ...trackFilter,
      createdAt: { $gte: start, $lte: end },
    }).select('name fatherName track subject branch mobileNo addedBy').populate('addedBy', 'name role').sort({ createdAt: -1 });

    const studentsAdded = studentsAddedList.length;

    const studentsAddedFormatted = studentsAddedList.map(s => {
      const u = s.addedBy;
      const byName = u ? `${u.name}${u.role === 'admin' ? ' (Admin)' : u.role === 'track_incharge' ? ' (TI)' : u.role === 'interviewer' ? ' (Int.)' : ''}` : 'Unknown';
      return {
        name: s.name,
        fatherName: s.fatherName,
        track: s.track,
        branch: normalizeBranch(s.subject || s.branch),
        mobileNo: s.mobileNo,
        by: byName,
        time: s.createdAt,
      };
    });

    // Status breakdown — unique students per status (no duplicates)
    const statusHistoriesAll = await StatusHistory.find({
      createdAt: { $gte: start, $lte: end },
    }).select('status student').populate('student', 'track').sort({ createdAt: -1 });

    const seenStatus = new Set();
    const uniqueStatusChanges = statusHistoriesAll.filter(h => {
      if (!h.student) return false;
      if (isTrackIncharge && userTrack && h.student.track !== userTrack) return false;
      if (seenStatus.has(`${h.student._id}_${h.status}`)) return false;
      seenStatus.add(`${h.student._id}_${h.status}`);
      return true;
    });

    const statusCountMap = {};
    uniqueStatusChanges.forEach(h => {
      statusCountMap[h.status] = (statusCountMap[h.status] || 0) + 1;
    });
    const statusBreakdown = Object.entries(statusCountMap)
      .map(([_id, count]) => ({ _id, count }))
      .sort((a, b) => b.count - a.count);

    const statusChanges = uniqueStatusChanges.length;

    // Interviews today
    const interviewsRaw = await Interview.find({
      createdAt: { $gte: start, $lte: end },
    }).populate('student', 'name fatherName track subject branch mobileNo').populate('interviewer', 'name role').sort({ createdAt: -1 });

    const interviewsFiltered = isTrackIncharge && userTrack
      ? interviewsRaw.filter(iv => iv.student?.track === userTrack)
      : interviewsRaw;

    const interviewsCount = interviewsFiltered.length;
    const interviewsList = interviewsFiltered.map(iv => {
      const u = iv.interviewer;
      const byName = u ? `${u.name}${u.role === 'admin' ? ' (Admin)' : u.role === 'track_incharge' ? ' (TI)' : u.role === 'interviewer' ? ' (Int.)' : ''}` : 'Unknown';
      return {
        name: iv.student?.name || '-',
        fatherName: iv.student?.fatherName || '-',
        track: iv.student?.track || '-',
        branch: normalizeBranch(iv.student?.subject || iv.student?.branch),
        mobileNo: iv.student?.mobileNo || '-',
        by: byName,
        result: iv.result,
        totalMark: iv.totalMark,
        time: iv.createdAt,
      };
    });

    // Edit requests today
    const editRequestsCount = await EditRequest.countDocuments({
      createdAt: { $gte: start, $lte: end },
      ...(isTrackIncharge && userTrack ? { track: userTrack } : {}),
    });

    // Track-wise student additions
    const trackWiseAdditions = await Student.aggregate([
      { $match: { ...trackFilter, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$track', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // User activity (who made changes)
    const userActivityMatch = { createdAt: { $gte: start, $lte: end } };
    if (isTrackIncharge && userTrack) {
      // Only users belonging to this track
      const trackUserIds = await User.find({ track: userTrack }).distinct('_id');
      userActivityMatch.changedBy = { $in: trackUserIds };
    }
    const userActivity = await StatusHistory.aggregate([
      { $match: userActivityMatch },
      { $group: { _id: '$changedBy', changes: { $sum: 1 } } },
      { $sort: { changes: -1 } },
      { $limit: 10 },
    ]);

    const userIds = userActivity.map(u => u._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('name track');
    const userMap = {};
    users.forEach(u => { userMap[u._id] = { name: u.name, track: u.track }; });

    const userActivityWithNames = isTrackIncharge && userTrack
      ? userActivity
          .filter(u => u._id && userMap[u._id]?.track === userTrack)
          .map(u => ({
            userId: u._id,
            name: userMap[u._id]?.name || 'Unknown',
            track: userMap[u._id]?.track || '-',
            changes: u.changes,
          }))
      : userActivity.map(u => ({
          userId: u._id,
          name: u._id ? userMap[u._id]?.name || 'Unknown' : 'System',
          track: u._id ? userMap[u._id]?.track || '-' : '-',
          changes: u.changes,
        }));

    // --- Admitted today ---
    const admittedHistories = await StatusHistory.find({
      status: 'Admitted',
      createdAt: { $gte: start, $lte: end },
    }).populate('student', 'name fatherName track subject branch mobileNo')
      .populate('changedBy', 'name role')
      .sort({ createdAt: -1 });

    const seenAdmitted = new Set();
    const admittedList = admittedHistories
      .filter(h => {
        if (!h.student) return false;
        if (isTrackIncharge && userTrack && h.student.track !== userTrack) return false;
        if (seenAdmitted.has(h.student._id.toString())) return false;
        seenAdmitted.add(h.student._id.toString());
        return true;
      })
      .map(h => {
        const u = h.changedBy;
        const byName = u ? `${u.name}${u.role === 'admin' ? ' (Admin)' : u.role === 'track_incharge' ? ' (TI)' : u.role === 'interviewer' ? ' (Int.)' : ''}` : 'Unknown';
        return {
          studentId: h.student._id,
          name: h.student.name,
          fatherName: h.student.fatherName,
          track: h.student.track,
          branch: normalizeBranch(h.student.subject || h.student.branch),
          mobileNo: h.student.mobileNo,
          admittedBy: byName,
          time: h.createdAt,
        };
      });

    const branchWiseAdmitted = {};
    admittedList.forEach(s => { branchWiseAdmitted[s.branch] = (branchWiseAdmitted[s.branch] || 0) + 1; });
    const branchWiseAdmittedArr = Object.entries(branchWiseAdmitted)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);

    // --- Calling today ---
    const callingHistories = await StatusHistory.find({
      status: 'Calling',
      createdAt: { $gte: start, $lte: end },
    }).populate('student', 'name fatherName track subject branch mobileNo')
      .populate('changedBy', 'name role')
      .sort({ createdAt: -1 });

    const seenCalling = new Set();
    const callingList = callingHistories
      .filter(h => {
        if (!h.student) return false;
        if (isTrackIncharge && userTrack && h.student.track !== userTrack) return false;
        if (seenCalling.has(h.student._id.toString())) return false;
        seenCalling.add(h.student._id.toString());
        return true;
      })
      .map(h => {
        const u = h.changedBy;
        const byName = u ? `${u.name}${u.role === 'admin' ? ' (Admin)' : u.role === 'track_incharge' ? ' (TI)' : u.role === 'interviewer' ? ' (Int.)' : ''}` : 'Unknown';
        return {
          studentId: h.student._id,
          name: h.student.name,
          fatherName: h.student.fatherName,
          track: h.student.track,
          branch: normalizeBranch(h.student.subject || h.student.branch),
          mobileNo: h.student.mobileNo,
          calledBy: byName,
          time: h.createdAt,
        };
      });

    const branchWiseCalling = {};
    callingList.forEach(s => { branchWiseCalling[s.branch] = (branchWiseCalling[s.branch] || 0) + 1; });
    const branchWiseCallingArr = Object.entries(branchWiseCalling)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);

    // ─── Reception Stats — real data from ReceptionEntry ───
    const TOWN_TO_TRACK = {
      'Harda': 'Harda', 'Timarni': 'Harda', 'Seoni Malwa': 'Harda',
      'Khategaon': 'Khategaon', 'Nemawar': 'Khategaon', 'Sandalpur': 'Khategaon',
      'Rehti': 'Rehti', 'Gopalpur': 'Rehti', 'Bherunda': 'Rehti', 'Narmadapuram': 'Rehti',
      'Satwas': 'Satwas & Kannod', 'Kannod': 'Satwas & Kannod',
    };

    const receptionQuery = { date: { $gte: start, $lte: end } };
    if (isTrackIncharge && userTrack) {
      const trackTowns = Object.entries(TOWN_TO_TRACK)
        .filter(([, t]) => t === userTrack).map(([town]) => town);
      receptionQuery.town = { $in: trackTowns };
    }

    const receptionEntries = await ReceptionEntry.find(receptionQuery)
      .populate('studentId', 'name track');

    const receptionStats = receptionEntries.reduce((acc, e) => {
      const p = e.visitPurpose;
      acc.visit        += p === 'Visit'        ? 1 : 0;
      acc.inquiry      += p === 'Inquiry'      ? 1 : 0;
      acc.interview    += p === 'Interview'    ? 1 : 0;
      acc.reInterview  += p === 'Re-Interview' ? 1 : 0;
      acc.total        += 1;
      return acc;
    }, { visit: 0, inquiry: 0, interview: 0, reInterview: 0, total: 0 });

    // Track-wise reception breakdown (admin only — for each track)
    const trackWiseReception = {};
    if (!isTrackIncharge) {
      receptionEntries.forEach(e => {
        const track = TOWN_TO_TRACK[e.town] || 'Other';
        if (!trackWiseReception[track]) {
          trackWiseReception[track] = { total: 0, visit: 0, inquiry: 0, interview: 0, reInterview: 0, entries: [] };
        }
        const p = e.visitPurpose;
        trackWiseReception[track].total += 1;
        trackWiseReception[track].visit       += p === 'Visit'        ? 1 : 0;
        trackWiseReception[track].inquiry     += p === 'Inquiry'      ? 1 : 0;
        trackWiseReception[track].interview   += p === 'Interview'    ? 1 : 0;
        trackWiseReception[track].reInterview += p === 'Re-Interview' ? 1 : 0;
        trackWiseReception[track].entries.push({
          _id: e._id,
          admissionFormNo: e.admissionFormNo,
          studentName: e.studentId?.name || null,
          town: e.town,
          visitPurpose: e.visitPurpose,
          branch: e.branch,
          createdAt: e.createdAt,
        });
      });
    }

    res.json({
      date: displayDate,
      studentsAdded,
      studentsAddedList: studentsAddedFormatted,
      statusChanges,
      statusBreakdown,
      interviewsCount,
      interviewsList,
      editRequestsCount,
      trackWiseAdditions,
      userActivity: userActivityWithNames,
      admittedList,
      branchWiseAdmitted: branchWiseAdmittedArr,
      callingList,
      branchWiseCalling: branchWiseCallingArr,
      receptionStats,
      trackWiseReception: isTrackIncharge ? undefined : trackWiseReception,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/daily-summary/weekly?track=xxx
// Last 7 days ka summary for charts
const getWeeklySummary = async (req, res) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + IST_OFFSET_MS - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }

    const isTrackIncharge = req.user.role === 'track_incharge';
    const userTrack = req.user.track;
    const trackFilter = isTrackIncharge && userTrack
      ? { track: userTrack }
      : req.query.track ? { track: req.query.track } : {};

    const data = await Promise.all(
      days.map(async (date) => {
        const { start, end } = getISTDayRange(date);

        const studentsAdded = await Student.countDocuments({
          ...trackFilter,
          createdAt: { $gte: start, $lte: end },
        });

        const statusChanges = await StatusHistory.countDocuments({
          createdAt: { $gte: start, $lte: end },
        });

        const interviews = await Interview.countDocuments({
          createdAt: { $gte: start, $lte: end },
        });

        return { date, studentsAdded, statusChanges, interviews };
      })
    );

    res.json({ days, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDailySummary, getWeeklySummary };

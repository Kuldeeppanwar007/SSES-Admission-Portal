const cron = require('node-cron');
const TrackPoints = require('../models/TrackPoints');
const WeeklyBonus = require('../models/WeeklyBonus');

const BONUS = { 1: 200, 2: 150, 3: 100 };

const BTECH_SUBJECTS = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)'];

// Get Monday of current week in IST
const getWeekStart = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day  = nowIST.getUTCDay();
  const diff = nowIST.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(nowIST);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return new Date(monday.getTime() - IST_OFFSET_MS);
};

// Final Points Table ke hisab se har track ke admission points calculate karo
const calcAdmissionPointsPerTrack = async () => {
  const Student = require('../models/Student');
  const Target  = require('../models/Target');

  const targets = await Target.find({});
  const pointsPerSubject = {}; // { track: { subject: pts } }
  targets.forEach(({ track, subject, points }) => {
    if (!pointsPerSubject[track]) pointsPerSubject[track] = {};
    pointsPerSubject[track][subject] = points || 0;
  });

  const admittedAgg = await Student.aggregate([
    { $match: { status: 'Admitted', isDisabled: { $ne: true } } },
    { $group: { _id: { track: '$track', subject: '$subject' }, count: { $sum: 1 } } },
  ]);

  const admissionPointsMap = {}; // { track: totalAdmissionPoints }
  admittedAgg.forEach(({ _id: { track, subject }, count }) => {
    if (!track || !subject) return;
    // B.Tech ke 4 subjects ko 'B.Tech' ke under group karo (same as getStats)
    const subjectKey = BTECH_SUBJECTS.includes(subject) ? 'B.Tech' : subject;
    const pts = pointsPerSubject[track]?.[subjectKey] || 0;
    admissionPointsMap[track] = (admissionPointsMap[track] || 0) + count * pts;
  });

  return admissionPointsMap;
};

const runWeeklyBonus = async () => {
  try {
    const weekStart = getWeekStart();

    // Prevent duplicate bonus for same week
    const already = await WeeklyBonus.findOne({ weekStart });
    if (already) {
      console.log('[WeeklyBonus] Already distributed for this week, skipping.');
      return { skipped: true };
    }

    // Final Points Table ke hisab se admission points calculate karo
    const admissionPointsMap = await calcAdmissionPointsPerTrack();
    if (Object.keys(admissionPointsMap).length === 0) {
      console.log('[WeeklyBonus] No admission data found, skipping.');
      return;
    }

    // Sort tracks by admissionPoints descending — yahi Final Points Table ka order hai
    const sorted = Object.entries(admissionPointsMap)
      .sort(([, a], [, b]) => b - a);

    const top3 = sorted.slice(0, 3);
    const bonuses = [];

    for (let i = 0; i < top3.length; i++) {
      const [track, admPts] = top3[i];
      const rank  = i + 1;
      const bonus = BONUS[rank];
      await TrackPoints.findOneAndUpdate(
        { track },
        { $inc: { points: bonus } },
        { upsert: true }
      );
      bonuses.push({ track, rank, points: bonus });
      console.log(`[WeeklyBonus] Rank #${rank} — ${track} (admPts: ${admPts}) +${bonus} pts`);
    }

    await WeeklyBonus.create({ weekStart, bonuses });
    console.log('[WeeklyBonus] Weekly bonus distributed successfully.');
    return { success: true, bonuses };
  } catch (err) {
    console.error('[WeeklyBonus] Error:', err.message);
  }
};

// Every Saturday at 23:59
// cron format: second(optional) minute hour day-of-month month day-of-week
// day-of-week: 6 = Saturday
const scheduleWeeklyBonus = () => {
  cron.schedule('59 23 * * 6', runWeeklyBonus, {
    timezone: 'Asia/Kolkata',
  });
  console.log('[WeeklyBonus] Cron scheduled — every Saturday 23:59 IST');
};

module.exports = { scheduleWeeklyBonus, runWeeklyBonus };

const cron = require('node-cron');
const TrackPoints = require('../models/TrackPoints');
const WeeklyBonus = require('../models/WeeklyBonus');

const BONUS = { 1: 200, 2: 150, 3: 100 };

// Get Monday of current week (to use as unique week identifier)
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
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

    // Get all tracks sorted by points descending
    const tracks = await TrackPoints.find({}).sort({ points: -1 });
    if (tracks.length === 0) return;

    const top3 = tracks.slice(0, 3);
    const bonuses = [];

    for (let i = 0; i < top3.length; i++) {
      const rank = i + 1;
      const bonus = BONUS[rank];
      await TrackPoints.findOneAndUpdate(
        { track: top3[i].track },
        { $inc: { points: bonus } }
      );
      bonuses.push({ track: top3[i].track, rank, points: bonus });
      console.log(`[WeeklyBonus] Rank #${rank} — ${top3[i].track} +${bonus} pts`);
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

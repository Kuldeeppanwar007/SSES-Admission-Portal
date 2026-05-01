const User         = require('../models/User');
const LocationLog  = require('../models/LocationLog');
const Notification = require('../models/Notification');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getISTDateString = () =>
  new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

const getISTDayRange = (istDateStr) => ({
  start: new Date(`${istDateStr}T00:00:00+05:30`),
  end:   new Date(`${istDateStr}T23:59:59.999+05:30`),
});

// Haversine distance in meters
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/analytics/daily-distance?date=YYYY-MM-DD&track=xxx
// Har user ne us din kitna travel kiya
const getDailyDistance = async (req, res) => {
  try {
    const date = req.query.date || getISTDateString();
    const { start, end } = getISTDayRange(date);

    const userQuery = { role: 'track_incharge', isActive: true };
    if (req.query.track) userQuery.track = req.query.track;
    const users = await User.find(userQuery).select('name track');

    const results = await Promise.all(users.map(async (u) => {
      const logs = await LocationLog.find({
        user: u._id, status: 'ok', lat: { $ne: null },
        timestamp: { $gte: start, $lte: end },
      }).sort({ timestamp: 1 });

      let totalDistance = 0;
      for (let i = 1; i < logs.length; i++)
        totalDistance += haversine(logs[i-1].lat, logs[i-1].lng, logs[i].lat, logs[i].lng);

      const firstPing = logs[0]?.timestamp ?? null;
      const lastPing  = logs[logs.length - 1]?.timestamp ?? null;

      return {
        userId: u._id, name: u.name, track: u.track,
        totalDistance: Math.round(totalDistance),
        pings: logs.length,
        firstPing, lastPing,
      };
    }));

    // Distance ke hisaab se sort karo
    results.sort((a, b) => b.totalDistance - a.totalDistance);
    res.json(results);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/analytics/weekly-distance?track=xxx
// Last 7 din ka daily distance — chart ke liye
const getWeeklyDistance = async (req, res) => {
  try {
    const userQuery = { role: 'track_incharge', isActive: true };
    if (req.query.track) userQuery.track = req.query.track;
    const users = await User.find(userQuery).select('name track');

    // Last 7 din ki dates
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + IST_OFFSET_MS - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }

    const data = await Promise.all(users.map(async (u) => {
      const perDay = await Promise.all(days.map(async (date) => {
        const { start, end } = getISTDayRange(date);
        const logs = await LocationLog.find({
          user: u._id, status: 'ok', lat: { $ne: null },
          timestamp: { $gte: start, $lte: end },
        }).sort({ timestamp: 1 });

        let dist = 0;
        for (let i = 1; i < logs.length; i++)
          dist += haversine(logs[i-1].lat, logs[i-1].lng, logs[i].lat, logs[i].lng);
        return { date, distanceKm: +(dist / 1000).toFixed(2) };
      }));
      return { userId: u._id, name: u.name, track: u.track, perDay };
    }));

    res.json({ days, users: data });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/analytics/inactive-now
// Working hours me jinki last ping 3+ ghante purani hai
const getInactiveNow = async (req, res) => {
  try {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const hour   = nowIST.getUTCHours();
    const day    = nowIST.getUTCDay(); // 0=Sun

    // Working hours check (7AM-7PM IST, Mon-Sat)
    if (day === 0 || hour < 7 || hour >= 19)
      return res.json({ workingHours: false, inactive: [] });

    const todayStr = getISTDateString();
    const { start } = getISTDayRange(todayStr);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const users = await User.find({ role: 'track_incharge', isActive: true }).select('name track');

    const inactive = [];
    for (const u of users) {
      const latest = await LocationLog.findOne({
        user: u._id, status: 'ok', lat: { $ne: null },
        timestamp: { $gte: start },
      }).sort({ timestamp: -1 });

      const isInactive = !latest || latest.timestamp < threeHoursAgo;
      if (isInactive) {
        inactive.push({
          userId: u._id, name: u.name, track: u.track,
          lastSeen: latest?.timestamp ?? null,
          minutesSinceLastPing: latest
            ? Math.round((Date.now() - latest.timestamp) / 60000)
            : null,
        });
      }
    }
    res.json({ workingHours: true, inactive });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Cron job — har ghante inactive users check karo aur admin ko notify karo
const runInactiveCheck = async () => {
  try {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const hour   = nowIST.getUTCHours();
    const day    = nowIST.getUTCDay();
    if (day === 0 || hour < 7 || hour >= 19) return;

    const todayStr = getISTDateString();
    const { start } = getISTDayRange(todayStr);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const users = await User.find({ role: 'track_incharge', isActive: true }).select('name track');
    const inactiveNames = [];

    for (const u of users) {
      const latest = await LocationLog.findOne({
        user: u._id, status: 'ok', lat: { $ne: null },
        timestamp: { $gte: start },
      }).sort({ timestamp: -1 });

      if (!latest || latest.timestamp < threeHoursAgo) {
        inactiveNames.push(`${u.name} (${u.track})`);
      }
    }

    if (inactiveNames.length === 0) return;

    // Admins ko notify karo
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    for (const admin of admins) {
      // Duplicate check — aaj already same notification gayi ho toh mat bhejo
      const alreadySent = await Notification.findOne({
        user: admin._id, type: 'inactive',
        createdAt: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });
      if (alreadySent) continue;

      await Notification.create({
        user: admin._id,
        title: `${inactiveNames.length} Track Incharge Inactive`,
        message: `3+ ghante se koi ping nahi: ${inactiveNames.join(', ')}`,
        type: 'inactive',
      });
    }
    console.log(`[Inactive Check] ${inactiveNames.length} inactive users notified`);
  } catch (err) {
    console.error('[Inactive Check] Error:', err.message);
  }
};

module.exports = { getDailyDistance, getWeeklyDistance, getInactiveNow, runInactiveCheck };

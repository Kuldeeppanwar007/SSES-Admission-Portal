const cron = require('node-cron');
const Student = require('../models/Student');
const User = require('../models/User');
const Notification = require('../models/Notification');

const STALE_DAYS = 2; // 2+ din se same status wale students

const runFollowupReminders = async () => {
  try {
    // IST mein cutoff calculate karo
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const cutoff = new Date(nowIST.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

    // Students jinki updatedAt STALE_DAYS se purani hai aur status Admitted/Rejected/Disabled nahi
    const staleStudents = await Student.find({
      updatedAt: { $lte: cutoff },
      status: { $in: ['Applied', 'Calling'] },
      isDisabled: { $ne: true },
      track: { $nin: [null, ''] },
    }).select('name track status updatedAt');

    if (staleStudents.length === 0) return;

    // Track ke hisaab se group karo
    const trackMap = {};
    staleStudents.forEach((s) => {
      if (!trackMap[s.track]) trackMap[s.track] = [];
      trackMap[s.track].push(s);
    });

    // Har track ke incharge ko notification bhejo
    for (const [track, students] of Object.entries(trackMap)) {
      const incharge = await User.findOne({ track, role: 'track_incharge', isActive: true });
      if (!incharge) continue;

      // Ek hi notification mein saare students ka summary
      await Notification.create({
        user: incharge._id,
        title: `${students.length} Student${students.length > 1 ? 's' : ''} Need Follow-up`,
        message: `${students.length} student${students.length > 1 ? 's' : ''} ka status ${STALE_DAYS}+ din se same hai. Follow-up karo.`,
        type: 'followup',
      });

      console.log(`[Followup] ${track} — ${students.length} stale students, notified ${incharge.name}`);
    }

    // Admins ko bhi overall summary
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const total = staleStudents.length;
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        title: `${total} Students Need Follow-up`,
        message: `${total} students ka status ${STALE_DAYS}+ din se update nahi hua. Dashboard check karo.`,
        type: 'followup',
      });
    }
  } catch (err) {
    console.error('[Followup] Error:', err.message);
  }
};

const scheduleFollowupReminders = () => {
  // Roz subah 9 baje IST
  cron.schedule('0 9 * * *', runFollowupReminders, { timezone: 'Asia/Kolkata' });
  console.log('[Followup] Cron scheduled — daily 9:00 AM IST');
};

module.exports = { scheduleFollowupReminders, runFollowupReminders };

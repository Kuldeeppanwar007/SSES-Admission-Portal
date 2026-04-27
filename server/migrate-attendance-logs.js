/**
 * Migration: Attendance records se missing LocationLog entries create karo
 * Sirf last 7 din ke records process honge (LocationLog TTL ke barabar)
 * Run: node migrate-attendance-logs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');
const LocationLog = require('./models/LocationLog');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const records = await Attendance.find({ createdAt: { $gte: since } });
  console.log(`Found ${records.length} attendance records in last 7 days`);

  let created = 0, skipped = 0;

  for (const rec of records) {
    // Check karo agar us din us user ka koi LocationLog already exist karta hai
    const dayStart = new Date(`${rec.date}T00:00:00+05:30`);
    const dayEnd   = new Date(`${rec.date}T23:59:59.999+05:30`);

    const existing = await LocationLog.findOne({
      user: rec.user,
      status: 'ok',
      lat: { $ne: null },
      timestamp: { $gte: dayStart, $lte: dayEnd },
    });

    if (existing) { skipped++; continue; }

    await LocationLog.create({
      user: rec.user,
      lat: rec.latitude,
      lng: rec.longitude,
      accuracy: -1,
      status: 'ok',
      timestamp: rec.createdAt,
    });
    created++;
  }

  console.log(`Done — ${created} LocationLog entries created, ${skipped} skipped (already existed)`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });

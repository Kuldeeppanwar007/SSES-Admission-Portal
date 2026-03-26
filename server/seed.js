const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const User = require('./models/User');

  const existing = await User.findOne({ email: 'admin@sses.com' });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    process.exit(0);
  }

  const password = await bcrypt.hash('Admin@123', 10);
  await User.create({
    name: 'Admin',
    email: 'admin@sses.com',
    password,
    role: 'admin',
    isActive: true,
  });

  console.log('✅ Admin user created!');
  console.log('   Email   : admin@sses.com');
  console.log('   Password: Admin@123');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });

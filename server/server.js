const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { scheduleWeeklyBonus } = require('./utils/weeklyBonus');
const { scheduleFollowupReminders } = require('./utils/followupReminder');

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'https://mkt.central.ssism.org',
      'http://mkt.central.ssism.org',
      'http://localhost:3000',
      'http://localhost:3010',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost',
    ];
    if (allowed.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json());
app.use(cookieParser());

// Global rate limit — poore API pe 500 requests per 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/refresh'),
}));

// Login — max 10 attempts per 15 min per IP
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: 'Too many login attempts. Try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Refresh token — max 60 attempts per 15 min per IP
app.use('/api/auth/refresh', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: 'Too many refresh attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/targets', require('./routes/targetRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/edit-requests', require('./routes/editRequestRoutes'));
app.use('/api/track-config', require('./routes/trackConfigRoutes'));

app.get('/', (req, res) => res.send('SSES Admission Portal API Running'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleWeeklyBonus();
  scheduleFollowupReminders();
});

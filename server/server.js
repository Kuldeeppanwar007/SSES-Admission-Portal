const express = require('express');
const http    = require('http');
const dotenv  = require('dotenv');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');
const { Server }   = require('socket.io');
const connectDB    = require('./config/db');
const { scheduleWeeklyBonus }       = require('./utils/weeklyBonus');
const { scheduleFollowupReminders } = require('./utils/followupReminder');
const { runInactiveCheck }          = require('./controllers/analyticsController');
const cron                          = require('node-cron');

dotenv.config();
connectDB();

const app    = express();
const server = http.createServer(app);

const allowedOrigins = [
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

// Socket.io — real-time live location broadcast
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// io instance globally available for controllers
app.set('io', io);

io.on('connection', (socket) => {
  // Admin join karo live-tracking room
  socket.on('join:live', () => socket.join('live_tracking'));
  socket.on('disconnect', () => {});
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json());
app.use(cookieParser());

const { ipKeyGenerator } = require('express-rate-limit');

// Key: JWT se user ID nikalo (bina DB call), warna IP fallback
const userOrIpKey = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id) return decoded.id;
    }
  } catch {}
  return ipKeyGenerator(req);
};

// Global rate limit — 500 requests per 15 min per user/IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  keyGenerator: userOrIpKey,
  message: { message: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/refresh'),
}));

// Login — max 30 attempts per 15 min per IP (user ID nahi hoga yahan)
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many login attempts. Try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Refresh token — max 200 per 15 min per IP
app.use('/api/auth/refresh', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many refresh attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Self-register — public endpoint, all origins allowed
app.use('/api/students/self-register', cors({ origin: '*' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/targets', require('./routes/targetRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/edit-requests', require('./routes/editRequestRoutes'));
app.use('/api/track-config', require('./routes/trackConfigRoutes'));
app.use('/api/analytics',    require('./routes/analyticsRoutes'));

app.get('/', (req, res) => res.send('SSES Admission Portal API Running'));

app.get('/api/app-version', (req, res) => {
  res.json({ minVersion: parseInt(process.env.MIN_APP_VERSION || '1') });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 3009;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleWeeklyBonus();
  scheduleFollowupReminders();
  // Har ghante inactive check — working hours me
  cron.schedule('0 * * * *', runInactiveCheck, { timezone: 'Asia/Kolkata' });
  console.log('[Inactive Check] Cron scheduled — every hour');
});

const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateAccessToken  = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

const register = async (req, res) => {
  const { name, email, password, role, track } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'User already exists' });
  const user = await User.create({ name, email, password, role, track });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, track: user.track });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.isActive)
    return res.status(403).json({ message: 'Account is deactivated' });

  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    _id: user._id, name: user.name, email: user.email,
    role: user.role, track: user.track,
    token: accessToken,
    refreshToken,
  });
};

const refreshToken = async (req, res) => {
  // Cookie se lo (web) ya body se lo (Android)
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token)
      return res.status(401).json({ message: 'Invalid refresh token' });
    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated' });

    const newAccessToken = generateAccessToken(user._id);

    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: newAccessToken, refreshToken: token });
  } catch {
    res.status(401).json({ message: 'Refresh token invalid or expired' });
  }
};

const logout = async (req, res) => {
  // Cookie se lo (web) ya body se lo (Android)
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (token) {
    const user = await User.findOne({ refreshToken: token });
    if (user) { user.refreshToken = null; await user.save(); }
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
};

const getMe = async (req, res) => {
  res.json(req.user);
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Current and new password required' });
  if (newPassword.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const user = await User.findById(req.user._id);
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

  user.password = newPassword;
  user.refreshToken = null; // invalidate all sessions on all devices
  await user.save();
  res.clearCookie('refreshToken');
  res.json({ message: 'Password updated successfully' });
};

module.exports = { register, login, refreshToken, logout, getMe, changePassword };

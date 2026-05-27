const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/mailer');

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
    canEditStudent: user.canEditStudent || false,
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

const sendOtp = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  
  if (!user) {
    return res.status(404).json({ message: 'Email id is not registered in the system.' });
  }
  
  if (!user.isActive) {
    return res.status(403).json({ message: 'Your account is deactivated. Please contact administrator.' });
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration (10 minutes from now)
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  try {
    await sendOtpEmail({ email: user.email, otp, name: user.name });
    res.json({ message: 'Verification code sent to your registered email address successfully.' });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
  }
};

const loginWithOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: 'Email id is not registered in the system.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Your account is deactivated.' });
  }

  if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
  }

  // Clear OTP fields upon successful login
  user.otp = null;
  user.otpExpires = null;

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
    canEditStudent: user.canEditStudent || false,
    token: accessToken,
    refreshToken,
  });
};

const googleLogin = async (req, res) => {
  const { idToken, accessToken } = req.body;
  if (!idToken && !accessToken) {
    return res.status(400).json({ message: 'Google credentials are required.' });
  }

  try {
    let email;

    if (idToken) {
      // Verify ID Token with Google OAuth API
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      const payload = await response.json();

      if (payload.error || !payload.email) {
        return res.status(400).json({ message: 'Invalid Google token. Please try again.' });
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID || '582014715224-6vfss07lfrolhgogmpg1kftnoehpo2ub.apps.googleusercontent.com';
      if (payload.aud !== googleClientId) {
        return res.status(400).json({ message: 'Google Client ID mismatch.' });
      }

      email = payload.email.toLowerCase();
    } else if (accessToken) {
      // Verify Access Token using Google UserInfo API
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json();

      if (payload.error || !payload.email) {
        return res.status(400).json({ message: 'Invalid Google access token. Please try again.' });
      }

      email = payload.email.toLowerCase();
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'This Google email is not registered in our admission system.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account is deactivated. Please contact administrator.' });
    }

    // Success! Generate JWTs
    const accessTokenJWT  = generateAccessToken(user._id);
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
      canEditStudent: user.canEditStudent || false,
      token: accessTokenJWT,
      refreshToken,
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ message: 'Failed to authenticate Google account.' });
  }
};

module.exports = { register, login, refreshToken, logout, getMe, changePassword, sendOtp, loginWithOtp, googleLogin };

const User = require('../models/User');

const getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter).select('-password -refreshToken').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, track, canEditStudent } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const user = await User.create({ name, email, password, role, track, canEditStudent });
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, track: user.track, canEditStudent: user.canEditStudent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, track, isActive, canEditStudent } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, track, isActive, canEditStudent },
      { new: true }
    ).select('-password -refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyTheme = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('theme');
    res.json({ theme: user?.theme || 'orange' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMyTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    await User.findByIdAndUpdate(req.user.id, { theme });
    res.json({ theme });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getMyTheme, updateMyTheme };

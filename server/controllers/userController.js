const User = require('../models/User');

const getUsers = async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
  res.json(users);
};

const createUser = async (req, res) => {
  const { name, email, password, role, track } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'User already exists' });
  const user = await User.create({ name, email, password, role, track });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, track: user.track });
};

const updateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.deleteOne();
  res.json({ message: 'User deleted' });
};

module.exports = { getUsers, createUser, updateUser, deleteUser };

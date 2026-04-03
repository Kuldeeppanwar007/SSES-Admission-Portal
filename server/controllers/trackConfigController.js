const TrackConfig = require('../models/TrackConfig');

// Get all tracks with towns
const getTrackConfigs = async (req, res) => {
  try {
    const tracks = await TrackConfig.find({}).sort({ createdAt: 1 });
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new track
const createTrackConfig = async (req, res) => {
  try {
    const { track, towns = [] } = req.body;
    if (!track?.trim()) return res.status(400).json({ message: 'Track name required' });
    const exists = await TrackConfig.findOne({ track: { $regex: `^${track.trim()}$`, $options: 'i' } });
    if (exists) return res.status(400).json({ message: 'Track already exists' });
    const doc = await TrackConfig.create({ track: track.trim(), towns: towns.map(t => t.trim()).filter(Boolean) });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update track (name + towns)
const updateTrackConfig = async (req, res) => {
  try {
    const { track, towns } = req.body;
    const updates = {};
    if (track?.trim()) updates.track = track.trim();
    if (towns !== undefined) updates.towns = towns.map(t => t.trim()).filter(Boolean);
    const doc = await TrackConfig.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!doc) return res.status(404).json({ message: 'Track not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete track
const deleteTrackConfig = async (req, res) => {
  try {
    const doc = await TrackConfig.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Track not found' });
    res.json({ message: 'Track deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTrackConfigs, createTrackConfig, updateTrackConfig, deleteTrackConfig };

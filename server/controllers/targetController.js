const Target = require('../models/Target');

// Set/update target for a track+subject (admin only)
const setTarget = async (req, res) => {
  const { track, subject, target, points } = req.body;
  if (!track || !subject)
    return res.status(400).json({ message: 'track and subject required' });

  const update = {};
  if (target !== undefined) update.target = Number(target);
  if (points !== undefined) update.points = Number(points);

  const doc = await Target.findOneAndUpdate(
    { track, subject },
    { $set: update },
    { upsert: true, new: true }
  );
  res.json(doc);
};

// Get all targets (optionally filter by track)
const getTargets = async (req, res) => {
  const filter = req.query.track ? { track: req.query.track } : {};
  const targets = await Target.find(filter);
  res.json(targets);
};

module.exports = { setTarget, getTargets };

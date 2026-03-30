const express = require('express');
const router = express.Router();
const AlertLog = require('../models/AlertLog');

// GET /api/logs — paginated alert log history
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const source = req.query.source;
    const status = req.query.status;
    const alertType = req.query.alertType;
    const severity = req.query.severity;

    const filter = {};
    if (source && ['live', 'upload', 'youtube', 'drone'].includes(source)) filter.source = source;
    if (status && ['alert', 'safe'].includes(status)) filter.status = status;
    if (alertType && ['fire_small', 'fire_moderate', 'fire_severe', 'accident', 'signal_lost', 'anomaly'].includes(alertType)) filter.alertType = alertType;
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) filter.severity = severity;

    const [logs, total] = await Promise.all([
      AlertLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AlertLog.countDocuments(filter)
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Logs] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/logs/stats — summary stats including alert type breakdown
router.get('/stats', async (req, res) => {
  try {
    const [total, alerts, safeCount] = await Promise.all([
      AlertLog.countDocuments(),
      AlertLog.countDocuments({ status: 'alert' }),
      AlertLog.countDocuments({ status: 'safe' })
    ]);

    // Count by alert type
    const typeBreakdown = await AlertLog.aggregate([
      { $match: { status: 'alert' } },
      { $group: { _id: '$alertType', count: { $sum: 1 }, maxConf: { $max: '$confidence' } } },
      { $sort: { count: -1 } }
    ]);

    const recent = await AlertLog.find({ status: 'alert' })
      .sort({ timestamp: -1 })
      .limit(1)
      .lean();

    res.json({
      total,
      alerts,
      safe: safeCount,
      lastAlert: recent[0]?.timestamp || null,
      typeBreakdown: typeBreakdown.reduce((acc, t) => {
        acc[t._id] = { count: t.count, maxConf: Math.round(t.maxConf * 100) };
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// DELETE /api/logs/:id — delete a single log entry
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await AlertLog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Log not found' });
    res.json({ success: true, message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// DELETE /api/logs — clear all logs
router.delete('/', async (req, res) => {
  try {
    const result = await AlertLog.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Clear failed' });
  }
});

module.exports = router;

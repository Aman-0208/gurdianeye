const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['alert', 'safe'],
    required: true
  },
  // Typed alert category
  alertType: {
    type: String,
    enum: ['fire_small', 'fire_moderate', 'fire_severe', 'accident', 'signal_lost', 'anomaly'],
    default: 'anomaly'
  },
  // Severity level
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  reason: {
    type: String,
    default: 'Normal activity'
  },
  source: {
    type: String,
    enum: ['live', 'upload', 'youtube', 'drone'],
    default: 'live'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
alertLogSchema.index({ alertType: 1, timestamp: -1 });
alertLogSchema.index({ severity: 1, timestamp: -1 });

// TTL index — auto-delete logs older than 7 days
alertLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('AlertLog', alertLogSchema);

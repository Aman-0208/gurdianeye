require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const { analyzeFrame, analyzeYouTubeUrl, healthCheck } = require('./services/aiService');
const AlertLog = require('./models/AlertLog');
const uploadRoute = require('./routes/upload');
const logsRoute = require('./routes/logs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 5 * 1024 * 1024
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.use('/api/upload', uploadRoute);
app.use('/api/logs', logsRoute);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const aiAlive = await healthCheck();
  const mongoReady = mongoose.connection.readyState === 1;
  res.json({
    status: 'ok',
    server: true,
    mongodb: mongoReady,
    aiService: aiAlive,
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/analyze-youtube — server-side YouTube analysis
// ─────────────────────────────────────────────────────────
app.post('/api/analyze-youtube', async (req, res) => {
  const { url, max_frames = 60, sample_every = 5 } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url field' });

  const io = req.app.get('io');
  if (io) io.emit('processing_status', { status: 'processing', message: `Analyzing YouTube stream…` });

  try {
    console.log(`[YouTube] Analyzing: ${url}`);
    const result = await analyzeYouTubeUrl(url, max_frames, sample_every);

    // Save alerts to MongoDB
    const savedLogs = [];
    const alertsToSave = result.alerts || [];
    for (const alertItem of alertsToSave) {
      try {
        const log = await AlertLog.create({
          timestamp: new Date(),
          status: 'alert',
          alertType: alertItem.alertType || 'anomaly',
          severity:  alertItem.severity  || 'medium',
          confidence: alertItem.confidence || result.confidence,
          reason:    alertItem.reason    || result.reason,
          source:    'youtube'
        });
        savedLogs.push(log);
      } catch (dbErr) {
        console.error('[YouTube] DB save error:', dbErr.message);
      }
    }

    // Emit via Socket.io
    if (io) {
      io.emit('video_analysis_complete', {
        alert:      result.alert,
        alerts:     result.alerts || [],
        confidence: result.confidence,
        reason:     result.reason,
        status:     result.status || (result.alert ? 'warning' : 'safe'),
        detections: result.detections || [],
        source:     'youtube',
        logsStored: savedLogs.length
      });
      if (result.alert) {
        io.emit('detection_result', {
          alert:      true,
          alerts:     result.alerts || [],
          alertType:  result.alertType || 'anomaly',
          severity:   result.severity  || 'medium',
          confidence: result.confidence,
          reason:     result.reason,
          status:     result.status || 'warning',
          source:     'youtube',
          timestamp:  new Date().toISOString()
        });
      }
      io.emit('processing_status', { status: 'idle', message: 'YouTube analysis complete' });
    }

    res.json({
      success:        true,
      alert:          result.alert,
      alerts:         result.alerts || [],
      alertType:      result.alertType || null,
      severity:       result.severity  || null,
      confidence:     result.confidence,
      reason:         result.reason,
      status:         result.status || (result.alert ? 'warning' : 'safe'),
      analyzedFrames: result.analyzed_frames || 0,
      alertFrames:    result.alert_frames    || 0,
      logsStored:     savedLogs.length
    });
  } catch (err) {
    console.error('[YouTube] Analysis error:', err);
    if (io) io.emit('processing_status', { status: 'idle', message: 'YouTube analysis failed' });
    res.status(500).json({ error: 'YouTube analysis failed', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// Socket.io — Real-time frame analysis & alert broadcasting
// ─────────────────────────────────────────────────────────

// Track per-socket frame counters for sampling
const socketState = new Map();
const SAMPLE_INTERVAL = parseInt(process.env.FRAME_SAMPLE_INTERVAL || 5);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socketState.set(socket.id, { frameCount: 0 });

  socket.emit('system_status', { connected: true, timestamp: new Date().toISOString() });

  // ─── Analyze incoming frames from client camera/video ───
  socket.on('analyze_frame', async (data) => {
    const state = socketState.get(socket.id) || { frameCount: 0 };
    state.frameCount++;
    socketState.set(socket.id, state);

    // Frame sampling
    if (state.frameCount % SAMPLE_INTERVAL !== 0) return;

    const { frame, source = 'live' } = data;
    if (!frame) return;

    try {
      const result = await analyzeFrame(frame, source);

      // Broadcast full result to originating client (for StatusBadge / live UI)
      socket.emit('detection_result', { ...result, source });

      // ─── Process multi-alert array ───
      const alertsArray = result.alerts || [];

      if (alertsArray.length > 0) {
        // Save each typed alert to MongoDB and broadcast individually
        for (const alertItem of alertsArray) {
          try {
            const log = await AlertLog.create({
              timestamp: new Date(result.timestamp),
              status: 'alert',
              alertType: alertItem.alertType || 'anomaly',
              severity: alertItem.severity || 'medium',
              confidence: alertItem.confidence || result.confidence,
              reason: alertItem.reason || result.reason,
              source
            });

            // Broadcast each alert as a separate event
            io.emit('new_alert', {
              alert: true,
              alertType: alertItem.alertType,
              severity: alertItem.severity,
              confidence: alertItem.confidence,
              reason: alertItem.reason,
              emoji: alertItem.emoji,
              label: alertItem.label,
              status: result.status,
              source,
              logId: log._id,
              timestamp: log.timestamp
            });
          } catch (dbErr) {
            console.error('[Socket] DB save error:', dbErr.message);
          }
        }

        console.log(
          `[Alert] ${source.toUpperCase()} — ${alertsArray.map(a => a.alertType).join(', ')} ` +
          `(max conf: ${(result.confidence * 100).toFixed(1)}%)`
        );
      }
    } catch (err) {
      console.error('[Socket] Frame analysis error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    socketState.delete(socket.id);
  });
});

// ─────────────────────────────────────────────────────────
// MongoDB Connection
// ─────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guardianeye';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`[MongoDB] Connected: ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.error('[MongoDB] Connection failed:', err.message);
    console.error('  → Make sure MongoDB is running: net start MongoDB');
  });

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected');
});

// ─────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║    GuardianEye Server v2.0             ║');
  console.log(`  ║    Running on http://localhost:${PORT}     ║`);
  console.log('  ║    Fire · Accident · Multi-Alert       ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
});

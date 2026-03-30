const express = require('express');
const router = express.Router();
const { upload, deleteFile } = require('../middleware/upload');
const { analyzeVideo } = require('../services/aiService');
const AlertLog = require('../models/AlertLog');

// POST /api/upload — handle video file upload and analysis
router.post('/', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const source = req.body.source || 'upload';

  console.log(`[Upload] Processing video: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('processing_status', { status: 'processing', message: `Analyzing ${req.file.originalname}...` });
    }

    const result = await analyzeVideo(filePath);

    // ─── Store typed alert detections in MongoDB ───
    const savedLogs = [];
    const alertsToSave = result.alerts || [];

    // If top-level alerts array is populated, use it
    if (alertsToSave.length > 0) {
      for (const alertItem of alertsToSave) {
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
          savedLogs.push(log);
        } catch (dbErr) {
          console.error('[Upload] DB save error:', dbErr.message);
        }
      }
    } else if (result.alert) {
      // Fallback: save top-level result as a single log entry
      try {
        const log = await AlertLog.create({
          timestamp: new Date(result.timestamp),
          status: 'alert',
          alertType: result.alertType || 'anomaly',
          severity: result.severity || 'medium',
          confidence: result.confidence,
          reason: result.reason,
          source
        });
        savedLogs.push(log);
      } catch (dbErr) {
        console.error('[Upload] DB save error:', dbErr.message);
      }
    }

    // ─── Emit results via Socket.io ───
    if (io) {
      io.emit('video_analysis_complete', {
        alert: result.alert,
        alerts: result.alerts || [],
        confidence: result.confidence,
        reason: result.reason,
        status: result.status || (result.alert ? 'warning' : 'safe'),
        detections: result.detections || [],
        source,
        filename: req.file.originalname,
        logsStored: savedLogs.length
      });

      if (result.alert) {
        io.emit('detection_result', {
          alert: true,
          alerts: result.alerts || [],
          alertType: result.alertType || 'anomaly',
          severity: result.severity || 'medium',
          confidence: result.confidence,
          reason: result.reason,
          status: result.status || 'warning',
          source,
          timestamp: new Date().toISOString()
        });
      }

      io.emit('processing_status', { status: 'idle', message: 'Analysis complete' });
    }

    // Clean up uploaded file
    deleteFile(filePath);

    res.json({
      success: true,
      alert: result.alert,
      alerts: result.alerts || [],
      alertType: result.alertType || null,
      severity: result.severity || null,
      confidence: result.confidence,
      reason: result.reason,
      status: result.status || (result.alert ? 'warning' : 'safe'),
      totalFramesAnalyzed: result.analyzed_frames || 0,
      alertFrames: result.alert_frames || 0,
      logsStored: savedLogs.length
    });
  } catch (err) {
    console.error('[Upload] Error during analysis:', err);
    deleteFile(filePath);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

module.exports = router;

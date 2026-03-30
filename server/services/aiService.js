const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Analyze a single base64-encoded image frame
 * @param {string} base64Image - Base64 image string (no data URI prefix)
 * @param {string} source - Input source: 'live' | 'upload' | 'drone'
 */
async function analyzeFrame(base64Image, source = 'live') {
  try {
    const response = await axios.post(
      `${AI_URL}/detect`,
      { image: base64Image, source },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (err) {
    console.warn('[AI Service] Frame analysis failed:', err.message);
    return { alert: false, confidence: 0, reason: 'AI service unavailable', timestamp: new Date().toISOString() };
  }
}

/**
 * Analyze an uploaded video file by sending the file path to Python
 * Python reads, samples every Nth frame, and returns aggregated results
 * @param {string} filePath - Absolute path to the video file
 */
async function analyzeVideo(filePath) {
  try {
    const response = await axios.post(
      `${AI_URL}/analyze-video`,
      { file_path: filePath },
      { timeout: 120000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (err) {
    console.warn('[AI Service] Video analysis failed:', err.message);
    return {
      alert: false,
      confidence: 0,
      reason: 'AI service unavailable',
      detections: [],
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Analyze a YouTube URL server-side via yt-dlp + Python AI pipeline
 * @param {string} youtubeUrl - Full YouTube URL
 * @param {number} maxFrames - Max number of frames to sample (default 60)
 * @param {number} sampleEvery - Sample every N frames (default 5)
 */
async function analyzeYouTubeUrl(youtubeUrl, maxFrames = 60, sampleEvery = 5) {
  try {
    const response = await axios.post(
      `${AI_URL}/analyze-youtube`,
      { url: youtubeUrl, max_frames: maxFrames, sample_every: sampleEvery },
      { timeout: 300000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (err) {
    console.warn('[AI Service] YouTube analysis failed:', err.message);
    return {
      alert: false, confidence: 0,
      reason: 'YouTube analysis failed — check yt-dlp installation',
      detections: [], analyzed_frames: 0, alert_frames: 0,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check if Python AI service is reachable
 */
async function healthCheck() {
  try {
    const res = await axios.get(`${AI_URL}/health`, { timeout: 3000 });
    return res.data.status === 'ok';
  } catch {
    return false;
  }
}

module.exports = { analyzeFrame, analyzeVideo, analyzeYouTubeUrl, healthCheck };

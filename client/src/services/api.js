import axios from 'axios';

const BASE = import.meta.env.VITE_BACKEND_URL
  ? `${import.meta.env.VITE_BACKEND_URL}/api`
  : '/api';

export const api = {
  // Upload a video file for analysis
  uploadVideo: async (file, source = 'upload', onProgress) => {
    const form = new FormData();
    form.append('video', file);
    form.append('source', source);
    const res = await axios.post(`${BASE}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / e.total))
        : undefined,
      timeout: 180000 // 3 min
    });
    return res.data;
  },

  // Fetch paginated alert logs
  getLogs: async ({ page = 1, limit = 20, source, status } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (source) params.append('source', source);
    if (status) params.append('status', status);
    const res = await axios.get(`${BASE}/logs?${params}`);
    return res.data;
  },

  // Get stats summary
  getStats: async () => {
    const res = await axios.get(`${BASE}/logs/stats`);
    return res.data;
  },

  // Delete a single log
  deleteLog: async (id) => {
    const res = await axios.delete(`${BASE}/logs/${id}`);
    return res.data;
  },

  // Clear all logs
  clearLogs: async () => {
    const res = await axios.delete(`${BASE}/logs`);
    return res.data;
  },

  // Analyze a YouTube URL via server-side yt-dlp + AI
  analyzeYouTube: async (url, maxFrames = 60, sampleEvery = 5) => {
    const res = await axios.post(`${BASE}/analyze-youtube`, {
      url, max_frames: maxFrames, sample_every: sampleEvery
    }, { timeout: 300000 }); // 5 min max
    return res.data;
  },

  // Health check
  health: async () => {
    const res = await axios.get(`${BASE}/health`, { timeout: 5000 });
    return res.data;
  }
};

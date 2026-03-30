import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../services/api';

const FRAME_INTERVAL_MS = 200; // Capture frame every 200ms (5 FPS), server samples every 5th

export default function VideoPlayer({ source, sendFrame, onUploadResult, isAlert }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState('');
  const [droneUrl, setDroneUrl] = useState('');
  const [droneConnected, setDroneConnected] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Stop frame capture
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setDroneConnected(false);
  }, []);

  // Capture current frame from video element and send
  const captureAndSend = useCallback((src) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight) || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 without the 'data:image/jpeg;base64,' prefix
    const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    sendFrame(b64, src);
  }, [sendFrame]);

  // Start webcam
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        intervalRef.current = setInterval(() => captureAndSend('live'), FRAME_INTERVAL_MS);
      }
    } catch (err) {
      setCameraError(`Camera access denied: ${err.message}`);
    }
  }, [captureAndSend]);

  // Stop everything when source changes
  useEffect(() => {
    stopCapture();
    setUploadFile(null);
    setUploadProgress(0);
    setYoutubeEmbedUrl('');
    setCameraError('');
    setAnalyzing(false);
  }, [source, stopCapture]);

  // Auto-start camera when switching to live
  useEffect(() => {
    if (source === 'live') {
      startCamera();
    }
    return () => stopCapture();
  }, [source]); // eslint-disable-line

  // Handle file upload for offline analysis
  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadProgress(0);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setAnalyzing(true);
    setUploadProgress(0);
    try {
      const result = await api.uploadVideo(uploadFile, 'upload', setUploadProgress);
      onUploadResult?.(result);
    } catch (err) {
      console.error('[Upload] Error:', err);
      onUploadResult?.({ error: err.message });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  // Connect to MJPEG/IP camera stream
  const connectDrone = () => {
    if (!droneUrl.trim()) return;
    setDroneConnected(true);
    // For MJPEG streams, we can display directly in img tag
    // Capture from canvas periodically
    if (videoRef.current) {
      videoRef.current.src = droneUrl;
      videoRef.current.play().catch(() => {});
      intervalRef.current = setInterval(() => captureAndSend('drone'), FRAME_INTERVAL_MS);
    }
  };

  const parseYouTubeEmbed = (url) => {
    const regexes = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    for (const re of regexes) {
      const m = url.match(re);
      if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
    }
    return null;
  };

  const [youtubeAnalyzing, setYoutubeAnalyzing] = useState(false);
  const [youtubeResult, setYoutubeResult]       = useState(null);
  const [youtubeError, setYoutubeError]         = useState('');

  const connectYouTube = async () => {
    const embedUrl = parseYouTubeEmbed(youtubeUrl);
    if (!embedUrl) { alert('Invalid YouTube URL'); return; }

    setYoutubeEmbedUrl(embedUrl);
    setYoutubeResult(null);
    setYoutubeError('');
    setYoutubeAnalyzing(true);

    try {
      const result = await api.analyzeYouTube(youtubeUrl, 60, 5);
      setYoutubeResult(result);
      // Surface alerts to parent dashboard via onUploadResult
      onUploadResult?.(result);
    } catch (err) {
      console.error('[YouTube] Analysis error:', err);
      setYoutubeError(err.message || 'Analysis failed');
    } finally {
      setYoutubeAnalyzing(false);
    }
  };

  // ─── Render by source ───────────────────────────────

  if (source === 'live') {
    return (
      <div className="video-wrapper">
        <video ref={videoRef} className="video-element" autoPlay muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="video-overlay">
          <div className="video-corner tl" /><div className="video-corner tr" />
          <div className="video-corner bl" /><div className="video-corner br" />
          {cameraActive && <div className="scan-line" />}
          <div className={`video-badge ${isAlert ? 'alert-badge' : ''}`}>
            {cameraActive ? (isAlert ? '⚠ ANOMALY' : '● LIVE') : 'INITIALIZING'}
          </div>
        </div>
        {!cameraActive && (
          <div className="video-placeholder">
            <div className="video-placeholder-icon">📷</div>
            <h3>{cameraError || 'Starting camera…'}</h3>
            {cameraError && (
              <button className="upload-btn" onClick={startCamera} style={{ marginTop: 8 }}>Retry</button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (source === 'upload') {
    return (
      <div className="video-wrapper" style={{ flexDirection: 'column', padding: 16, background: 'transparent' }}>
        {!uploadFile ? (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => document.getElementById('file-input').click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
          >
            <div className="upload-icon">🎬</div>
            <div className="upload-title">Drop video file here</div>
            <div className="upload-sub">or click to browse</div>
            <div className="upload-limit">MP4, AVI, MOV, MKV, WEBM · Max 20 MB</div>
            <button className="upload-btn" onClick={(e) => e.stopPropagation()}>Browse Files</button>
            <input
              id="file-input"
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
              <div style={{ fontSize: 28 }}>🎬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{uploadFile.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              {!uploading && (
                <button className="panel-action-btn" onClick={() => setUploadFile(null)}>✕ Remove</button>
              )}
            </div>

            {uploading && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Analyzing frames with AI…'}
                </div>
                <div className="upload-progress">
                  <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
                {analyzing && <div className="processing-bar" style={{ marginTop: 4, borderRadius: 2 }} />}
              </div>
            )}

            <video
              ref={videoRef}
              src={URL.createObjectURL(uploadFile)}
              controls
              style={{ flex: 1, borderRadius: 8, background: '#000', minHeight: 0, width: '100%' }}
            />

            {!uploading && (
              <button className="upload-btn" style={{ alignSelf: 'center' }} onClick={handleUploadSubmit}>
                🔍 Analyze with AI
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (source === 'youtube') {
    return (
      <div className="video-wrapper" style={{ flexDirection: 'column' }}>
        {!youtubeEmbedUrl ? (
          <div className="video-placeholder">
            <div style={{ fontSize: 42 }}>▶</div>
            <h3>YouTube Stream Analysis</h3>
            <p>Paste a YouTube URL — the AI service will download and analyze frames server-side via yt-dlp.</p>
            <div className="url-input-group" style={{ padding: 0, width: '100%', maxWidth: 440 }}>
              <input
                className="url-input"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connectYouTube()}
              />
              <button className="url-connect-btn" onClick={connectYouTube} disabled={youtubeAnalyzing}>
                {youtubeAnalyzing ? '⏳ Analyzing…' : '🔍 Analyze'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <iframe
              src={youtubeEmbedUrl}
              title="YouTube Stream"
              style={{ flex: 1, border: 'none', width: '100%', borderRadius: 0, minHeight: 220 }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />

            {/* Analysis status bar */}
            <div style={{
              padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 10
            }}>
              {youtubeAnalyzing && (
                <>
                  <div className="processing-bar" style={{ flex: 1, height: 4, borderRadius: 2 }} />
                  <span style={{ fontSize: 11, color: 'var(--color-warning)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    ⏳ AI analyzing via yt-dlp…
                  </span>
                </>
              )}

              {!youtubeAnalyzing && youtubeResult && (
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: youtubeResult.alert ? 'var(--color-danger)' : 'var(--color-success)'
                }}>
                  {youtubeResult.alert
                    ? `🚨 ${youtubeResult.reason} (${(youtubeResult.confidence * 100).toFixed(0)}%)`
                    : '✅ No threats detected in analyzed frames'}
                </span>
              )}

              {!youtubeAnalyzing && youtubeError && (
                <span style={{ fontSize: 11, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                  ❌ {youtubeError}
                </span>
              )}

              {!youtubeAnalyzing && !youtubeResult && !youtubeError && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Ready — analysis complete
                </span>
              )}

              <button
                className="panel-action-btn"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
                onClick={() => { setYoutubeEmbedUrl(''); setYoutubeResult(null); setYoutubeError(''); }}
              >
                ↩ Change URL
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (source === 'drone') {
    return (
      <div className="video-wrapper" style={{ flexDirection: 'column' }}>
        {!droneConnected ? (
          <div className="video-placeholder">
            <div style={{ fontSize: 42 }}>🛸</div>
            <h3>IP Camera / Drone Feed</h3>
            <p>Enter an MJPEG stream URL. RTSP streams require the AI service to connect directly.</p>
            <div className="url-input-group" style={{ padding: 0, width: '100%', maxWidth: 420 }}>
              <input
                className="url-input"
                placeholder="http://192.168.1.100:8080/video"
                value={droneUrl}
                onChange={(e) => setDroneUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connectDrone()}
              />
              <button className="url-connect-btn" onClick={connectDrone}>Connect</button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="video-element"
              autoPlay muted playsInline
              crossOrigin="anonymous"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="video-overlay">
              <div className="video-corner tl" /><div className="video-corner tr" />
              <div className="video-corner bl" /><div className="video-corner br" />
              <div className="scan-line" />
              <div className={`video-badge ${isAlert ? 'alert-badge' : ''}`}>
                {isAlert ? '⚠ ANOMALY' : '● DRONE/IP'}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

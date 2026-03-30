import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [latestDetection, setLatestDetection] = useState(null);
  // alerts[] now contains typed alert objects with alertType, severity, etc.
  const [alerts, setAlerts] = useState([]);
  const [processingStatus, setProcessingStatus] = useState({ status: 'idle', message: '' });
  const [videoAnalysisResult, setVideoAnalysisResult] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    // Every analyzed frame result (includes full alert tree)
    socket.on('detection_result', (data) => {
      setLatestDetection(data);
    });

    // Fired for each individual typed alert saved to DB
    socket.on('new_alert', (data) => {
      setAlerts((prev) => [
        { ...data, id: `${Date.now()}-${Math.random()}` },
        ...prev.slice(0, 49) // keep max 50 in session
      ]);
    });

    socket.on('processing_status', (data) => {
      setProcessingStatus(data);
    });

    socket.on('video_analysis_complete', (data) => {
      setVideoAnalysisResult(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendFrame = useCallback((base64Frame, source = 'live') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('analyze_frame', { frame: base64Frame, source });
    }
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);
  const clearVideoResult = useCallback(() => setVideoAnalysisResult(null), []);

  // Derive overall system status from latest detection
  const systemStatus = latestDetection?.status || 'safe';
  const isAlert = latestDetection?.alert || videoAnalysisResult?.alert || false;

  return {
    connected,
    latestDetection,
    alerts,
    processingStatus,
    videoAnalysisResult,
    systemStatus,
    isAlert,
    sendFrame,
    clearAlerts,
    clearVideoResult
  };
}

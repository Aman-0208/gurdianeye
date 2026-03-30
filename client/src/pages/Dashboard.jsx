import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { api } from '../services/api';
import VideoPlayer from '../components/VideoPlayer';
import AlertPanel from '../components/AlertPanel';
import LogsPanel from '../components/LogsPanel';
import SourceSelector from '../components/SourceSelector';
import StatusBadge from '../components/StatusBadge';

// Critical alert overlay shown for fire_severe events
function CriticalOverlay({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className="critical-overlay" onClick={onDismiss}>
      <div className="critical-overlay-box" onClick={(e) => e.stopPropagation()}>
        <div className="critical-overlay-icon">🚨</div>
        <div className="critical-overlay-title">CRITICAL ALERT</div>
        <div className="critical-overlay-type">{alert.label || 'Severe Fire Detected'}</div>
        <div className="critical-overlay-reason">{alert.reason}</div>
        <div className="critical-overlay-conf">
          Confidence: {((alert.confidence || 0) * 100).toFixed(1)}% · Source: {alert.source || 'live'}
        </div>
        <button className="critical-overlay-btn" onClick={onDismiss}>Acknowledge</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [source, setSource] = useState('live');
  const [systemHealth, setSystemHealth] = useState(null);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [criticalAlert, setCriticalAlert] = useState(null);

  const {
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
  } = useSocket();

  // Show critical overlay for fire_severe alerts
  useEffect(() => {
    const latestCritical = alerts.find(
      (a) => a.alertType === 'fire_severe' || a.severity === 'critical'
    );
    if (latestCritical && !criticalAlert) {
      setCriticalAlert(latestCritical);
    }
  }, [alerts]); // eslint-disable-line

  // Fetch system health periodically
  const fetchHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setSystemHealth(h);
    } catch {
      setSystemHealth({ server: false, mongodb: false, aiService: false });
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 15000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  // Refresh logs after video analysis
  useEffect(() => {
    if (videoAnalysisResult) {
      setLogsRefreshKey((k) => k + 1);
    }
  }, [videoAnalysisResult]);

  const handleUploadResult = (result) => {
    setUploadResult(result);
    setLogsRefreshKey((k) => k + 1);
  };

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    setUploadResult(null);
    clearVideoResult();
  };

  const sessionAlerts = alerts.length;

  // Derive status color for header
  const statusColors = {
    safe:     'var(--color-safe)',
    warning:  'var(--color-warning)',
    critical: 'var(--color-alert)',
  };
  const statusColor = statusColors[systemStatus] || 'var(--accent-blue)';

  return (
    <div className="app-layout">
      <div className="app-bg" />
      <div className="app-grid-lines" />

      {/* Critical overlay */}
      {criticalAlert && (
        <CriticalOverlay
          alert={criticalAlert}
          onDismiss={() => setCriticalAlert(null)}
        />
      )}

      {/* ─── Header ─── */}
      <header className="header" role="banner">
        <div className="header-logo">
          <div className="header-logo-icon">👁</div>
          <div>
            <div className="header-title">GuardianEye</div>
            <div className="header-subtitle">AI Monitoring System v2.0</div>
          </div>
        </div>

        <div className="header-right">
          {/* System Status Chip */}
          <div className={`system-status-chip status-${systemStatus}`}>
            <span className="system-status-dot" />
            {systemStatus.toUpperCase()}
          </div>

          {/* AI + DB status */}
          {systemHealth && (
            <div className={`ai-status-chip ${systemHealth.aiService ? 'online' : 'offline'}`}>
              <span className="ai-status-dot" />
              AI {systemHealth.aiService ? 'Online' : 'Offline'}
            </div>
          )}
          {systemHealth && (
            <div className={`ai-status-chip ${systemHealth.mongodb ? 'online' : 'offline'}`}>
              <span className="ai-status-dot" />
              DB {systemHealth.mongodb ? 'Connected' : 'Offline'}
            </div>
          )}

          <div className="header-stat">
            <span className="header-stat-label">Session Alerts</span>
            <span className="header-stat-value" style={{ color: sessionAlerts > 0 ? statusColor : 'var(--accent-blue)' }}>
              {sessionAlerts}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`connection-dot ${connected ? '' : 'disconnected'}`} />
            <span style={{ fontSize: 12, color: connected ? 'var(--color-safe)' : 'var(--text-muted)' }}>
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Processing progress bar */}
      {processingStatus.status === 'processing' && (
        <div title={processingStatus.message}>
          <div className="processing-bar" />
        </div>
      )}

      {/* ─── Main Dashboard ─── */}
      <main className="dashboard" role="main">
        {/* LEFT COLUMN */}
        <div className="dashboard-left">
          {/* Video Player */}
          <div className="glass-panel video-container">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-title-dot" />
                Video Feed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge
                  detection={latestDetection || videoAnalysisResult}
                  isActive={source !== 'youtube'}
                />
                <SourceSelector activeSource={source} onChange={handleSourceChange} />
              </div>
            </div>

            <VideoPlayer
              source={source}
              sendFrame={sendFrame}
              onUploadResult={handleUploadResult}
              isAlert={isAlert}
              systemStatus={systemStatus}
            />
          </div>

          {/* Video Analysis Result Banner */}
          {uploadResult && !uploadResult.error && (
            <div className={`upload-result-banner ${uploadResult.alert ? 'alert' : 'safe'}`}>
              <span style={{ fontSize: 22 }}>{uploadResult.alert ? '⚠' : '✓'}</span>
              <div style={{ flex: 1 }}>
                <div className="upload-result-title">
                  {uploadResult.alert ? 'Threats Detected in Video' : 'No Threats Found'}
                  {uploadResult.alert && ` · ${((uploadResult.confidence || 0) * 100).toFixed(1)}% confidence`}
                </div>
                <div className="upload-result-sub">
                  {uploadResult.reason} · {uploadResult.totalFramesAnalyzed || 0} frames analyzed · {uploadResult.alertFrames || 0} flagged
                  {uploadResult.alertType && (
                    <span style={{ marginLeft: 8, color: 'var(--color-alert)' }}>
                      [{uploadResult.alertType.replace('_', ' ')}]
                    </span>
                  )}
                </div>
              </div>
              <button className="panel-action-btn" onClick={() => setUploadResult(null)}>✕</button>
            </div>
          )}

          {/* Logs */}
          <LogsPanel refreshTrigger={logsRefreshKey} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="dashboard-right">
          {/* Alert Panel */}
          <AlertPanel alerts={alerts} onClear={clearAlerts} />

          {/* System Status Panel */}
          <div className="glass-panel" style={{ padding: 16, flexShrink: 0 }}>
            <div className="panel-header" style={{ padding: '0 0 12px 0', marginBottom: 12 }}>
              <div className="panel-title">
                <span className="panel-title-dot" />
                System Status
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'WebSocket',    ok: connected,               icon: '🔌' },
                { label: 'AI Service',   ok: systemHealth?.aiService,  icon: '🧠' },
                { label: 'MongoDB',      ok: systemHealth?.mongodb,    icon: '🗄' },
                { label: 'Node Server',  ok: systemHealth?.server,     icon: '⚙' }
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>{item.icon}</span>{item.label}
                  </span>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: item.ok ? 'var(--color-safe)' : (item.ok === false ? 'var(--color-alert)' : 'var(--text-muted)'),
                    display: 'flex', gap: 5, alignItems: 'center'
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: item.ok ? 'var(--color-safe)' : (item.ok === false ? 'var(--color-alert)' : 'var(--text-muted)')
                    }} />
                    {item.ok ? 'Online' : (item.ok === false ? 'Offline' : 'Checking…')}
                  </span>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🎯 Input Source</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                    {source}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📊 Frame Sampling</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Every 5th frame</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔒 Alert Status</span>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    color: statusColor, textTransform: 'uppercase'
                  }}>
                    {systemStatus}
                  </span>
                </div>
              </div>

              {/* Alert type breakdown mini-stats */}
              {alerts.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                    Session Breakdown
                  </div>
                  {['fire_severe', 'fire_moderate', 'fire_small', 'accident', 'signal_lost', 'anomaly'].map((type) => {
                    const count = alerts.filter(a => a.alertType === type).length;
                    if (!count) return null;
                    const icons = { fire_severe: '🚨', fire_moderate: '🔥', fire_small: '⚠️', accident: '🚗', signal_lost: '📡', anomaly: '⚠️' };
                    return (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {icons[type]} {type.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

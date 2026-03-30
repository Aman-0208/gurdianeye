// Alert type metadata for display
const ALERT_META = {
  fire_small:    { emoji: '⚠️',  label: 'Small Fire',    color: 'var(--color-warning)',  bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.25)' },
  fire_moderate: { emoji: '🔥',  label: 'Moderate Fire', color: '#ff7c00',               bg: 'rgba(255,124,0,0.08)',   border: 'rgba(255,124,0,0.25)' },
  fire_severe:   { emoji: '🚨',  label: 'Severe Fire',   color: 'var(--color-alert)',    bg: 'rgba(255,68,68,0.12)',   border: 'rgba(255,68,68,0.4)'  },
  accident:      { emoji: '🚗',  label: 'Road Accident', color: '#c084fc',               bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.3)' },
  signal_lost:   { emoji: '📡',  label: 'Signal Lost',   color: 'var(--text-muted)',     bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
  anomaly:       { emoji: '⚠️',  label: 'Anomaly',       color: 'var(--color-warning)',  bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.2)'  },
};

const SEVERITY_META = {
  low:      { label: 'LOW',      color: 'var(--color-warning)', bg: 'rgba(255,184,0,0.12)'   },
  medium:   { label: 'MEDIUM',   color: '#fb923c',              bg: 'rgba(251,146,60,0.12)'  },
  high:     { label: 'HIGH',     color: '#ef4444',              bg: 'rgba(239,68,68,0.12)'   },
  critical: { label: 'CRITICAL', color: 'var(--color-alert)',   bg: 'rgba(255,68,68,0.18)'   },
};

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AlertPanel({ alerts, onClear }) {
  const alertCount = alerts.filter(a => a.alert !== false).length;

  return (
    <div className="glass-panel alert-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-title-dot" style={{
            background: alertCount > 0 ? 'var(--color-alert)' : 'var(--accent-blue)',
            boxShadow: alertCount > 0 ? '0 0 6px var(--color-alert)' : '0 0 6px var(--accent-blue)'
          }} />
          Real-Time Alerts
          {alertCount > 0 && (
            <span className="alert-count-badge">{alertCount}</span>
          )}
        </div>
        {alertCount > 0 && (
          <button className="panel-action-btn danger" onClick={onClear}>Clear</button>
        )}
      </div>

      <div className="alert-list">
        {alerts.length === 0 ? (
          <div className="alert-empty">
            <div className="alert-empty-icon">🛡</div>
            <div style={{ fontWeight: 600, color: 'var(--color-safe)' }}>All Clear</div>
            <div>No alerts detected. System monitoring active.</div>
          </div>
        ) : (
          alerts.map((alert) => {
            const alertType = alert.alertType || 'anomaly';
            const severity  = alert.severity  || 'medium';
            const meta    = ALERT_META[alertType]    || ALERT_META.anomaly;
            const sevMeta = SEVERITY_META[severity]  || SEVERITY_META.medium;
            const isCritical = severity === 'critical';

            return (
              <div
                key={alert.id}
                className={`alert-item ${isCritical ? 'alert-critical' : 'alert-type'}`}
                style={{ background: meta.bg, borderColor: meta.border }}
              >
                <div className="alert-item-header">
                  <div className="alert-item-label" style={{ color: meta.color }}>
                    <span className="alert-type-emoji">{meta.emoji}</span>
                    <span>{meta.label || alertType}</span>
                    {isCritical && <span className="alert-critical-pulse">●</span>}
                  </div>
                  <span className="alert-item-time">{formatTime(alert.timestamp)}</span>
                </div>

                <div className="alert-item-reason">{alert.reason || 'Detection triggered'}</div>

                <div className="alert-item-meta">
                  <span className="alert-badge-source">{alert.source || 'live'}</span>
                  <span
                    className="severity-badge"
                    style={{ color: sevMeta.color, background: sevMeta.bg }}
                  >
                    {sevMeta.label}
                  </span>
                  <span className="alert-badge-conf">
                    {((alert.confidence || 0) * 100).toFixed(1)}% conf
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

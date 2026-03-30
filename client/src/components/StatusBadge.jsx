// StatusBadge — shows SAFE / WARNING / CRITICAL based on detection status
const STATUS_CONFIG = {
  safe:     { label: 'SAFE',     icon: '✓',  className: 'safe',     confColor: 'var(--color-safe)'    },
  warning:  { label: 'WARNING',  icon: '⚠',  className: 'warning',  confColor: 'var(--color-warning)' },
  critical: { label: 'CRITICAL', icon: '🚨', className: 'critical', confColor: 'var(--color-alert)'   },
};

const ALERT_TYPE_LABELS = {
  fire_small:    '⚠️ Small Fire',
  fire_moderate: '🔥 Moderate Fire',
  fire_severe:   '🚨 Severe Fire',
  accident:      '🚗 Accident',
  signal_lost:   '📡 Signal Lost',
  anomaly:       '⚠️ Anomaly',
};

export default function StatusBadge({ detection, isActive = false }) {
  const status     = detection?.status || (detection?.alert ? 'warning' : 'safe');
  const config     = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  const confidence = detection?.confidence || 0;
  const alertType  = detection?.alertType  || null;
  const reason     = detection?.reason     || 'Normal activity';

  // Pick label — prefer typed alert label, fall back to reason
  const shortLabel = alertType ? (ALERT_TYPE_LABELS[alertType] || reason) : reason;
  const displayLabel = shortLabel.length > 40 ? shortLabel.slice(0, 40) + '…' : shortLabel;

  return (
    <div className="status-badge-container">
      <div className={`status-badge ${config.className}`}>
        <span className="status-badge-indicator" />
        <span>{config.icon} {config.label}</span>
      </div>

      {isActive && (
        <div className="confidence-bar-wrapper">
          <div className="confidence-label">
            <span title={reason} style={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: 200
            }}>
              {displayLabel}
            </span>
            <span style={{ color: config.confColor, marginLeft: 8, flexShrink: 0 }}>
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="confidence-bar">
            <div
              className={`confidence-fill ${config.className === 'safe' ? 'safe' : 'alert'}`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

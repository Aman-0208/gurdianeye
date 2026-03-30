import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const ALERT_TYPE_META = {
  fire_small:    { emoji: '⚠️',  label: 'Small Fire',    color: 'var(--color-warning)' },
  fire_moderate: { emoji: '🔥',  label: 'Moderate Fire', color: '#ff7c00' },
  fire_severe:   { emoji: '🚨',  label: 'Severe Fire',   color: 'var(--color-alert)' },
  accident:      { emoji: '🚗',  label: 'Accident',      color: '#c084fc' },
  signal_lost:   { emoji: '📡',  label: 'Signal Lost',   color: 'var(--text-muted)' },
  anomaly:       { emoji: '⚠️',  label: 'Anomaly',       color: 'var(--color-warning)' },
};

const SEVERITY_COLORS = {
  low:      { color: 'var(--color-warning)', bg: 'rgba(255,184,0,0.12)'   },
  medium:   { color: '#fb923c',              bg: 'rgba(251,146,60,0.12)'  },
  high:     { color: '#ef4444',              bg: 'rgba(239,68,68,0.12)'   },
  critical: { color: 'var(--color-alert)',   bg: 'rgba(255,68,68,0.18)'   },
};

function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

export default function LogsPanel({ refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [filterType, setFilterType] = useState('');

  const fetchLogs = useCallback(async (page = 1, type = filterType) => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (type) params.alertType = type;

      const [logsData, statsData] = await Promise.all([
        api.getLogs(params),
        api.getStats()
      ]);
      setLogs(logsData.logs || []);
      setPagination(logsData.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
      setStats(statsData);
    } catch (err) {
      console.error('[Logs] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs, refreshTrigger]);

  const handleFilterChange = (type) => {
    setFilterType(type);
    fetchLogs(1, type);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteLog(id);
      setLogs((prev) => prev.filter((l) => l._id !== id));
      setStats((s) => s ? { ...s, total: s.total - 1, alerts: Math.max(0, (s.alerts || 1) - 1) } : s);
    } catch (err) {
      console.error('[Logs] Delete error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all logs from database?')) return;
    try {
      await api.clearLogs();
      setLogs([]);
      setStats({ total: 0, alerts: 0, safe: 0, lastAlert: null });
      setPagination({ page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      console.error('[Logs] Clear error:', err);
    }
  };

  const confColor = (conf) => {
    if (conf > 0.7) return 'var(--color-alert)';
    if (conf > 0.4) return '#ff7c00';
    return 'var(--color-safe)';
  };

  // Alert type breakdown chips from stats
  const typeBreakdown = stats?.typeBreakdown || {};

  return (
    <div className="glass-panel logs-panel" style={{ maxHeight: 280 }}>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-title-dot" />
          Detection History
          {stats && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>
              — {stats.total} total · {stats.alerts} alerts
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="panel-action-btn" onClick={() => fetchLogs(pagination.page)}>↻</button>
          {logs.length > 0 && (
            <button className="panel-action-btn danger" onClick={handleClearAll}>Clear All</button>
          )}
        </div>
      </div>

      {/* Alert type filter chips */}
      {Object.keys(typeBreakdown).length > 0 && (
        <div className="logs-filter-row">
          <button
            className={`logs-filter-chip ${filterType === '' ? 'active' : ''}`}
            onClick={() => handleFilterChange('')}
          >
            All
          </button>
          {Object.entries(typeBreakdown).map(([type, data]) => {
            const meta = ALERT_TYPE_META[type] || ALERT_TYPE_META.anomaly;
            return (
              <button
                key={type}
                className={`logs-filter-chip ${filterType === type ? 'active' : ''}`}
                onClick={() => handleFilterChange(type)}
                style={filterType === type ? { borderColor: meta.color, color: meta.color } : {}}
              >
                {meta.emoji} {meta.label} ({data.count})
              </button>
            );
          })}
        </div>
      )}

      {loading && <div className="processing-bar" />}

      <div className="logs-list">
        {logs.length === 0 && !loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {filterType ? `No ${ALERT_TYPE_META[filterType]?.label || filterType} logs yet.` : 'No detection logs yet. Start monitoring to see history.'}
          </div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Severity</th>
                <th>Src</th>
                <th>Conf</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const typeMeta = ALERT_TYPE_META[log.alertType] || ALERT_TYPE_META.anomaly;
                const sevMeta  = SEVERITY_COLORS[log.severity]   || SEVERITY_COLORS.medium;
                return (
                  <tr key={log._id}>
                    <td>
                      <span
                        className="log-type-chip"
                        style={{ color: typeMeta.color }}
                        title={typeMeta.label}
                      >
                        {typeMeta.emoji} {typeMeta.label}
                      </span>
                    </td>
                    <td>
                      <div className="log-reason-cell" title={log.reason}>{log.reason}</div>
                    </td>
                    <td>
                      <span
                        className="severity-badge"
                        style={{ color: sevMeta.color, background: sevMeta.bg }}
                      >
                        {(log.severity || 'medium').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="alert-badge-source">{log.source}</span>
                    </td>
                    <td>
                      <span className="log-confidence-cell" style={{ color: confColor(log.confidence) }}>
                        {((log.confidence || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className="log-time-cell">{formatDateTime(log.timestamp)}</span>
                    </td>
                    <td>
                      <button className="log-delete-btn" onClick={() => handleDelete(log._id)} title="Delete">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="logs-pagination">
          <button
            className="pagination-btn"
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages} · {pagination.total} entries
          </span>
          <button
            className="pagination-btn"
            onClick={() => fetchLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

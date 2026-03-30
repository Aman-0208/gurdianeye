export default function SourceSelector({ activeSource, onChange }) {
  const sources = [
    { id: 'live',    icon: '📹', label: 'Live Cam' },
    { id: 'upload',  icon: '📁', label: 'Upload' },
    { id: 'youtube', icon: '▶',  label: 'YouTube' },
    { id: 'drone',   icon: '🛸', label: 'Drone / IP' }
  ];

  return (
    <div className="source-selector">
      {sources.map((s) => (
        <button
          key={s.id}
          id={`source-tab-${s.id}`}
          className={`source-tab ${activeSource === s.id ? 'active' : ''}`}
          onClick={() => onChange(s.id)}
          title={s.label}
        >
          <span className="source-tab-icon">{s.icon}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

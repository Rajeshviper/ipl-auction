export default function BottomNav({ tabs, active, onChange }) {
  return (
    <div className="fab-nav">
      {tabs.map((t) => (
        <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => onChange(t.id)}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

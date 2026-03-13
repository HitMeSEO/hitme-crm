'use client';

export default function StatCard({ label, value, icon, color, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontWeight: 500,
          marginTop: 2,
        }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

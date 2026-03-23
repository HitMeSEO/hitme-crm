'use client';

export function Empty({ msg }) {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14,
    }}>
      {msg}
    </div>
  );
}

export function PlaceholderTab({ name, count }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 40, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {name} tab — {count || 0} items
      </div>
    </div>
  );
}

'use client';
import AppShell from '@/components/AppShell';

export default function ActivityPage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Activity</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Activity log — Phase 2B</p>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
      }}>
        Activity feed with notes, calls, emails, and meetings coming next.
      </div>
    </AppShell>
  );
}

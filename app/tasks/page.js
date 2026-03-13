'use client';
import AppShell from '@/components/AppShell';

export default function TasksPage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Tasks</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Task management — Phase 2B</p>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
      }}>
        Task board with assignments, due dates, and status tracking coming next.
      </div>
    </AppShell>
  );
}

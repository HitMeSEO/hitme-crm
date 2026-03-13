'use client';
import AppShell from '@/components/AppShell';

export default function ContentPage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Content</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Content calendar — Phase 2B</p>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
      }}>
        Content queue with blog posts, GBP posts, social content, and assignments coming next.
      </div>
    </AppShell>
  );
}

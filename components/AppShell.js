'use client';

import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="crm-main" style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
        maxHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  );
}

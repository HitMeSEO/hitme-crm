import { Suspense } from 'react';
import ClientsContent from './ClientsContent';

export default function ClientsPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>}>
      <ClientsContent />
    </Suspense>
  );
}

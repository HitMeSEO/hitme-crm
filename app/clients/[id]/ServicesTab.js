'use client';

import { createClient } from '@/lib/supabase/client';
import { SERVICE_KEYS } from '@/lib/constants';

function ServicesTab({ client, setClient, clientId }) {
  const supabase = createClient();

  const handleToggle = async (serviceKey) => {
    const newVal = !client[serviceKey];
    const { error } = await supabase.from('clients').update({ [serviceKey]: newVal }).eq('id', clientId);
    if (!error) setClient({ ...client, [serviceKey]: newVal });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {SERVICE_KEYS.map(s => {
        const active = !!client[s.key];
        return (
          <div
            key={s.key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-card)', border: `1px solid ${active ? s.color + '44' : 'var(--border)'}`,
              borderRadius: 10, padding: 16, opacity: active ? 1 : 0.7,
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: active ? s.color : 'var(--text-muted)' }}>{s.label}</span>
            </div>
            <button
              onClick={() => handleToggle(s.key)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: active ? s.color : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.15s ease',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%',
                background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                left: active ? 22 : 2, transition: 'left 0.15s ease',
              }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ServicesTab;

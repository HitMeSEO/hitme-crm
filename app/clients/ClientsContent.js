'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { SERVICE_KEYS, STATUS_COLORS } from '@/lib/constants';
import { Search, ExternalLink } from 'lucide-react';

export default function ClientsContent() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const searchParams = useSearchParams();
  const serviceFilter = searchParams.get('service') || 'all';
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('*').order('company_name');
      setClients(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clients.filter(c => {
    if (search && !c.company_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (serviceFilter !== 'all' && !c[serviceFilter]) return false;
    return true;
  });

  const statuses = ['all', ...new Set(clients.map(c => c.status).filter(Boolean))];

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Clients
            {serviceFilter !== 'all' && (
              <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, marginLeft: 8 }}>
                — {SERVICE_KEYS.find(s => s.key === serviceFilter)?.label}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} client{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', flex: '1 1 280px', maxWidth: 400,
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text" placeholder="Search clients..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: statusFilter === s ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: statusFilter === s ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {serviceFilter !== 'all' && (
          <button onClick={() => router.push('/clients')} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--danger)',
            background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            ✕ Clear service filter
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading clients...</div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Status', 'Services', 'Phone', 'Location'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {client.company_name}
                      </span>
                      {client.website && (
                        <a href={client.website} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--text-muted)', display: 'flex' }}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
                      color: STATUS_COLORS[client.status] || '#64748b',
                    }}>
                      {client.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {SERVICE_KEYS.filter(s => client[s.key]).map(s => (
                        <span key={s.key} title={s.label} style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                          background: `${s.color}18`, color: s.color,
                        }}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {client.phone}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {[client.address_city, client.address_state].filter(Boolean).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No clients match your filters
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

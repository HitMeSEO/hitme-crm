'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { SERVICE_KEYS, STATUS_COLORS } from '@/lib/constants';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentClients, setRecentClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { count: clientCount },
        { count: activeCount },
        { count: locationCount },
        { count: contactCount },
        { count: taskCount },
        { count: contentCount },
        { data: recent },
        { data: allClients },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('locations').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('content_queue').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('clients').select('*').eq('status', 'Active'),
      ]);

      // Count services
      const serviceCounts = {};
      SERVICE_KEYS.forEach(s => { serviceCounts[s.key] = 0; });
      (allClients || []).forEach(c => {
        SERVICE_KEYS.forEach(s => {
          if (c[s.key]) serviceCounts[s.key]++;
        });
      });

      setStats({
        clients: clientCount || 0,
        active: activeCount || 0,
        locations: locationCount || 0,
        contacts: contactCount || 0,
        tasks: taskCount || 0,
        content: contentCount || 0,
        serviceCounts,
      });
      setRecentClients(recent || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading dashboard...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Hit Me SEO — Client overview
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <StatCard label="Total Clients" value={stats.clients} icon="👥" color="#6366f1" />
        <StatCard label="Active" value={stats.active} icon="✓" color="#10b981" subtitle={`${Math.round(stats.active / stats.clients * 100)}% of total`} />
        <StatCard label="GBP Locations" value={stats.locations} icon="📍" color="#f59e0b" />
        <StatCard label="Contacts" value={stats.contacts} icon="📇" color="#3b82f6" />
        <StatCard label="Tasks" value={stats.tasks} icon="☑" color="#8b5cf6" />
        <StatCard label="Content Queue" value={stats.content} icon="✎" color="#ec4899" />
      </div>

      {/* Service Breakdown + Recent Clients */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Services */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Active Services
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SERVICE_KEYS.map(svc => {
              const count = stats.serviceCounts[svc.key] || 0;
              const pct = stats.active > 0 ? Math.round(count / stats.active * 100) : 0;
              return (
                <div key={svc.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{svc.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{svc.label}</span>
                  <div style={{
                    flex: 1,
                    height: 6,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: svc.color,
                      borderRadius: 3,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: svc.color,
                    width: 28,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                  }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Clients */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Recent Clients
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentClients.map(client => (
              <a
                key={client.id}
                href={`/clients/${client.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  transition: 'background 0.15s ease',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{client.company_name}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
                  color: STATUS_COLORS[client.status] || '#64748b',
                }}>
                  {client.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

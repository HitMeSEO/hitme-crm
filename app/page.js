'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { useRouter } from 'next/navigation';
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS } from '@/lib/constants';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentClients, setRecentClients] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

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
        { data: pendingTasksRaw },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'client'),
        supabase.from('locations').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true })
          .in('status', ['Not Started', 'In Progress', 'Pending Client Approval', 'Blocked']),
        supabase.from('content_queue').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('tasks')
          .select('id, title, priority, status, created_at, client_id, clients(id, company_name)')
          .in('status', ['Not Started', 'In Progress', 'Pending Client Approval', 'Blocked'])
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setStats({
        clients: clientCount || 0,
        active: activeCount || 0,
        locations: locationCount || 0,
        contacts: contactCount || 0,
        tasks: taskCount || 0,
        content: contentCount || 0,
      });
      setRecentClients(recent || []);
      setRecentTasks(pendingTasksRaw || []);
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
        <StatCard label="Clients" value={stats.active} icon="✓" color="#10b981" subtitle={stats.clients > 0 ? `${Math.round(stats.active / stats.clients * 100)}% of total` : ''} />
        <StatCard label="GBP Locations" value={stats.locations} icon="📍" color="#f59e0b" />
        <StatCard label="Contacts" value={stats.contacts} icon="📇" color="#3b82f6" />
        <StatCard label="Pending Tasks" value={stats.tasks} icon="☑" color="#8b5cf6" />
        <StatCard label="Content Queue" value={stats.content} icon="✎" color="#ec4899" />
      </div>

      {/* Pending Tasks + Recent Clients — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>

        {/* Pending Tasks — wider column */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Pending Tasks
              {stats.tasks > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                }}>
                  {stats.tasks} open
                </span>
              )}
            </h2>
            <a href="/tasks" style={{
              fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              textDecoration: 'none', padding: '4px 10px', borderRadius: 6,
              background: 'var(--accent-muted)',
            }}>
              View all →
            </a>
          </div>

          {recentTasks.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
              🎉 No pending tasks — you're all caught up!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentTasks.map(task => {
                const priorityColor = PRIORITY_COLORS[task.priority] || '#64748b';
                const clientName = task.clients?.company_name || '—';
                const clientId = task.clients?.id || task.client_id;
                const daysAgo = task.created_at
                  ? Math.floor((Date.now() - new Date(task.created_at)) / 86400000)
                  : null;
                const dateLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo != null ? `${daysAgo}d ago` : '';

                return (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/clients/${clientId}?tab=tasks`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 12px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      width: '100%', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{clientName}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: `${priorityColor}18`, color: priorityColor,
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {task.priority || 'Medium'}
                    </span>
                    {dateLabel && (
                      <span style={{
                        fontSize: 11, color: 'var(--text-muted)',
                        flexShrink: 0, whiteSpace: 'nowrap', minWidth: 56, textAlign: 'right',
                      }}>
                        {dateLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Clients — narrower column */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Recent Clients
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentClients.map(client => (
              <a
                key={client.id}
                href={`/clients/${client.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, transition: 'background 0.15s ease',
                  textDecoration: 'none', color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client.company_name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginLeft: 8,
                  background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
                  color: STATUS_COLORS[client.status] || '#64748b',
                  textTransform: 'capitalize',
                }}>
                  {STATUS_LABELS[client.status] || client.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

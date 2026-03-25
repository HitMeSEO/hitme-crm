'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { TASK_STATUS_COLORS, TASK_STATUSES, TASK_PRIORITIES, PRIORITY_COLORS } from '@/lib/constants';
import { Plus, Search, CheckSquare, Square } from 'lucide-react';

export default function TasksPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTitle, setSearchTitle] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '', client_id: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [
      { data: t },
      { data: c },
      { data: tm },
    ] = await Promise.all([
      supabase.from('tasks').select('*, clients(company_name)').order('due_date', { nullsFirst: false }),
      supabase.from('clients').select('id, company_name').order('company_name'),
      supabase.from('team_members').select('*').eq('is_active', true).order('first_name'),
    ]);
    setTasks(t || []);
    setClients(c || []);
    setTeamMembers(tm || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (searchTitle && !(task.title || '').toLowerCase().includes(searchTitle.toLowerCase())) return false;
    return true;
  });

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.client_id) return;
    setSaving(true);
    const { error } = await supabase.from('tasks').insert({
      client_id: form.client_id,
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    if (!error) {
      setForm({ title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '', client_id: '' });
      setShowAddForm(false);
      loadData();
    }
  };

  const getMemberName = (id) => {
    if (!id) return '—';
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  };

  const toggleDone = async (e, task) => {
    e.stopPropagation();
    const newStatus = task.status === 'Done' ? 'Not Started' : 'Done';
    const updates = { status: newStatus };
    if (newStatus === 'Done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    await supabase.from('tasks').update(updates).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
  };

  const getStatusColor = (status) => TASK_STATUS_COLORS[status] || '#64748b';
  const getPriorityColor = (priority) => PRIORITY_COLORS[priority] || '#64748b';

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', flex: '1 1 240px', maxWidth: 320,
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text" placeholder="Search by title..." value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Status:</span>
          {['all', ...TASK_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: statusFilter === s ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: statusFilter === s ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Priority:</span>
          {['all', ...TASK_PRIORITIES].map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: priorityFilter === p ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: priorityFilter === p ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{p === 'all' ? 'All' : p}</button>
          ))}
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveTask} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} placeholder="Task title" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Client *</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Optional description" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save Task'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading tasks...</div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ width: 44, padding: '12px 8px 12px 16px' }}></th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Task</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Due Date</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => (
                  <tr
                    key={task.id}
                    onClick={() => router.push(`/clients/${task.client_id}?tab=tasks`)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 8px 12px 16px', width: 44 }}>
                      <button onClick={(e) => toggleDone(e, task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                        {task.status === 'Done'
                          ? <CheckSquare size={18} style={{ color: '#10b981' }} />
                          : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: task.status === 'Done' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500, textDecoration: task.status === 'Done' ? 'line-through' : 'none' }}>{task.title}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{task.clients?.company_name || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                        background: `${getStatusColor(task.status)}18`, color: getStatusColor(task.status),
                      }}>{task.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                        background: `${getPriorityColor(task.priority)}18`, color: getPriorityColor(task.priority),
                      }}>{task.priority}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{getMemberName(task.assigned_to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No tasks match your filters
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

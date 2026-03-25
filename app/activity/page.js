'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { ACTIVITY_TYPES } from '@/lib/constants';
import { Plus, Search } from 'lucide-react';

export default function ActivityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [activities, setActivities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchContent, setSearchContent] = useState('');
  const [form, setForm] = useState({ activity_type: 'Note', content: '', client_id: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [
      { data: acts },
      { data: cl },
    ] = await Promise.all([
      supabase.from('activities').select('*, clients(company_name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ]);
    setActivities(acts || []);
    setClients(cl || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = activities.filter(act => {
    if (typeFilter !== 'all' && act.activity_type !== typeFilter) return false;
    if (searchContent && !(act.content || '').toLowerCase().includes(searchContent.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.content.trim() || !form.client_id) return;
    setSaving(true);
    const { error } = await supabase.from('activities').insert({
      client_id: form.client_id,
      activity_type: form.activity_type,
      content: form.content.trim(),
    });
    setSaving(false);
    if (!error) {
      setForm({ activity_type: 'Note', content: '', client_id: '' });
      setShowAddForm(false);
      loadData();
    }
  };

  const getActivityBadge = (type) => ACTIVITY_TYPES.find(a => a.value === type)?.badge || '📌';

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Activity</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} activit{filtered.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Note
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
            type="text" placeholder="Search by content..." value={searchContent}
            onChange={(e) => setSearchContent(e.target.value)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Type:</span>
          {['all', ...ACTIVITY_TYPES.map(a => a.value)].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: typeFilter === t ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: typeFilter === t ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'all' ? 'All' : `${ACTIVITY_TYPES.find(a => a.value === t)?.badge || '📌'} ${t}`}</button>
          ))}
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Client *</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Type</label>
              <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.badge} {a.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Content *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={4}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Note content..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading activity...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(act => (
            <div
              key={act.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', flexShrink: 0,
              }}>{getActivityBadge(act.activity_type)} {act.activity_type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => router.push(`/clients/${act.client_id}`)}
                  style={{
                    background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
                    fontSize: 14, fontWeight: 600, color: 'var(--accent)', textAlign: 'left', marginBottom: 8,
                  }}
                >
                  {act.clients?.company_name || 'Unknown client'}
                </button>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{act.content}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {new Date(act.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            }}>
              No activity matches your filters
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

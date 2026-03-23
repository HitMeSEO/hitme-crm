'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACTIVITY_TYPES } from '@/lib/constants';
import { Plus } from 'lucide-react';
import { Empty } from './shared';

function NotesTab({ activities, clientId, refreshActivities }) {
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'Note', content: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('activities').insert({
      client_id: clientId,
      activity_type: form.activity_type,
      content: form.content.trim(),
    });
    setSaving(false);
    if (!error) {
      setForm({ activity_type: 'Note', content: '' });
      setShowAddForm(false);
      refreshActivities();
    }
  };

  const getActivityBadge = (type) => ACTIVITY_TYPES.find(a => a.value === type)?.badge || '📌';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}</span>
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

      {showAddForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Type</label>
              <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.badge} {a.label}</option>)}
              </select>
            </div>
            <div>
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

      {activities.length === 0 && !showAddForm ? (
        <Empty msg="No activity yet. Add a note to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map(act => (
            <div key={act.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{
                fontSize: 14, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', flexShrink: 0,
              }}>{getActivityBadge(act.activity_type)} {act.activity_type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{act.content}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {new Date(act.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesTab;

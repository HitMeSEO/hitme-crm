'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACTIVITY_TYPES } from '@/lib/constants';
import { Plus, Pencil, Trash2, Check, X, Sparkles } from 'lucide-react';
import { Empty } from './shared';

function NotesTab({ activities, clientId, refreshActivities, clientName }) {
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'Note', content: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ activity_type: '', content: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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

  const startEdit = (act) => {
    setEditingId(act.id);
    setEditForm({ activity_type: act.activity_type, content: act.content });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ activity_type: '', content: '' });
  };

  const saveEdit = async (id) => {
    if (!editForm.content.trim()) return;
    setEditSaving(true);
    const { error } = await supabase.from('activities').update({
      activity_type: editForm.activity_type,
      content: editForm.content.trim(),
    }).eq('id', id);
    setEditSaving(false);
    if (!error) {
      setEditingId(null);
      refreshActivities();
    }
  };

  const deleteActivity = async (id) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    setDeletingId(id);
    await supabase.from('activities').delete().eq('id', id);
    setDeletingId(null);
    refreshActivities();
  };

  const generateSummary = async () => {
    if (activities.length === 0) return;
    setAiLoading(true);
    setAiSummary('');
    try {
      const res = await fetch('/api/activities/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary failed');
      setAiSummary(data.summary);
    } catch (e) {
      setAiSummary('Error generating summary: ' + e.message);
    }
    setAiLoading(false);
  };

  const getActivityBadge = (type) => ACTIVITY_TYPES.find(a => a.value === type)?.badge || '📌';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {activities.length > 0 && (
            <button
              onClick={generateSummary}
              disabled={aiLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                fontSize: 12, fontWeight: 600, background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.3)', cursor: aiLoading ? 'not-allowed' : 'pointer',
                opacity: aiLoading ? 0.7 : 1,
              }}
            >
              <Sparkles size={14} /> {aiLoading ? 'Summarizing...' : 'AI Summary'}
            </button>
          )}
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
      </div>

      {/* AI Summary Card */}
      {aiSummary && (
        <div style={{
          background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Sparkles size={14} /> AI Summary
            </div>
            <button onClick={() => setAiSummary('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiSummary}</div>
        </div>
      )}

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
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} placeholder="Note content..." />
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
              }}>{editingId === act.id ? (
                <select value={editForm.activity_type} onChange={e => setEditForm(f => ({ ...f, activity_type: e.target.value }))}
                  style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 12 }}>
                  {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.badge} {a.label}</option>)}
                </select>
              ) : (
                <>{getActivityBadge(act.activity_type)} {act.activity_type}</>
              )}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === act.id ? (
                  <div>
                    <textarea
                      value={editForm.content}
                      onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                      rows={4}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--accent)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
                        resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => saveEdit(act.id)} disabled={editSaving} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6,
                        fontSize: 12, fontWeight: 600, background: '#10b981', color: 'white',
                        border: 'none', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1,
                      }}>
                        <Check size={13} /> {editSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6,
                        fontSize: 12, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)', cursor: 'pointer',
                      }}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{act.content}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      {new Date(act.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </>
                )}
              </div>
              {editingId !== act.id && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(act)} title="Edit" style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4,
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteActivity(act.id)} disabled={deletingId === act.id} title="Delete" style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4,
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    opacity: deletingId === act.id ? 0.5 : 1,
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesTab;

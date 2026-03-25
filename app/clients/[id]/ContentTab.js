'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, X, Send, Upload, Save, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { CONTENT_TYPE_COLORS, CONTENT_TYPES, CONTENT_STATUS_COLORS, CONTENT_STATUSES } from '@/lib/constants';
import { Empty } from './shared';

function ContentTab({ content, client, clientId, refreshContent, setClient, clientSettings }) {
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    title: '', content_type: 'Blog Post', status: 'Not Started', due_date: '', assigned_to: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [editItemForm, setEditItemForm] = useState(null);
  const [editItemSaving, setEditItemSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [gbpGenerating, setGbpGenerating] = useState(false);
  const [gbpCount, setGbpCount] = useState(4);
  const [gbpSchedule, setGbpSchedule] = useState('weekly');
  const [gbpStartDate, setGbpStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [gbpResult, setGbpResult] = useState(null);
  const [gbpError, setGbpError] = useState(null);
  const [showGbpModal, setShowGbpModal] = useState(false);
  const [gbpProgress, setGbpProgress] = useState({ current: 0, total: 0, currentPost: '' });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [clientImages, setClientImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const handleGbpBatch = async () => {
    setGbpGenerating(true);
    setGbpError(null);
    setGbpResult(null);
    setGbpProgress({ current: 0, total: gbpCount, currentPost: 'Starting...' });
    try {
      const res = await fetch('/api/content/generate-gbp-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, count: gbpCount, schedule: gbpSchedule, startDate: gbpStartDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GBP batch generation failed');
      setGbpProgress({ current: data.generated, total: gbpCount, currentPost: 'Complete!' });
      setGbpResult(data);
      setShowGbpModal(false);
      refreshContent();
    } catch (err) {
      setGbpError(err.message);
    } finally {
      setGbpGenerating(false);
    }
  };

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('team_members').select('*').eq('is_active', true).order('first_name');
      setTeamMembers(data || []);
    }
    load();
  }, []);

  const cycleStatus = async (item) => {
    const order = ['Not Started', 'In Progress', 'Review', 'Approved', 'Published'];
    const idx = order.indexOf(item.status);
    const next = idx >= 0 && idx < 4 ? order[idx + 1] : 'Not Started';
    const updates = { status: next };
    if (next === 'Published') updates.published_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('content_queue').update(updates).eq('id', item.id);
    if (!error) refreshContent();
  };

  const openItem = (item) => {
    if (expandedItem?.id === item.id) { setExpandedItem(null); setEditItemForm(null); return; }
    setExpandedItem(item);
    setEditItemForm({
      title: item.title || '',
      content_type: item.content_type || 'Blog Post',
      status: item.status || 'Not Started',
      due_date: item.due_date || '',
      assigned_to: item.assigned_to || '',
      notes: item.notes || '',
      body_html: item.body_html || '',
      image_url: item.image_url || '',
      image_file_id: item.image_file_id || '',
    });
    setImagePickerOpen(false);
  };

  const handleEditItem = async () => {
    if (!editItemForm || !expandedItem) return;
    setEditItemSaving(true);
    const updates = {
      title: editItemForm.title.trim() || expandedItem.title,
      content_type: editItemForm.content_type,
      status: editItemForm.status,
      due_date: editItemForm.due_date || null,
      assigned_to: editItemForm.assigned_to || null,
      notes: editItemForm.notes || null,
      body_html: editItemForm.body_html || null,
      image_url: editItemForm.image_url || null,
      image_file_id: editItemForm.image_file_id || null,
    };
    if (editItemForm.status === 'Published' && expandedItem.status !== 'Published') {
      updates.published_date = new Date().toISOString().split('T')[0];
    }
    await supabase.from('content_queue').update(updates).eq('id', expandedItem.id);

    // Auto-mark image as used for GBP if image was attached
    if (editItemForm.image_file_id && editItemForm.content_type === 'GBP Post') {
      try {
        await fetch(`/api/clients/${clientId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId: editItemForm.image_file_id,
            fileName: '',
            usedOn: 'gbp',
            usedFor: editItemForm.title || 'GBP Post',
            contentId: expandedItem.id,
          }),
        });
      } catch {}
    }
    setEditItemSaving(false);
    setExpandedItem({ ...expandedItem, ...updates });
    refreshContent();
  };

  const fetchClientImages = async () => {
    setLoadingImages(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/images`);
      const data = await res.json();
      setClientImages(data.images || []);
    } catch {
      setClientImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const selectImage = (img) => {
    setEditItemForm(f => ({
      ...f,
      image_url: img.thumbnailUrl || img.downloadUrl || '',
      image_file_id: img.id,
    }));
    setImagePickerOpen(false);
  };

  const clearImage = () => {
    setEditItemForm(f => ({ ...f, image_url: '', image_file_id: '' }));
  };

  const handleDeleteItem = async (item, e) => {
    e?.stopPropagation();
    setDeletingItem(item.id);
    await supabase.from('content_queue').delete().eq('id', item.id);
    setDeletingItem(null);
    if (expandedItem?.id === item.id) { setExpandedItem(null); setEditItemForm(null); }
    refreshContent();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('content_queue').insert({
      client_id: clientId,
      title: form.title.trim(),
      content_type: form.content_type,
      status: form.status,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (!error) {
      setForm({ title: '', content_type: 'Blog Post', status: 'Not Started', due_date: '', assigned_to: '', notes: '' });
      setShowAddForm(false);
      refreshContent();
    }
  };

  const getMemberName = (id) => {
    if (!id) return '—';
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  };

  const saveDate = async (field, date) => {
    const { error } = await supabase.from('clients').update({ [field]: date || null }).eq('id', clientId);
    if (!error) setClient({ ...client, [field]: date || null });
  };

  const daysAgo = (d) => {
    if (!d) return null;
    const diff = Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const dateColor = (days) => {
    if (days == null) return 'var(--text-muted)';
    if (days <= 7) return '#10b981';
    if (days <= 21) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* At a Glance */}
      <div className="grid-3col" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
      }}>
        {[
          { key: 'last_gbp_post_date', label: 'Last GBP Post' },
          { key: 'last_social_post_date', label: 'Last Social Post' },
          { key: 'last_website_post_date', label: 'Last Website Post' },
        ].map(({ key, label }) => {
          const d = client[key];
          const days = daysAgo(d);
          return (
            <div key={key}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
              <input
                type="date"
                value={d || ''}
                onChange={e => saveDate(key, e.target.value || null)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
                }}
              />
              <div style={{ fontSize: 12, marginTop: 6, color: dateColor(days) }}>
                {d ? (days <= 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`) : 'No date set'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{content.length} content item{content.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowGbpModal(true)}
            disabled={gbpGenerating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, background: gbpGenerating ? 'var(--bg-tertiary)' : '#10b981', color: gbpGenerating ? 'var(--text-secondary)' : 'white',
              border: gbpGenerating ? '1px solid var(--border)' : 'none', cursor: gbpGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {gbpGenerating ? `⏳ Generating ${gbpProgress.total} GBP Posts...` : '📍 Generate GBP Posts'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
              border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add Content
          </button>
        </div>
      </div>

      {/* GBP Progress Bar */}
      {gbpGenerating && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Generating GBP Posts...
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              This may take 1-2 minutes
            </span>
          </div>
          <div style={{
            width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, #10b981, #6366f1)',
              animation: 'progress-pulse 2s ease-in-out infinite',
            }} />
          </div>
          <style>{`@keyframes progress-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }`}</style>
        </div>
      )}

      {/* GBP Batch Result */}
      {gbpResult && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
            {gbpResult.generated} GBP Posts Generated
          </div>
          {gbpResult.posts?.map((p, i) => (
            <div key={p.id} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {i + 1}. <strong>{p.service}</strong> — {p.neighborhood}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Rotation: {gbpResult.rotation?.totalCombos} service/neighborhood combos available
          </div>
          <button onClick={() => setGbpResult(null)} style={{
            marginTop: 8, fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline',
          }}>Dismiss</button>
        </div>
      )}
      {gbpError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 16,
          fontSize: 13, color: '#ef4444',
        }}>
          GBP Generation Error: {gbpError}
          <button onClick={() => setGbpError(null)} style={{
            marginLeft: 12, fontSize: 11, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline',
          }}>Dismiss</button>
        </div>
      )}

      {/* GBP Batch Modal */}
      {showGbpModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowGbpModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28,
            width: 440, maxWidth: '90vw',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Generate GBP Posts
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Auto-generates posts rotating through your services and neighborhoods.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Number of posts
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[2, 4, 6, 8].map(n => (
                  <button key={n} onClick={() => setGbpCount(n)} style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: gbpCount === n ? '#10b981' : 'var(--bg-tertiary)',
                    color: gbpCount === n ? 'white' : 'var(--text-secondary)',
                    border: gbpCount === n ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Scheduling
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'none', label: 'No schedule' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'biweekly', label: 'Biweekly' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setGbpSchedule(opt.value)} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: gbpSchedule === opt.value ? '#6366f1' : 'var(--bg-tertiary)',
                    color: gbpSchedule === opt.value ? 'white' : 'var(--text-secondary)',
                    border: gbpSchedule === opt.value ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
            {gbpSchedule !== 'none' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Start date
                </label>
                <input type="date" value={gbpStartDate} onChange={e => setGbpStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Posts will be scheduled {gbpSchedule === 'weekly' ? 'every 7 days' : 'every 14 days'} starting from this date.
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Services: {clientSettings?.business_services?.join(', ') || 'None configured'}<br />
              Each post targets a different service + neighborhood combo.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGbpModal(false)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleGbpBatch} disabled={gbpGenerating} style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: '#10b981', color: 'white', border: 'none',
                cursor: gbpGenerating ? 'not-allowed' : 'pointer', opacity: gbpGenerating ? 0.7 : 1,
              }}>{gbpGenerating ? 'Generating...' : `Generate ${gbpCount} Posts`}</button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} placeholder="Content title" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Content Type</label>
              <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Optional notes" />
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

      {content.length === 0 && !showAddForm ? (
        <Empty msg="No content yet. Add one to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content.map(item => {
            const isPage = item.content_type === 'service_location_page';
            const typeColor = CONTENT_TYPE_COLORS[item.content_type] || '#64748b';
            const isExp = expandedItem?.id === item.id;
            const cInputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
            const cLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 };
            return (
              <div key={item.id} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isExp ? 'var(--accent)' : isPage ? 'rgba(6,182,212,0.25)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Content Row */}
                <div
                  onClick={() => isPage ? null : openItem(item)}
                  style={{
                    padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                    cursor: isPage ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                    {isPage && item.url_slug && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>/{item.url_slug}</div>
                    )}
                    {!isPage && !isExp && item.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.notes}</div>}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                    background: `${typeColor}18`, color: typeColor,
                  }}>{isPage ? 'Service Page' : item.content_type}</span>
                  <button onClick={(e) => { e.stopPropagation(); cycleStatus(item); }} style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                    background: `${CONTENT_STATUS_COLORS[item.status] || '#64748b'}18`, color: CONTENT_STATUS_COLORS[item.status] || '#64748b',
                  }}>{item.status}</button>
                  {isPage && item.word_count && (
                    <span title={`${item.word_count} words`} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                      background: item.word_count >= 1000 ? 'rgba(16,185,129,0.12)' : item.word_count >= 800 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      color: item.word_count >= 1000 ? '#10b981' : item.word_count >= 800 ? '#f59e0b' : '#ef4444',
                    }}>{item.word_count}w</span>
                  )}
                  {isPage && item.uniqueness_score != null && (
                    <span title={`Uniqueness: ${item.uniqueness_score}%`} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                      background: item.uniqueness_score >= 80 ? 'rgba(16,185,129,0.12)' : item.uniqueness_score >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      color: item.uniqueness_score >= 80 ? '#10b981' : item.uniqueness_score >= 60 ? '#f59e0b' : '#ef4444',
                    }}>U:{Math.round(item.uniqueness_score)}</span>
                  )}
                  {isPage && item.client_approval && item.client_approval !== 'not_sent' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.3px',
                      background: item.client_approval === 'approved' ? 'rgba(16,185,129,0.12)' : item.client_approval === 'changes_requested' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: item.client_approval === 'approved' ? '#10b981' : item.client_approval === 'changes_requested' ? '#ef4444' : '#f59e0b',
                    }}>
                      {item.client_approval === 'approved' ? '✓ Approved' : item.client_approval === 'changes_requested' ? '⚠ Changes' : '⏳ Pending'}
                    </span>
                  )}
                  {isPage && item.published_url && (
                    <a href={item.published_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                      background: 'rgba(16,185,129,0.12)', color: '#10b981', textDecoration: 'none',
                    }}>🔗 Live</a>
                  )}
                  {item.scheduled_date && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                      background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                    }}>
                      📅 {new Date(item.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {item.image_url && (
                    <img src={item.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} referrerPolicy="no-referrer" />
                  )}
                  {isPage ? (
                    <button
                      onClick={() => setEditingItem(item)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(6,182,212,0.12)', color: '#06b6d4',
                        border: '1px solid rgba(6,182,212,0.3)', cursor: 'pointer',
                      }}
                    >✍️ Edit</button>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getMemberName(item.assigned_to)}</span>
                    </>
                  )}
                </div>

                {/* Expanded Edit Panel (non-service-page items) */}
                {isExp && !isPage && editItemForm && (
                  <div style={{
                    borderTop: '1px solid var(--border)', padding: 20, background: 'var(--bg-secondary)',
                    display: 'flex', flexDirection: 'column', gap: 16,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={cLabelStyle}>Title</label>
                        <input type="text" value={editItemForm.title} onChange={e => setEditItemForm(f => ({ ...f, title: e.target.value }))} style={cInputStyle} />
                      </div>
                      <div>
                        <label style={cLabelStyle}>Content Type</label>
                        <select value={editItemForm.content_type} onChange={e => setEditItemForm(f => ({ ...f, content_type: e.target.value }))} style={cInputStyle}>
                          {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={cLabelStyle}>Status</label>
                        <select value={editItemForm.status} onChange={e => setEditItemForm(f => ({ ...f, status: e.target.value }))} style={cInputStyle}>
                          {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={cLabelStyle}>Assigned To</label>
                        <select value={editItemForm.assigned_to} onChange={e => setEditItemForm(f => ({ ...f, assigned_to: e.target.value }))} style={cInputStyle}>
                          <option value="">— Unassigned —</option>
                          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={cLabelStyle}>Due Date</label>
                        <input type="date" value={editItemForm.due_date} onChange={e => setEditItemForm(f => ({ ...f, due_date: e.target.value }))} style={cInputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={cLabelStyle}>Notes</label>
                        <textarea value={editItemForm.notes} onChange={e => setEditItemForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes about this content..." style={{ ...cInputStyle, resize: 'vertical' }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={cLabelStyle}>Content Body (HTML)</label>
                        <textarea value={editItemForm.body_html} onChange={e => setEditItemForm(f => ({ ...f, body_html: e.target.value }))} rows={10} placeholder="Write or paste content here..." style={{ ...cInputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                      </div>

                      {/* Image Attachment */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={cLabelStyle}>Attached Image</label>
                        {editItemForm.image_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                            <img src={editItemForm.image_url} alt="Attached" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} referrerPolicy="no-referrer" />
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>Image attached</div>
                            <button type="button" onClick={clearImage} style={{
                              padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                              background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                            }}>Remove</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setImagePickerOpen(!imagePickerOpen); if (!imagePickerOpen && clientImages.length === 0) fetchClientImages(); }} style={{
                            width: '100%', padding: '12px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                            border: '2px dashed var(--border)', cursor: 'pointer',
                          }}>
                            🖼️ {imagePickerOpen ? 'Close Image Picker' : 'Attach Image from Folder'}
                          </button>
                        )}

                        {/* Image Picker Grid */}
                        {imagePickerOpen && (
                          <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', maxHeight: 280, overflowY: 'auto' }}>
                            {loadingImages ? (
                              <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>Loading images…</div>
                            ) : clientImages.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>No images found. Add images to the client's image folder first.</div>
                            ) : (
                              <>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                                  {clientImages.filter(i => !i.usedOn).length} unused of {clientImages.length} total — click to attach
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                                  {clientImages.map(img => (
                                    <div
                                      key={img.id}
                                      onClick={() => selectImage(img)}
                                      style={{
                                        cursor: 'pointer', borderRadius: 6, overflow: 'hidden', position: 'relative',
                                        border: img.usedOn ? '2px solid rgba(239,68,68,0.4)' : '2px solid transparent',
                                        opacity: img.usedOn ? 0.5 : 1,
                                      }}
                                    >
                                      {img.thumbnailUrl ? (
                                        <img src={img.thumbnailUrl} alt={img.name} style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} referrerPolicy="no-referrer" />
                                      ) : (
                                        <div style={{ width: '100%', height: 70, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼️</div>
                                      )}
                                      {img.usedOn && (
                                        <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.9)', color: 'white' }}>USED</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                      <button onClick={(e) => handleDeleteItem(item, e)} disabled={deletingItem === item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                      }}>
                        <X size={13} />{deletingItem === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button onClick={handleEditItem} disabled={editItemSaving} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'var(--accent)', color: 'white', border: 'none', cursor: editItemSaving ? 'not-allowed' : 'pointer', opacity: editItemSaving ? 0.7 : 1,
                      }}>
                        <Save size={13} />{editItemSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingItem && (
        <ServicePageEditor
          item={editingItem}
          clientSettings={clientSettings}
          clientId={clientId}
          client={client}
          onClose={() => setEditingItem(null)}
          onSaved={(updated) => {
            setEditingItem(null);
            refreshContent();
          }}
        />
      )}
    </div>
  );
}

function ServicePageEditor({ item, onClose, onSaved, clientSettings, clientId, client }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title_tag: item.title_tag || '',
    meta_description: item.meta_description || '',
    url_slug: item.url_slug || '',
    frase_score: item.frase_score || '',
    body_html: item.body_html || '',
    status: item.status || 'Not Started',
    client_approval: item.client_approval || 'not_sent',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  const hasWpCredentials = clientSettings?.wordpress_url && clientSettings?.wordpress_api_key;
  const isApproved = form.client_approval === 'approved';
  const isPublished = form.status === 'Published';

  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [pushingSchema, setPushingSchema] = useState(false);
  const [schemaMsg, setSchemaMsg] = useState('');
  const [schemaPreview, setSchemaPreview] = useState(null);
  const [schemaPreviewLoading, setSchemaPreviewLoading] = useState(false);

  const handleSendForApproval = async () => {
    setSaving(true);
    setSaveError('');
    setEmailMsg('');

    // Update status first
    const { error } = await supabase.from('content_queue').update({
      client_approval: 'pending',
      status: 'Review',
    }).eq('id', item.id);

    if (error) { setSaving(false); setSaveError(error.message); return; }
    setForm(f => ({ ...f, client_approval: 'pending', status: 'Review' }));

    // Try to send email via Resend
    setSendingEmail(true);
    try {
      const emailRes = await fetch('/api/email/send-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: item.id }),
      });
      const emailData = await emailRes.json();
      if (emailRes.ok) {
        setEmailMsg(`Approval email sent to ${emailData.sentTo}`);
      } else {
        setEmailMsg(`Status updated but email failed: ${emailData.error}`);
      }
    } catch (emailErr) {
      setEmailMsg(`Status updated but email failed: ${emailErr.message}`);
    } finally {
      setSendingEmail(false);
      setSaving(false);
    }
  };

  const handleApprovalChange = async (newStatus) => {
    setSaving(true);
    setSaveError('');
    const updates = { client_approval: newStatus };
    if (newStatus === 'approved') updates.status = 'Approved';
    const { error } = await supabase.from('content_queue').update(updates).eq('id', item.id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setForm(f => ({ ...f, ...updates }));
  };

  const handlePublishToWP = async () => {
    if (!hasWpCredentials) { setSaveError('WordPress credentials not set. Go to Edit Client to add them.'); return; }
    setPublishing(true);
    setPublishMsg('');
    setSaveError('');
    try {
      const res = await fetch('/api/content/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: item.id, client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish');
      setForm(f => ({ ...f, status: 'Published' }));
      setPublishMsg(`Published: ${data.url}`);
    } catch (e) {
      setSaveError(e.message);
    }
    setPublishing(false);
  };

  // Step 1: Preview schema (dry run — nothing touches WordPress)
  const handlePreviewSchema = async () => {
    setSchemaPreviewLoading(true);
    setSchemaPreview(null);
    setSchemaMsg('');
    setSaveError('');
    try {
      const res = await fetch('/api/content/preview-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: item.id, client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setSchemaPreview(data.pages?.[0] || null);
    } catch (e) {
      setSaveError(e.message);
    }
    setSchemaPreviewLoading(false);
  };

  // Step 2: Actually push schema to WordPress (only after preview + confirmation)
  const handleConfirmPushSchema = async () => {
    setPushingSchema(true);
    setSchemaMsg('');
    setSaveError('');
    try {
      // Generate schema first
      const genRes = await fetch('/api/content/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: item.id, client_id: clientId }),
      });
      if (!genRes.ok) {
        const genData = await genRes.json();
        throw new Error(genData.error || 'Schema generation failed');
      }

      // Push to WordPress
      const pushRes = await fetch('/api/content/push-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: item.id, client_id: clientId }),
      });
      const pushData = await pushRes.json();
      if (!pushRes.ok) throw new Error(pushData.error || 'Push schema failed');

      if (pushData.updated > 0) {
        setSchemaMsg(`Schema injected — LocalBusiness${schemaPreview?.faq_count > 0 ? ' + FAQ (' + schemaPreview.faq_count + ' Q&As)' : ''}`);
      } else {
        setSchemaMsg(pushData.message || 'No pages updated.');
      }
      setSchemaPreview(null);
    } catch (e) {
      setSaveError(e.message);
    }
    setPushingSchema(false);
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5,
  };

  const titleLen = form.title_tag.length;
  const metaLen = form.meta_description.length;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const { error } = await supabase.from('content_queue').update({
      title_tag: form.title_tag || null,
      meta_description: form.meta_description || null,
      url_slug: form.url_slug || null,
      frase_score: form.frase_score ? parseInt(form.frase_score, 10) : null,
      body_html: form.body_html || null,
      status: form.status,
      client_approval: form.client_approval || 'not_sent',
      title: item.title,
    }).eq('id', item.id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    onSaved({ ...item, ...form });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 780 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>✍️ Service Page Editor</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title Tag */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label style={labelStyle}>Title Tag</label>
              <span style={{ fontSize: 11, color: titleLen > 60 ? '#ef4444' : titleLen > 50 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                {titleLen}/60
              </span>
            </div>
            <input
              type="text"
              value={form.title_tag}
              onChange={e => setForm(f => ({ ...f, title_tag: e.target.value }))}
              placeholder="Primary Keyword — Brand Name"
              maxLength={80}
              style={{ ...inputStyle, borderColor: titleLen > 60 ? '#ef4444' : 'var(--border)' }}
            />
          </div>

          {/* Meta Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label style={labelStyle}>Meta Description</label>
              <span style={{ fontSize: 11, color: metaLen > 160 ? '#ef4444' : metaLen > 140 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                {metaLen}/160
              </span>
            </div>
            <textarea
              value={form.meta_description}
              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
              placeholder="Concise description with a CTA. No pipes."
              rows={2}
              maxLength={200}
              style={{ ...inputStyle, resize: 'vertical', borderColor: metaLen > 160 ? '#ef4444' : 'var(--border)' }}
            />
          </div>

          {/* URL Slug + Frase Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>URL Slug</label>
              <input
                type="text"
                value={form.url_slug}
                onChange={e => setForm(f => ({ ...f, url_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }))}
                placeholder="service-city-state"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Frase Score</label>
              <input
                type="number"
                value={form.frase_score}
                onChange={e => setForm(f => ({ ...f, frase_score: e.target.value }))}
                placeholder="0–100"
                min={0}
                max={100}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Body HTML */}
          <div>
            <label style={labelStyle}>Body HTML</label>
            <textarea
              value={form.body_html}
              onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
              placeholder="<p>Content goes here...</p>"
              rows={20}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
            />
          </div>

          {/* Approval Status */}
          {form.client_approval !== 'not_sent' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: form.client_approval === 'approved' ? 'rgba(16,185,129,0.08)' : form.client_approval === 'changes_requested' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${form.client_approval === 'approved' ? 'rgba(16,185,129,0.3)' : form.client_approval === 'changes_requested' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 8,
            }}>
              {form.client_approval === 'approved' && <CheckCircle size={16} style={{ color: '#10b981' }} />}
              {form.client_approval === 'pending' && <Clock size={16} style={{ color: '#f59e0b' }} />}
              {form.client_approval === 'changes_requested' && <AlertCircle size={16} style={{ color: '#ef4444' }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                {form.client_approval === 'approved' ? 'Client Approved' : form.client_approval === 'pending' ? 'Awaiting Client Approval' : 'Changes Requested'}
              </span>
              {form.client_approval === 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => handleApprovalChange('approved')} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer',
                  }}>Approve</button>
                  <button type="button" onClick={() => handleApprovalChange('changes_requested')} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                  }}>Request Changes</button>
                </div>
              )}
              {form.client_approval === 'changes_requested' && (
                <button type="button" onClick={() => handleApprovalChange('not_sent')} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
                }}>Reset</button>
              )}
            </div>
          )}

          {saveError && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
              {saveError}
            </div>
          )}

          {publishMsg && (
            <div style={{ fontSize: 12, color: '#10b981', padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 6 }}>
              {publishMsg}
            </div>
          )}

          {schemaMsg && (
            <div style={{ fontSize: 12, color: '#a855f7', padding: '8px 12px', background: 'rgba(168,85,247,0.1)', borderRadius: 6 }}>
              {schemaMsg}
            </div>
          )}

          {/* Schema Preview Panel */}
          {schemaPreview && (
            <div style={{ border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>Schema Preview (Dry Run)</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nothing has been pushed yet</span>
              </div>

              {/* Warnings */}
              {schemaPreview.warnings?.length > 0 && (
                <div style={{ padding: '8px 14px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>Warnings ({schemaPreview.warnings.length})</div>
                  {schemaPreview.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>⚠️ {w}</div>
                  ))}
                </div>
              )}

              {/* FAQ Count */}
              <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong>LocalBusiness:</strong> {schemaPreview.schemas?.localBusiness ? '✅ Generated' : '❌ Missing'}
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <strong>FAQ:</strong> {schemaPreview.faq_count > 0 ? `✅ ${schemaPreview.faq_count} Q&A pairs extracted` : '⚠️ None found'}
                </div>
              </div>

              {/* JSON Preview */}
              <div style={{ maxHeight: 300, overflowY: 'auto', padding: 14 }}>
                {schemaPreview.script_tags?.map((tag, i) => (
                  <pre key={i} style={{
                    fontSize: 10, lineHeight: 1.4, color: 'var(--text-secondary)',
                    background: 'var(--bg-tertiary)', padding: 10, borderRadius: 6,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    marginBottom: i < schemaPreview.script_tags.length - 1 ? 8 : 0,
                    border: '1px solid var(--border)',
                  }}>
                    {tag}
                  </pre>
                ))}
              </div>

              {/* Confirm / Cancel buttons */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--bg-secondary)' }}>
                <button type="button" onClick={() => setSchemaPreview(null)} style={{
                  padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="button" onClick={handleConfirmPushSchema} disabled={pushingSchema} style={{
                  padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: schemaPreview.warnings?.length > 0 ? '#f59e0b' : '#a855f7',
                  color: 'white', border: 'none',
                  cursor: pushingSchema ? 'not-allowed' : 'pointer', opacity: pushingSchema ? 0.7 : 1,
                }}>
                  {pushingSchema ? 'Pushing...' : schemaPreview.warnings?.length > 0 ? 'Push Anyway' : 'Confirm Push to WordPress'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>

            {/* Send for Approval — only when not yet sent */}
            {form.client_approval === 'not_sent' && form.body_html && (
              <button type="button" onClick={handleSendForApproval} disabled={saving || sendingEmail} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)', cursor: (saving || sendingEmail) ? 'not-allowed' : 'pointer',
              }}>
                <Send size={14} />{sendingEmail ? 'Sending Email...' : 'Send for Approval'}
              </button>
            )}
            {emailMsg && (
              <span style={{ fontSize: 11, color: emailMsg.includes('failed') ? '#ef4444' : '#10b981', alignSelf: 'center' }}>
                {emailMsg}
              </span>
            )}

            {/* Push to WordPress — only when approved and WP credentials exist */}
            {isApproved && !isPublished && (
              <button type="button" onClick={handlePublishToWP} disabled={publishing} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: hasWpCredentials ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)',
                color: hasWpCredentials ? '#10b981' : 'var(--text-muted)',
                border: `1px solid ${hasWpCredentials ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.7 : 1,
              }}>
                <Upload size={14} />{publishing ? 'Publishing...' : 'Push to WordPress'}
              </button>
            )}

            {isPublished && item.published_url && (
              <a href={item.published_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'rgba(16,185,129,0.15)', color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)', textDecoration: 'none',
              }}>
                <ExternalLink size={14} />View Live Page
              </a>
            )}

            {/* Push Schema — preview first, then confirm */}
            {isPublished && hasWpCredentials && item.wordpress_post_id && !schemaPreview && (
              <button type="button" onClick={handlePreviewSchema} disabled={schemaPreviewLoading} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'rgba(168,85,247,0.15)', color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.3)',
                cursor: schemaPreviewLoading ? 'not-allowed' : 'pointer', opacity: schemaPreviewLoading ? 0.7 : 1,
              }}>
                {schemaPreviewLoading ? 'Loading Preview...' : 'Preview Schema'}
              </button>
            )}

            <button type="submit" disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: 'var(--accent)', color: 'white', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              <Save size={14} />{saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContentTab;

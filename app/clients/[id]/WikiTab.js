'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WIKI_SECTIONS } from '@/lib/constants';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

const WIKI_LINK_TYPES = ['Google Sheets', 'Google Docs', 'Google Drive', 'Dropbox', 'Looker Studio', 'YouTube', 'Loom Video', 'External Tool', 'Documentation', 'Notion DB'];

function WikiTab({ wikiLinks, clientId, refreshWikiLinks }) {
  const supabase = createClient();
  const [editingId, setEditingId] = useState(null);
  const [addingSection, setAddingSection] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', url: '', link_type: 'Google Sheets' });
  const [addForm, setAddForm] = useState({ label: '', url: '', link_type: 'Google Sheets' });
  const [saving, setSaving] = useState(false);

  const grouped = {};
  (wikiLinks || []).forEach(w => {
    if (!grouped[w.section]) grouped[w.section] = [];
    grouped[w.section].push(w);
  });

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase.from('wiki_links').update({ label: editForm.label, url: editForm.url, link_type: editForm.link_type }).eq('id', editingId);
    setSaving(false);
    if (!error) { setEditingId(null); refreshWikiLinks(); }
  };

  const handleDelete = async (linkId) => {
    if (!confirm('Delete this link?')) return;
    const { error } = await supabase.from('wiki_links').delete().eq('id', linkId);
    if (!error) refreshWikiLinks();
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!addingSection || !addForm.label.trim() || !addForm.url.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('wiki_links').insert({
      client_id: clientId, section: addingSection, label: addForm.label.trim(), url: addForm.url.trim(),
      link_type: addForm.link_type, sort_order: 0,
    });
    setSaving(false);
    if (!error) { setAddingSection(null); setAddForm({ label: '', url: '', link_type: 'Google Sheets' }); refreshWikiLinks(); }
  };

  const sectionsToShow = [...new Set([...Object.keys(WIKI_SECTIONS), ...Object.keys(grouped)])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sectionsToShow.map((section) => {
        const links = grouped[section] || [];
        const config = WIKI_SECTIONS[section] || { label: section, color: '#64748b', icon: '📄' };
        return (
          <div key={section} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: config.color, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {config.icon} {config.label}
              <button onClick={() => setAddingSection(addingSection === section ? null : section)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.map(link => (
                editingId === link.id ? (
                  <form key={link.id} onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                    <input type="text" placeholder="Label" value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} required
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
                    <input type="url" placeholder="URL" value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} required
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
                    <select value={editForm.link_type} onChange={e => setEditForm(f => ({ ...f, link_type: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
                      {WIKI_LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div key={link.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                  }}>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>{link.label}</a>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)' }}>{link.link_type}</span>
                    <a href={link.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
                    <button onClick={() => { setEditingId(link.id); setEditForm({ label: link.label, url: link.url, link_type: link.link_type || 'Google Sheets' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--danger)' }}><Trash2 size={12} /></button>
                  </div>
                )
              ))}
            </div>
            {addingSection === section && (
              <form onSubmit={handleSaveAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <input type="text" placeholder="Label" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} required
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
                <input type="url" placeholder="URL" value={addForm.url} onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))} required
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
                <select value={addForm.link_type} onChange={e => setAddForm(f => ({ ...f, link_type: e.target.value }))}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
                  {WIKI_LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button type="button" onClick={() => setAddingSection(null)} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WikiTab;

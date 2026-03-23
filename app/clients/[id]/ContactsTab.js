'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Empty } from './shared';

function ContactsTab({ contacts, clientId, refreshContacts }) {
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const cInputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
  };
  const cLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) return;
    setSaving(true);
    if (form.is_primary) {
      await supabase.from('contacts').update({ is_primary: false }).eq('client_id', clientId);
    }
    await supabase.from('contacts').insert({
      client_id: clientId, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      title: form.title || null, email: form.email || null, phone: form.phone || null, is_primary: form.is_primary,
    });
    setSaving(false);
    setForm({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
    setShowAddForm(false);
    refreshContacts();
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingId || !editForm.first_name.trim()) return;
    setSaving(true);
    if (editForm.is_primary) {
      await supabase.from('contacts').update({ is_primary: false }).eq('client_id', clientId);
    }
    await supabase.from('contacts').update({
      first_name: editForm.first_name.trim(), last_name: editForm.last_name.trim(),
      title: editForm.title || null, email: editForm.email || null, phone: editForm.phone || null, is_primary: editForm.is_primary,
    }).eq('id', editingId);
    setSaving(false);
    setEditingId(null);
    refreshContacts();
  };

  const handleDelete = async (contactId) => {
    if (!confirm('Delete this contact?')) return;
    setDeleting(contactId);
    await supabase.from('contacts').delete().eq('id', contactId);
    setDeleting(null);
    refreshContacts();
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ first_name: c.first_name || '', last_name: c.last_name || '', title: c.title || '', email: c.email || '', phone: c.phone || '', is_primary: !!c.is_primary });
  };

  const renderForm = (f, setF, onSubmit, onCancel) => (
    <form onSubmit={onSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={cLabelStyle}>First Name *</label>
          <input type="text" value={f.first_name} onChange={e => setF(p => ({ ...p, first_name: e.target.value }))} required placeholder="First name" style={cInputStyle} />
        </div>
        <div>
          <label style={cLabelStyle}>Last Name</label>
          <input type="text" value={f.last_name} onChange={e => setF(p => ({ ...p, last_name: e.target.value }))} placeholder="Last name" style={cInputStyle} />
        </div>
        <div>
          <label style={cLabelStyle}>Title / Role</label>
          <input type="text" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Owner, Manager" style={cInputStyle} />
        </div>
        <div>
          <label style={cLabelStyle}>Email</label>
          <input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" style={cInputStyle} />
        </div>
        <div>
          <label style={cLabelStyle}>Phone</label>
          <input type="tel" value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 555-5555" style={cInputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={f.is_primary} onChange={e => setF(p => ({ ...p, is_primary: e.target.checked }))} />
            Primary Contact
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} style={{
          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}>{saving ? 'Saving...' : 'Save Contact'}</button>
        <button type="button" onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
        <button onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
        }}>
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {showAddForm && renderForm(form, setForm, handleAdd, () => setShowAddForm(false))}

      {contacts.length === 0 && !showAddForm ? (
        <Empty msg="No contacts added yet. Click 'Add Contact' to get started." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {contacts.map(c => (
            editingId === c.id ? (
              <div key={c.id}>{renderForm(editForm, setEditForm, handleEdit, () => setEditingId(null))}</div>
            ) : (
              <div key={c.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                    {c.first_name} {c.last_name}
                  </div>
                  {c.is_primary && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                      background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                    }}>PRIMARY</span>
                  )}
                  <button onClick={() => startEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--danger, #ef4444)' }}><Trash2 size={12} /></button>
                </div>
                {c.title && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.title}</div>}
                {c.email && <div style={{ fontSize: 12, color: 'var(--accent)' }}>{c.email}</div>}
                {c.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.phone}</div>}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default ContactsTab;

'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe, Phone, X } from 'lucide-react';

/* ============================================================
   FOLDER LINKS ROW
   ============================================================ */

const FOLDER_FIELDS = [
  { key: 'drive_folder', label: 'Google Drive', icon: '📂', color: '#6366f1' },
  { key: 'image_folder', label: 'Image Folder', icon: '🖼️', color: '#ec4899' },
  { key: 'content_folder', label: 'Content Folder', icon: '✍️', color: '#10b981' },
  { key: 'dropbox_folder', label: 'Dropbox', icon: '📦', color: '#3b82f6' },
];

function FolderLinksRow({ client, setClient, clientId, looker, supabase }) {
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderUrl, setFolderUrl] = useState('');
  const [showDocs, setShowDocs] = useState(false);
  const docsRef = useRef(null);

  useEffect(() => {
    if (!showDocs) return;
    const handler = (e) => {
      if (docsRef.current && !docsRef.current.contains(e.target)) {
        setShowDocs(false);
        setEditingFolder(null);
        setFolderUrl('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDocs]);

  const handleSaveFolder = async (e) => {
    e?.preventDefault();
    if (!editingFolder) return;
    const { error } = await supabase.from('clients').update({ [editingFolder]: folderUrl || '' }).eq('id', clientId);
    if (!error) {
      setClient({ ...client, [editingFolder]: folderUrl || '' });
      setEditingFolder(null);
      setFolderUrl('');
    }
  };

  const handleClearFolder = async (field, e) => {
    e?.stopPropagation();
    const { error } = await supabase.from('clients').update({ [field]: '' }).eq('id', clientId);
    if (!error) setClient({ ...client, [field]: '' });
  };

  const setCount = FOLDER_FIELDS.filter(f => client[f.key]).length;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
      {client.website && (
        <a href={client.website} target="_blank" rel="noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', minHeight: 40,
          background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)',
        }}>
          <Globe size={15} /> Website
        </a>
      )}
      {looker && (
        <a href={looker.url} target="_blank" rel="noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', minHeight: 40,
          background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)',
        }}>
          📊 Looker
        </a>
      )}

      {/* Documents dropdown */}
      <div ref={docsRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDocs(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
            borderRadius: 8, fontSize: 14, fontWeight: 600, minHeight: 40,
            background: showDocs ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
            color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
          }}
        >
          📁 Documents
          {setCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, background: 'var(--accent-muted)', color: 'var(--accent)',
              borderRadius: 10, padding: '1px 7px',
            }}>{setCount}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>{showDocs ? '▲' : '▼'}</span>
        </button>

        {showDocs && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 12px', minWidth: 280,
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          }}>
            {FOLDER_FIELDS.map(f => {
              const url = client[f.key];
              const isEditing = editingFolder === f.key;
              return (
                <div key={f.key} style={{ marginBottom: 6 }}>
                  {isEditing ? (
                    <form onSubmit={handleSaveFolder} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: f.color, flexShrink: 0, width: 110, fontWeight: 600 }}>
                        {f.icon} {f.label}
                      </span>
                      <input
                        type="url"
                        value={folderUrl}
                        onChange={e => setFolderUrl(e.target.value)}
                        placeholder="Paste URL..."
                        autoFocus
                        style={{
                          flex: 1, padding: '6px 9px', borderRadius: 7, fontSize: 12,
                          border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)', outline: 'none', minWidth: 0,
                        }}
                      />
                      <button type="submit" style={{
                        padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0,
                      }}>Save</button>
                      <button type="button" onClick={() => { setEditingFolder(null); setFolderUrl(''); }} style={{
                        padding: '6px 8px', borderRadius: 7, fontSize: 12, background: 'none',
                        color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
                      }}>×</button>
                    </form>
                  ) : url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a href={url} target="_blank" rel="noreferrer" style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                        borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                        background: `${f.color}12`, color: f.color,
                      }}>
                        {f.icon} {f.label}
                        <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                      </a>
                      <button onClick={(e) => handleClearFolder(f.key, e)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                        color: 'var(--text-muted)', flexShrink: 0,
                      }} title="Remove link">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingFolder(f.key); setFolderUrl(''); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                        padding: '7px 10px', borderRadius: 8, fontSize: 13, textAlign: 'left',
                        background: 'transparent', color: 'var(--text-muted)',
                        border: '1px dashed var(--border)', cursor: 'pointer',
                      }}
                    >
                      {f.icon} {f.label}
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>+ Add</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {client.phone && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', minHeight: 40,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        }}>
          <Phone size={15} /> {client.phone}
        </span>
      )}
    </div>
  );
}

export default FolderLinksRow;

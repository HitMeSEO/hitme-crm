'use client';

import { useEffect, useState } from 'react';

const USAGE_LABELS = {
  website: { label: 'Website', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  gbp: { label: 'GBP Post', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  social: { label: 'Social', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  blog: { label: 'Blog', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  other: { label: 'Other', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

export default function ImagesTab({ clientId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [unused, setUnused] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unused, website, gbp, social, blog
  const [markingId, setMarkingId] = useState(null);
  const [markForm, setMarkForm] = useState({ usedOn: 'website', usedFor: '' });
  const [saving, setSaving] = useState(false);

  const fetchImages = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${clientId}/images`);
      const data = await res.json();
      if (data.error && !data.images?.length) {
        setError(data.error);
        setImages([]);
      } else {
        setImages(data.images || []);
        setTotal(data.total || 0);
        setUnused(data.unused || 0);
        if (data.error) setError(data.error);
      }
    } catch (err) {
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchImages(); }, [clientId]);

  const handleMark = async (img) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: img.id,
          fileName: img.name,
          usedOn: markForm.usedOn,
          usedFor: markForm.usedFor,
        }),
      });
      if (res.ok) {
        setMarkingId(null);
        setMarkForm({ usedOn: 'website', usedFor: '' });
        fetchImages();
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleClearUsage = async (img) => {
    try {
      await fetch(`/api/clients/${clientId}/images?driveFileId=${img.id}`, { method: 'DELETE' });
      fetchImages();
    } catch {}
  };

  const filtered = images.filter(img => {
    if (filter === 'all') return true;
    if (filter === 'unused') return !img.usedOn;
    return img.usedOn === filter;
  });

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 };

  if (loading) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
        Loading images…
      </div>
    );
  }

  if (error && !images.length) {
    const needsDropboxConnect = error.toLowerCase().includes('dropbox not connected');
    const needsGoogleConnect = error.toLowerCase().includes('google not connected');
    return (
      <div style={{ ...card, textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🖼️</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6, marginBottom: 16 }}>{error}</div>
        {needsDropboxConnect && (
          <a href="/api/dropbox/connect" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#0061fe', color: 'white', textDecoration: 'none', cursor: 'pointer' }}>
            Connect Dropbox
          </a>
        )}
        {needsGoogleConnect && (
          <a href="/api/google/connect" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#4285f4', color: 'white', textDecoration: 'none', cursor: 'pointer' }}>
            Connect Google
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Stats Bar */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Images</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{unused}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Unused</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{total - unused}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Used</div>
          </div>
        </div>
        <button onClick={fetchImages} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All (${images.length})` },
          { key: 'unused', label: `Unused (${unused})` },
          { key: 'website', label: `Website (${images.filter(i => i.usedOn === 'website').length})` },
          { key: 'gbp', label: `GBP (${images.filter(i => i.usedOn === 'gbp').length})` },
          { key: 'social', label: `Social (${images.filter(i => i.usedOn === 'social').length})` },
          { key: 'blog', label: `Blog (${images.filter(i => i.usedOn === 'blog').length})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: filter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: filter === f.key ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: filter === f.key ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Image Grid */}
      {filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
          {filter === 'unused' ? 'All images have been used!' : 'No images match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {filtered.map(img => {
            const usage = img.usedOn ? USAGE_LABELS[img.usedOn] || USAGE_LABELS.other : null;
            const isMarking = markingId === img.id;

            return (
              <div key={img.id} style={{
                ...card,
                marginBottom: 0, padding: 0, overflow: 'hidden',
                opacity: img.usedOn ? 0.7 : 1,
                position: 'relative',
              }}>
                {/* Thumbnail */}
                <div style={{ width: '100%', height: 150, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {img.thumbnailUrl ? (
                    <img
                      src={img.thumbnailUrl}
                      alt={img.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>🖼️</span>
                  )}
                </div>

                {/* Usage Badge */}
                {usage && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    padding: '2px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 700,
                    background: usage.bg, color: usage.color,
                    border: `1px solid ${usage.color}30`,
                  }}>
                    {usage.label}
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {img.name}
                  </div>
                  {img.usedFor && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontStyle: 'italic' }}>{img.usedFor}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {img.width && img.height ? `${img.width}×${img.height}` : ''}
                    {img.size ? ` · ${(img.size / 1024).toFixed(0)}KB` : ''}
                  </div>

                  {/* Mark as Used / Clear */}
                  {isMarking ? (
                    <div style={{ marginTop: 8 }}>
                      <select
                        value={markForm.usedOn}
                        onChange={e => setMarkForm(f => ({ ...f, usedOn: e.target.value }))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 11, marginBottom: 4, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      >
                        <option value="website">Website</option>
                        <option value="gbp">GBP Post</option>
                        <option value="social">Social</option>
                        <option value="blog">Blog</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Used for… (optional)"
                        value={markForm.usedFor}
                        onChange={e => setMarkForm(f => ({ ...f, usedFor: e.target.value }))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 11, marginBottom: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleMark(img)} disabled={saving} style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setMarkingId(null)} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {!img.usedOn ? (
                        <button
                          onClick={() => { setMarkingId(img.id); setMarkForm({ usedOn: 'website', usedFor: '' }); }}
                          style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}
                        >
                          Mark as Used
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClearUsage(img)}
                          style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}
                        >
                          Clear Usage
                        </button>
                      )}
                      {img.viewUrl && (
                        <a href={img.viewUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                          Open
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

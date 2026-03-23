'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, X, ExternalLink } from 'lucide-react';

function LocationsTab({ locations, setLocations, clientId, setTab, refreshContent, clientSettings }) {
  const [researchingId, setResearchingId] = useState(null);
  const [researchError, setResearchError] = useState({});
  const [briefLoc, setBriefLoc] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [generateError, setGenerateError] = useState({});
  const [generateModal, setGenerateModal] = useState(null); // { loc }
  const [showAddArea, setShowAddArea] = useState(false);

  const completedCount = locations.filter(l => l.research_status === 'complete').length;
  const contentCount = locations.filter(l => ['draft', 'approved', 'published'].includes(l.content_status)).length;

  const RESEARCH_STATUS = {
    complete:     { dot: '🟢', label: 'Complete',     color: '#10b981' },
    running:      { dot: '🟡', label: 'Running...',   color: '#f59e0b' },
    error:        { dot: '❌', label: 'Error',         color: '#ef4444' },
    not_started:  { dot: '🔴', label: 'Not started',  color: '#94a3b8' },
  };

  const CONTENT_STATUS = {
    published: { dot: '🟢', label: 'Published' },
    draft:     { dot: '🟡', label: 'Draft' },
    no_page:   { dot: '🔴', label: 'No page' },
  };

  const handleGenerate = async (loc, { page_type = 'service_location_page', target_service = '', link_url = '', editedBrief = null } = {}) => {
    setGeneratingId(loc.id);
    setGenerateError(prev => ({ ...prev, [loc.id]: null }));
    setGenerateModal(null);
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, locationId: loc.id, page_type, target_service, link_url, editedBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (page_type === 'service_location_page') {
        setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, content_status: 'draft' } : l));
      }
      if (refreshContent) await refreshContent();
    } catch (err) {
      setGenerateError(prev => ({ ...prev, [loc.id]: err.message }));
    } finally {
      setGeneratingId(null);
    }
  };

  const handleResearch = async (loc) => {
    setResearchingId(loc.id);
    setResearchError(prev => ({ ...prev, [loc.id]: null }));

    // Optimistically mark running in local state
    setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, research_status: 'running' } : l));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 295000); // 295s client timeout (matches 300s server limit)
      let res;
      try {
        res = await fetch('/api/content/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, locationId: loc.id }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Research timed out (>5 min). Try again — it usually works on retry.');
        }
        throw new Error('Network error — check your connection and try again.');
      }
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Research failed');
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, research_status: 'complete', keyword_brief: data.brief } : l));
    } catch (err) {
      setResearchError(prev => ({ ...prev, [loc.id]: err.message }));
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, research_status: 'error' } : l));
    } finally {
      setResearchingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header row: coverage stats + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {locations.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                🔍 Research: <span style={{ fontWeight: 700, color: completedCount === locations.length ? '#10b981' : 'var(--text-secondary)' }}>
                  {completedCount} of {locations.length}
                </span> completed
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                ✍️ Content: <span style={{ fontWeight: 700, color: contentCount === locations.length ? '#6366f1' : contentCount > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
                  {contentCount} of {locations.length}
                </span> have pages
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShowAddArea(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, minHeight: 40,
            background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} /> Add Service Area
        </button>
      </div>

      {locations.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          No locations yet — add a service area above to get started.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {locations.map(loc => {
          const isOverdue = loc.post_status && loc.post_status.toLowerCase().includes('overdue');
          const neverPosted = loc.post_status && loc.post_status.toLowerCase().includes('never');
          const isRunning = researchingId === loc.id;
          const status = RESEARCH_STATUS[loc.research_status] || RESEARCH_STATUS.not_started;

          return (
            <div key={loc.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{loc.location_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    title={loc.research_status === 'complete' ? 'View keyword brief' : `Research: ${status.label}`}
                    onClick={loc.research_status === 'complete' && loc.keyword_brief ? () => setBriefLoc(loc) : undefined}
                    style={{ fontSize: 13, cursor: loc.research_status === 'complete' && loc.keyword_brief ? 'pointer' : 'default' }}
                  >{status.dot}</span>
                  {(() => {
                    const cs = CONTENT_STATUS[loc.content_status] || CONTENT_STATUS.no_page;
                    return (
                      <span title={`Content: ${cs.label}`} style={{ fontSize: 13 }}>{cs.dot}</span>
                    );
                  })()}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: loc.gbp_status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: loc.gbp_status === 'ACTIVE' ? '#10b981' : '#f59e0b',
                  }}>
                    {loc.gbp_status}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {[loc.address_street, loc.address_city, loc.address_state, loc.address_zip].filter(Boolean).join(', ')}
              </div>
              {loc.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📞 {loc.phone}</div>}
              {loc.categories && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  {loc.categories}
                </div>
              )}

              {/* Last post status */}
              <div style={{ marginTop: 10 }}>
                <div style={{
                  display: 'inline-block', padding: '5px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: isOverdue ? 'rgba(239,68,68,0.1)' : neverPosted ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                  color: isOverdue ? '#ef4444' : neverPosted ? '#f59e0b' : '#10b981',
                }}>
                  Last post: {loc.post_status || 'Unknown'}
                </div>
              </div>

              {/* Research row */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {loc.research_status === 'complete' && !isRunning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {loc.keyword_brief && (
                      <button
                        onClick={() => setBriefLoc(loc)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 40,
                          background: 'rgba(16,185,129,0.1)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >View Brief</button>
                    )}
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 40,
                      background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>
                      ✓ {loc.researched_at ? new Date(loc.researched_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : 'Done'}
                    </span>
                    <button
                      onClick={() => handleResearch(loc)}
                      disabled={researchingId !== null}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 40,
                        background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        cursor: researchingId !== null ? 'not-allowed' : 'pointer',
                        opacity: researchingId !== null ? 0.4 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >↺ Re-research</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleResearch(loc)}
                    disabled={isRunning || researchingId !== null}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, minHeight: 44,
                      background: isRunning ? 'rgba(99,102,241,0.15)' : 'var(--accent-muted)',
                      color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)',
                      cursor: (isRunning || researchingId !== null) ? 'not-allowed' : 'pointer',
                      opacity: (!isRunning && researchingId !== null) ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isRunning ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Researching...
                      </>
                    ) : <><span style={{ fontSize: 18 }}>🔍</span> Research</>}
                  </button>
                )}
              </div>

              {researchError[loc.id] && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#ef4444', lineHeight: 1.4 }}>
                  {researchError[loc.id]}
                </div>
              )}

              {/* Content row — only shown when research is complete */}
              {loc.research_status === 'complete' && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {loc.content_status === 'draft' || loc.content_status === 'published' ? (
                    <>
                      <button
                        onClick={() => setTab('content')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 40,
                          background: 'rgba(6,182,212,0.12)', color: '#06b6d4',
                          border: '1px solid rgba(6,182,212,0.3)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {loc.content_status === 'published' ? '🟢 View Page' : <><span style={{ fontSize: 18 }}>✍️</span> View Draft</>}
                      </button>
                      {loc.content_status !== 'published' && (
                        <button
                          onClick={() => setGenerateModal({ loc })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 40,
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                            border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >↺ Regenerate</button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setGenerateModal({ loc })}
                      disabled={generatingId !== null}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, minHeight: 44,
                        background: 'rgba(6,182,212,0.12)', color: '#06b6d4',
                        border: '1px solid rgba(6,182,212,0.3)',
                        cursor: generatingId !== null ? 'not-allowed' : 'pointer',
                        opacity: generatingId !== null ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {generatingId === loc.id ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Generating...
                        </>
                      ) : <><span style={{ fontSize: 18 }}>✍️</span> Generate Content</>}
                    </button>
                  )}
                  {generateError[loc.id] && (
                    <div style={{ width: '100%', marginTop: 4, fontSize: 13, color: '#ef4444', lineHeight: 1.4 }}>
                      {generateError[loc.id]}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {briefLoc && (
        <KeywordBriefModal loc={briefLoc} onClose={() => setBriefLoc(null)} />
      )}

      {generateModal && (
        <GenerateModal
          loc={generateModal.loc}
          clientSettings={clientSettings}
          generatingId={generatingId}
          onGenerate={(opts) => handleGenerate(generateModal.loc, opts)}
          onClose={() => setGenerateModal(null)}
        />
      )}

      {showAddArea && (
        <AddServiceAreaModal
          clientId={clientId}
          onClose={() => setShowAddArea(false)}
          onSaved={(newLoc) => {
            setLocations(prev => [...prev, newLoc]);
            setShowAddArea(false);
          }}
        />
      )}
    </div>
  );
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

function AddServiceAreaModal({ clientId, onClose, onSaved }) {
  const supabase = createClient();
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [county, setCounty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!city.trim() || !state) {
      setError(`City and State are required. (city: "${city}", state: "${state}")`);
      return;
    }
    setSaving(true);
    setError('');
    const locationName = `${city.trim()}, ${state.trim()}`;
    const { data, error: insertErr } = await supabase
      .from('locations')
      .insert({
        client_id: clientId,
        location_name: locationName,
        address_city: city.trim(),
        address_state: state.trim(),
        county: county.trim() || null,
        location_type: 'service_area',
        location_notes: notes.trim() || null,
        research_status: 'not_started',
        content_status: 'no_page',
      })
      .select()
      .single();
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    onSaved(data);
  };

  return (
    <div
      className="crm-modal-wrap"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="crm-modal-inner"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Add Service Area</div>
          <button onClick={() => !saving && onClose()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>City <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Pittsburgh"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select state…</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>County / Counties <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input
              type="text"
              value={county}
              onChange={e => setCounty(e.target.value)}
              placeholder="Allegheny County, Westmoreland County"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Neighborhoods & Areas Served <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="List neighborhoods, communities, zip codes — one per line. These feed into content generation."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 7 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => !saving && onClose()}
              style={{
                padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: 'var(--accent)', color: 'white', border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >{saving ? 'Saving…' : 'Add Location'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateModal({ loc, clientSettings, generatingId, onGenerate, onClose }) {
  const services = clientSettings?.business_services || [];
  const hasBrief = !!loc.keyword_brief;
  const src = loc.keyword_brief || {};

  // ── Brief editing state ──────────────────────────────────────
  const [primaryKeyword, setPrimaryKeyword] = useState(src.primary_keyword || '');
  const [secondaryKws, setSecondaryKws] = useState(src.secondary_keywords || []);
  const [kwInput, setKwInput] = useState('');
  const [h2s, setH2s] = useState(src.recommended_h_tags?.h2s || []);
  const [h2Input, setH2Input] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(src.target_word_count || 1200);
  const [neighborhoods, setNeighborhoods] = useState((src.local_details?.neighborhoods || []).join(', '));
  const [landmarks, setLandmarks] = useState((src.local_details?.landmarks || []).join(', '));
  const [questions, setQuestions] = useState(src.questions_to_answer || []);
  const [qInput, setQInput] = useState('');

  // ── Generate options state ───────────────────────────────────
  const [pageType, setPageType] = useState('service_location_page');
  const [targetService, setTargetService] = useState(services[0] || '');
  const [customService, setCustomService] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const isGenerating = generatingId === loc.id;

  // ── Shared styles ────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5,
  };

  // ── Keyword tag helpers ──────────────────────────────────────
  const addKw = () => {
    const val = kwInput.trim().replace(/,$/, '');
    if (val && !secondaryKws.includes(val)) setSecondaryKws(prev => [...prev, val]);
    setKwInput('');
  };
  const removeKw = (kw) => setSecondaryKws(prev => prev.filter(k => k !== kw));

  // ── H2 list helpers ──────────────────────────────────────────
  const addH2 = () => {
    if (h2Input.trim()) { setH2s(prev => [...prev, h2Input.trim()]); setH2Input(''); }
  };
  const removeH2 = (i) => setH2s(prev => prev.filter((_, idx) => idx !== i));
  const moveH2 = (i, dir) => {
    const next = [...h2s];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setH2s(next);
  };
  const updateH2 = (i, val) => setH2s(prev => prev.map((h, idx) => idx === i ? val : h));

  // ── Question list helpers ────────────────────────────────────
  const addQ = () => {
    if (qInput.trim()) { setQuestions(prev => [...prev, qInput.trim()]); setQInput(''); }
  };
  const removeQ = (i) => setQuestions(prev => prev.filter((_, idx) => idx !== i));
  const moveQ = (i, dir) => {
    const next = [...questions];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setQuestions(next);
  };
  const updateQ = (i, val) => setQuestions(prev => prev.map((q, idx) => idx === i ? val : q));

  const PAGE_TYPES = [
    { value: 'service_location_page', label: 'Service Location Page', desc: 'Full SEO page — H-tags, FAQ, local details' },
    { value: 'blog_post', label: 'Blog Post', desc: 'Informational article targeting the service keyword' },
    { value: 'gbp_post', label: 'GBP Post', desc: '120-160 words, plain text, hard CTA' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    const editedBrief = {
      ...src,
      primary_keyword: primaryKeyword,
      secondary_keywords: secondaryKws,
      recommended_h_tags: { ...(src.recommended_h_tags || {}), h2s },
      target_word_count: Number(targetWordCount) || 1200,
      local_details: {
        ...(src.local_details || {}),
        neighborhoods: neighborhoods.split(',').map(s => s.trim()).filter(Boolean),
        landmarks: landmarks.split(',').map(s => s.trim()).filter(Boolean),
      },
      questions_to_answer: questions,
    };
    onGenerate({
      page_type: pageType,
      target_service: services.length > 0 ? targetService : customService,
      link_url: linkUrl,
      editedBrief,
    });
  };

  const SectionHeader = ({ children }) => (
    <div style={{
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px',
      color: 'var(--text-muted)', marginBottom: 12,
    }}>{children}</div>
  );

  const arrowBtn = (onClick, label) => (
    <button type="button" onClick={onClick} title={label} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
      padding: '2px 3px', fontSize: 11, lineHeight: 1, flexShrink: 0,
    }}>{label === 'Up' ? '▲' : '▼'}</button>
  );

  return (
    <div
      className="crm-modal-wrap"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '16px' }}
      onClick={() => !isGenerating && onClose()}
    >
      <div
        className="crm-modal-inner"
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
          width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 32px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Generate Content</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{loc.location_name}</div>
            </div>
            <button onClick={() => !isGenerating && onClose()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '18px 22px' }}>

          {/* ── GENERATE OPTIONS SECTION (moved first per Pam's request) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            <SectionHeader>Generate Options</SectionHeader>

            {/* Page Type */}
            <div>
              <label style={labelStyle}>Page Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {PAGE_TYPES.map(pt => (
                  <label key={pt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px',
                    borderRadius: 8, cursor: 'pointer',
                    background: pageType === pt.value ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                    border: `1px solid ${pageType === pt.value ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  }}>
                    <input
                      type="radio"
                      name="page_type"
                      value={pt.value}
                      checked={pageType === pt.value}
                      onChange={() => setPageType(pt.value)}
                      style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: pageType === pt.value ? 'var(--accent)' : 'var(--text-primary)' }}>{pt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{pt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Target Service */}
            <div>
              <label style={labelStyle}>Target Service</label>
              {services.length > 0 ? (
                <select value={targetService} onChange={e => setTargetService(e.target.value)} style={inputStyle}>
                  {services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={customService}
                  onChange={e => setCustomService(e.target.value)}
                  placeholder="e.g. Junk Removal, Demolition..."
                  style={inputStyle}
                />
              )}
            </div>

            {/* GBP Post: Link URL */}
            {pageType === 'gbp_post' && (
              <div>
                <label style={labelStyle}>Link To</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/junk-removal-pittsburgh"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* ── KEYWORD BRIEF SECTION ── */}
          <div style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 18,
          }}>
            <SectionHeader>Keyword Brief</SectionHeader>

            {!hasBrief ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                Run Research first to generate a keyword brief
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Primary Keyword */}
                <div>
                  <label style={labelStyle}>Primary Keyword</label>
                  <input
                    type="text"
                    value={primaryKeyword}
                    onChange={e => setPrimaryKeyword(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Secondary Keywords — tag pills */}
                <div>
                  <label style={labelStyle}>Secondary Keywords</label>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 5, padding: '7px 10px',
                    border: '1px solid var(--border)', borderRadius: 7,
                    background: 'var(--bg-secondary)', minHeight: 36,
                  }}>
                    {secondaryKws.map(kw => (
                      <span key={kw} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        background: 'var(--accent-muted)', color: 'var(--accent)',
                        border: '1px solid rgba(99,102,241,0.25)',
                      }}>
                        {kw}
                        <button type="button" onClick={() => removeKw(kw)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent)', padding: 0, fontSize: 12, lineHeight: 1,
                          opacity: 0.6, display: 'flex', alignItems: 'center',
                        }}>×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={kwInput}
                      onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } if (e.key === ',') { e.preventDefault(); addKw(); } }}
                      placeholder={secondaryKws.length === 0 ? 'Type and press Enter to add...' : '+'}
                      style={{
                        border: 'none', background: 'none', outline: 'none', fontSize: 12,
                        color: 'var(--text-primary)', minWidth: 80, flex: 1,
                        padding: '1px 2px',
                      }}
                    />
                  </div>
                </div>

                {/* H2 Recommendations */}
                <div>
                  <label style={labelStyle}>Recommended H2s</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {h2s.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {arrowBtn(() => moveH2(i, -1), 'Up')}
                          {arrowBtn(() => moveH2(i, 1), 'Down')}
                        </div>
                        <input
                          type="text"
                          value={h}
                          onChange={e => updateH2(i, e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button type="button" onClick={() => removeH2(i)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px 6px', fontSize: 14, flexShrink: 0,
                        }}>×</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      <input
                        type="text"
                        value={h2Input}
                        onChange={e => setH2Input(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addH2(); } }}
                        placeholder="Add H2..."
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button type="button" onClick={addH2} style={{
                        padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-card)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>+ Add</button>
                    </div>
                  </div>
                </div>

                {/* Target Word Count */}
                <div>
                  <label style={labelStyle}>Target Word Count</label>
                  <input
                    type="number"
                    min={300}
                    max={3000}
                    step={100}
                    value={targetWordCount}
                    onChange={e => setTargetWordCount(e.target.value)}
                    style={{ ...inputStyle, width: 100 }}
                  />
                </div>

                {/* Local Details */}
                <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Neighborhoods</label>
                    <input
                      type="text"
                      value={neighborhoods}
                      onChange={e => setNeighborhoods(e.target.value)}
                      placeholder="Comma-separated..."
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Landmarks</label>
                    <input
                      type="text"
                      value={landmarks}
                      onChange={e => setLandmarks(e.target.value)}
                      placeholder="Comma-separated..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* FAQ Questions */}
                <div>
                  <label style={labelStyle}>FAQ Questions</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {questions.map((q, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {arrowBtn(() => moveQ(i, -1), 'Up')}
                          {arrowBtn(() => moveQ(i, 1), 'Down')}
                        </div>
                        <input
                          type="text"
                          value={q}
                          onChange={e => updateQ(i, e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button type="button" onClick={() => removeQ(i)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px 6px', fontSize: 14, flexShrink: 0,
                        }}>×</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      <input
                        type="text"
                        value={qInput}
                        onChange={e => setQInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQ(); } }}
                        placeholder="Add question..."
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button type="button" onClick={addQ} style={{
                        padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-card)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>+ Add</button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── GENERATE BUTTON ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              type="submit"
              disabled={isGenerating || !hasBrief}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--accent)', color: 'white', border: 'none',
                cursor: (isGenerating || !hasBrief) ? 'not-allowed' : 'pointer',
                opacity: (isGenerating || !hasBrief) ? 0.5 : 1,
                marginTop: 4,
              }}
            >
              {isGenerating ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Generating...
                </>
              ) : '✍️ Generate'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

function KeywordBriefModal({ loc, onClose }) {
  const b = loc.keyword_brief || {};

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
        color: 'var(--text-muted)', marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );

  const Pill = ({ text, color = 'var(--accent)' }) => (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 5, fontSize: 12,
      background: `${color}18`, color, border: `1px solid ${color}33`,
      marginRight: 5, marginBottom: 5,
    }}>{text}</span>
  );

  return (
    <div
      className="crm-modal-wrap"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="crm-modal-inner"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
              Keyword Brief — {loc.location_name}
            </div>
            {loc.researched_at && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Researched {new Date(loc.researched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {b.city && b.state && ` · ${b.city}, ${b.state}`}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Primary Keyword */}
        {b.primary_keyword && (
          <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 10, background: 'var(--accent-muted)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 5 }}>Primary Keyword</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{b.primary_keyword}</div>
            {b.target_word_count && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Target length: {b.target_word_count.toLocaleString()} words</div>
            )}
          </div>
        )}

        {/* Secondary Keywords */}
        {b.secondary_keywords?.length > 0 && (
          <Section title="Secondary Keywords">
            <div>{b.secondary_keywords.map((k, i) => <Pill key={i} text={k} color="#6366f1" />)}</div>
          </Section>
        )}

        {/* Recommended H-Tags */}
        {b.recommended_h_tags && (
          <Section title="Recommended H-Tags">
            {b.recommended_h_tags.h1 && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>H1</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{b.recommended_h_tags.h1}</span>
              </div>
            )}
            {b.recommended_h_tags.h2s?.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>H2</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Questions to Answer */}
        {b.questions_to_answer?.length > 0 && (
          <Section title="Questions to Answer">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {b.questions_to_answer.map((q, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.5 }}>{q}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Local Details */}
        {b.local_details && (
          <Section title="Local Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {b.local_details.county && (
                <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>County</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{b.local_details.county}</div>
                </div>
              )}
              {b.local_details.neighborhoods?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Neighborhoods</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{b.local_details.neighborhoods.join(', ')}</div>
                </div>
              )}
              {b.local_details.landmarks?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Landmarks</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{b.local_details.landmarks.join(', ')}</div>
                </div>
              )}
              {b.local_details.zip_codes?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>ZIP Codes</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{b.local_details.zip_codes.join(', ')}</div>
                </div>
              )}
            </div>
            {b.local_details.local_regulations?.length > 0 && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Local Regulations</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {b.local_details.local_regulations.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* Competitor Analysis */}
        {b.competitor_analysis?.length > 0 && (
          <Section title="Competitor Analysis">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {b.competitor_analysis.map((comp, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{comp.title || `Competitor ${i + 1}`}</span>
                    {comp.estimated_word_count && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>
                        ~{comp.estimated_word_count.toLocaleString()} words
                      </span>
                    )}
                    {comp.url && (
                      <a href={comp.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ExternalLink size={11} /> {new URL(comp.url.startsWith('http') ? comp.url : 'https://' + comp.url).hostname}
                      </a>
                    )}
                  </div>
                  {comp.strengths && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>✓ </span>{comp.strengths}
                    </div>
                  )}
                  {comp.gaps && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#6366f1', fontWeight: 600 }}>→ </span>{comp.gaps}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Content Angle */}
        {b.content_angle && (
          <Section title="Content Angle">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, lineHeight: 1.6, borderLeft: '3px solid #6366f1' }}>
              {b.content_angle}
            </div>
          </Section>
        )}

        {/* Local Pack Competitors */}
        {b.local_pack_competitors?.length > 0 && (
          <Section title="Local Pack (Maps 3-Pack)">
            <div>{b.local_pack_competitors.map((c, i) => <Pill key={i} text={c} color="#10b981" />)}</div>
          </Section>
        )}

        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}


export default LocationsTab;

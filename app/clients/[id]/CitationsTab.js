'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, RefreshCw, Play, Loader2, Check, AlertTriangle, X, Filter } from 'lucide-react';

const STATUS_CFG = {
  found_correct: { label: 'Correct', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  found_inconsistent: { label: 'Inconsistent', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.2)' },
  not_found: { label: 'Missing', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
};

const SCORE_COLOR = (s) => s >= 75 ? '#16a34a' : s >= 55 ? '#ca8a04' : s >= 35 ? '#ea580c' : '#dc2626';

function NapDot({ match, label }) {
  if (match === null || match === undefined) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: match ? '#16a34a' : '#dc2626' }}>
      {match ? <Check size={12} /> : <X size={12} />}
      {label}
    </span>
  );
}

function CitationRow({ citation }) {
  const [open, setOpen] = useState(citation.status === 'found_inconsistent');
  const cfg = STATUS_CFG[citation.status] || STATUS_CFG.not_found;

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${cfg.border}`, background: cfg.bg, transition: 'all 0.2s' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: cfg.color, flexShrink: 0 }}>
          {citation.status === 'found_correct' ? <Check size={14} /> : citation.status === 'found_inconsistent' ? <AlertTriangle size={14} /> : <X size={14} />}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {citation.directory_label}
          <span style={{ fontSize: 11, marginLeft: 6, background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {citation.category}
          </span>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
          color: cfg.color, border: `1px solid ${cfg.border}`,
        }}>
          {cfg.label}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 10px', borderTop: `1px solid ${cfg.border}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {citation.status !== 'not_found' && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <NapDot match={citation.name_match} label="Name" />
                <NapDot match={citation.address_match} label="Address" />
                <NapDot match={citation.phone_match} label="Phone" />
                <NapDot match={citation.url_match} label="URL" />
              </div>
            )}
            {citation.found_name && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                <strong>Found:</strong> {citation.found_name}
                {citation.found_address && ` · ${citation.found_address}`}
                {citation.found_phone && ` · ${citation.found_phone}`}
              </p>
            )}
            {citation.notes && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{citation.notes}</p>
            )}
            {citation.listing_url && (
              <a href={citation.listing_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                View listing →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CitationsTab({ clientId }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [filter, setFilter] = useState('all');

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/citations?clientId=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setAudit(data);
      }
    } catch { /* ignore */ }
  }, [clientId]);

  useEffect(() => { fetchAudit().finally(() => setLoading(false)); }, [fetchAudit]);

  const runAudit = async () => {
    setRunning(true);
    setCurrentStep(0);
    try {
      const initRes = await fetch('/api/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, step: 0 }),
      });
      if (!initRes.ok) throw new Error('Failed to initialize');
      const { auditId, totalSteps: steps } = await initRes.json();
      setTotalSteps(steps);

      for (let s = 1; s <= steps; s++) {
        setCurrentStep(s);
        const res = await fetch('/api/citations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, step: s, auditId }),
        });
        if (!res.ok) throw new Error(`Step ${s} failed`);
      }
    } catch (err) {
      console.error('Citation audit failed:', err);
    } finally {
      setRunning(false);
      setCurrentStep(0);
      await fetchAudit();
    }
  };

  const hasAudit = audit?.status === 'complete' && audit?.citations?.length > 0;
  const citations = audit?.citations || [];
  const filtered = filter === 'all' ? citations : citations.filter(c => c.status === filter);

  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', transition: 'opacity 0.15s',
  };

  const filterBtn = (key, label) => ({
    padding: '4px 10px', borderRadius: 99, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: filter === key ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: filter === key ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.15s',
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Citation Health</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 99 }}>
              NAP Consistency
            </span>
            {audit?.status === 'complete' && (
              <span style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={14} /> Complete
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {audit?.created_at && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Last audit {new Date(audit.created_at).toLocaleDateString()}
              </span>
            )}
            <button onClick={runAudit} disabled={running} style={{ ...btnStyle, opacity: running ? 0.6 : 1 }}>
              {running
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Checking {currentStep}/{totalSteps}…</>
                : hasAudit
                  ? <><RefreshCw size={14} /> Re-Audit</>
                  : <><Play size={14} /> Run Audit</>
              }
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {running && totalSteps > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i + 1 < currentStep ? 'var(--accent)' : i + 1 === currentStep ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Checking directories ({(currentStep - 1) * 5 + 1}–{Math.min(currentStep * 5, totalSteps * 5)})…
            </p>
          </div>
        )}

        {/* Health score */}
        {hasAudit && audit.health_score != null && (
          <div style={{
            marginTop: 16, padding: 20, borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Citation Health Score</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: SCORE_COLOR(audit.health_score) }}>{audit.health_score}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/100</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {audit.total_correct} correct · {audit.total_inconsistent} inconsistent · {audit.total_missing} missing
                </p>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{audit.total_correct}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Correct</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ca8a04' }}>{audit.total_inconsistent}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Issues</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{audit.total_missing}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Missing</div>
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginTop: 16 }}>
              <div style={{ height: '100%', borderRadius: 3, background: SCORE_COLOR(audit.health_score), width: `${audit.health_score}%`, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Citations list */}
      {hasAudit && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Directory Listings</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={12} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
              <button onClick={() => setFilter('all')} style={filterBtn('all', 'All')}>All</button>
              <button onClick={() => setFilter('found_correct')} style={filterBtn('found_correct', 'Correct')}>
                Correct ({citations.filter(c => c.status === 'found_correct').length})
              </button>
              <button onClick={() => setFilter('found_inconsistent')} style={filterBtn('found_inconsistent', 'Issues')}>
                Issues ({citations.filter(c => c.status === 'found_inconsistent').length})
              </button>
              <button onClick={() => setFilter('not_found')} style={filterBtn('not_found', 'Missing')}>
                Missing ({citations.filter(c => c.status === 'not_found').length})
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(c => <CitationRow key={c.id} citation={c} />)}
            {filtered.length === 0 && (
              <p style={{ textAlign: 'center', padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>No citations match this filter.</p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAudit && !running && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '60px 20px', textAlign: 'center',
        }}>
          <Building2 size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>No citation audit yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 20px' }}>
            Run a citation audit to check NAP consistency across Google, Yelp, BBB, Apple Maps, and industry-specific directories.
          </p>
          <button onClick={runAudit} style={btnStyle}>
            <Play size={14} /> Run First Audit
          </button>
        </div>
      )}
    </div>
  );
}

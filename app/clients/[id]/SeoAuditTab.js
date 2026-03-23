'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RotateCcw, PlayCircle, AlertCircle, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const AUDIT_STEPS = [
  { num: 1, field: 'step1_crawlability', label: 'Crawlability' },
  { num: 2, field: 'step2_technical', label: 'Technical' },
  { num: 3, field: 'step3_onpage', label: 'On-Page' },
  { num: 4, field: 'step4_content', label: 'Content' },
  { num: 5, field: 'step5_keywords', label: 'Keywords' },
  { num: 6, field: 'step6_local_seo', label: 'Local SEO' },
  { num: 7, field: 'step7_competitors', label: 'Competitors' },
  { num: 8, field: 'step8_ai_visibility', label: 'AI Visibility' },
  { num: 9, field: 'step9_quick_wins', label: 'Quick Wins' },
  { num: 10, field: 'step10_roadmap', label: 'Roadmap' },
];

const PRIORITY_STYLES = {
  Critical: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  High:     { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
  Medium:   { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  Low:      { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
};

const EFFORT_STYLES = {
  Quick:  { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  Medium: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
  Heavy:  { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
};

function scoreColor(score) {
  if (score == null) return '#64748b';
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 48, height: 48, borderRadius: '50%', fontSize: 15, fontWeight: 800,
      background: `${color}20`, color, border: `2px solid ${color}40`,
      flexShrink: 0,
    }}>
      {score ?? '—'}
    </span>
  );
}

function Badge({ text, styleMap, fallback }) {
  const s = styleMap?.[text] || fallback || { bg: 'rgba(100,116,139,0.15)', color: '#64748b' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color, letterSpacing: '0.3px',
    }}>
      {text}
    </span>
  );
}

function DeltaBadge({ current, previous }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
      <Minus size={10} /> 0
    </span>
  );
  const isUp = delta > 0;
  const color = isUp ? '#10b981' : '#ef4444';
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10, fontWeight: 700, color,
      background: `${color}15`, padding: '1px 6px', borderRadius: 4,
    }}>
      <Icon size={10} /> {isUp ? '+' : ''}{delta}
    </span>
  );
}

export default function SeoAuditTab({ clientId, client, setClient }) {
  const supabase = createClient();
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    website: client?.website || '',
    primary_services: client?.primary_services || '',
    target_keywords: client?.target_keywords || '',
    competitors: client?.competitors || '',
  });

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setAudit(data);
        return data;
      }
      setAudit(prev => ({ ...(prev || {}), audit_status: 'error', audit_error: `API returned ${res.status}` }));
    } catch (err) {
      setAudit(prev => ({ ...(prev || {}), audit_status: 'error', audit_error: err.message }));
    }
    return null;
  }, [clientId]);

  // Initial load
  useEffect(() => {
    fetchAudit().finally(() => setAuditLoading(false));
  }, [fetchAudit]);

  // Auto-select first step when complete
  useEffect(() => {
    if (audit?.audit_status === 'complete' && activeStep === 0) {
      setActiveStep(1);
    }
  }, [audit?.audit_status, activeStep]);

  const saveFields = async () => {
    setSaving(true);
    const { data: updated } = await supabase
      .from('clients')
      .update({
        website: fields.website || null,
        primary_services: fields.primary_services || null,
        target_keywords: fields.target_keywords || null,
        competitors: fields.competitors || null,
      })
      .eq('id', clientId)
      .select('*')
      .single();
    setSaving(false);
    if (updated && setClient) setClient(updated);
  };

  const runAudit = async () => {
    await saveFields();
    setRunning(true);
    setActiveStep(0);

    // Optimistically show running state
    setAudit(prev => ({ ...(prev || {}), audit_status: 'running', audit_progress: 0 }));

    for (let step = 1; step <= 10; step++) {
      try {
        const res = await fetch(`/api/clients/${clientId}/run-audit?step=${step}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok || data.error) {
          setAudit(prev => ({ ...(prev || {}), audit_status: 'error', audit_error: data.error || `Step ${step} failed` }));
          setRunning(false);
          return;
        }

        // Update local state with this step's result + new progress
        setAudit(prev => ({
          ...(prev || {}),
          audit_status: data.complete ? 'complete' : 'running',
          audit_progress: data.progress,
          [data.field]: data.result,
          ...(data.complete ? { audit_completed_at: new Date().toISOString() } : {}),
        }));

        if (data.complete) {
          setActiveStep(1);
        }
      } catch (err) {
        setAudit(prev => ({ ...(prev || {}), audit_status: 'error', audit_error: err.message }));
        setRunning(false);
        return;
      }
    }

    setRunning(false);
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };

  // ── LOADING ──────────────────────────────────────────────
  if (auditLoading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>Loading audit status...</div>;
  }

  const status = audit?.audit_status;
  const progress = audit?.audit_progress ?? 0;

  // ── ERROR ─────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: 24, display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>Audit failed</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{audit?.audit_error || 'An unknown error occurred.'}</div>
          </div>
        </div>
        <button onClick={runAudit} disabled={running} style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'var(--accent)', color: 'white', border: 'none', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1,
        }}>
          <RotateCcw size={15} /> {running ? 'Running...' : 'Retry Audit'}
        </button>
      </div>
    );
  }

  // ── RUNNING ───────────────────────────────────────────────
  if (status === 'running') {
    const completedSteps = Math.floor(progress / 10);
    const currentStep = AUDIT_STEPS[completedSteps] || null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)',
              animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0,
            }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentStep ? `Analyzing ${currentStep.label}...` : 'Finishing up...'} &nbsp;
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>{progress}%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{
              height: '100%', background: 'var(--accent)', borderRadius: 4,
              width: `${progress}%`, transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AUDIT_STEPS.map((step) => {
              const done = progress >= step.num * 10;
              const active = currentStep?.num === step.num;
              return (
                <div key={step.num} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: done || active ? 1 : 0.35,
                  transition: 'opacity 0.3s ease',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: done ? '#10b981' : active ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: done || active ? 'white' : 'var(--text-muted)',
                  }}>
                    {done ? '✓' : step.num}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: done ? 'var(--text-secondary)' : active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>
                    {step.label}
                    {active && <span style={{ color: 'var(--accent)', marginLeft: 8, fontSize: 12 }}>analyzing...</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  // ── COMPLETE ──────────────────────────────────────────────
  if (status === 'complete') {
    const activeStepData = AUDIT_STEPS.find(s => s.num === activeStep);
    const stepResult = activeStepData ? audit?.[activeStepData.field] : null;
    const completedAt = audit?.audit_completed_at
      ? new Date(audit.audit_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;
    const prev = audit?.previous_audit_snapshot || null;
    const prevDate = prev?.audit_completed_at
      ? new Date(prev.audit_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {completedAt && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last audited: {completedAt}</span>
            )}
          </div>
          <button onClick={runAudit} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1,
          }}>
            <RotateCcw size={14} /> {running ? 'Running...' : 'Re-Run Audit'}
          </button>
        </div>

        {/* Score overview row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
        }}>
          {AUDIT_STEPS.map(step => {
            const result = audit?.[step.field];
            const sc = result?.score;
            const prevScore = prev?.[step.field]?.score;
            const color = scoreColor(sc);
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                  background: activeStep === step.num ? `${color}12` : 'transparent',
                  border: activeStep === step.num ? `1px solid ${color}40` : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{sc ?? '—'}</div>
                <DeltaBadge current={sc} previous={prevScore} />
                <div style={{ fontSize: 10, fontWeight: 600, color: activeStep === step.num ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center' }}>
                  {step.label}
                </div>
              </button>
            );
          })}
        </div>
        {prevDate && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: -8 }}>
            Compared to previous audit ({prevDate})
          </div>
        )}

        {/* Two-column layout: sidebar + detail */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Sidebar */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {AUDIT_STEPS.map(step => {
              const result = audit?.[step.field];
              const sc = result?.score;
              const prevScore = prev?.[step.field]?.score;
              const color = scoreColor(sc);
              const isActive = activeStep === step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: isActive ? 'var(--accent-muted)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    transition: 'background 0.15s ease', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: `${color}20`, color,
                    }}>
                      {sc ?? '—'}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                    <DeltaBadge current={sc} previous={prevScore} />
                  </div>
                  {isActive && <ChevronRight size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {activeStepData && stepResult ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <ScoreBadge score={stepResult.score} />
                  <DeltaBadge current={stepResult.score} previous={prev?.[activeStepData.field]?.score} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {activeStepData.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {stepResult.summary}
                  </div>
                  {prev?.[activeStepData.field]?.summary && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      Previous: {prev[activeStepData.field].summary}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(stepResult.items || []).map((item, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-tertiary)', borderRadius: 10, padding: 16,
                    borderLeft: `3px solid ${PRIORITY_STYLES[item.priority]?.color || '#64748b'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                      <Badge text={item.priority} styleMap={PRIORITY_STYLES} />
                      <Badge text={item.effort} styleMap={EFFORT_STYLES} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            }}>
              Select a section from the sidebar
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PENDING / null ────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          SEO Audit
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Fill in the details below and run a full 10-section AI-powered SEO audit. Takes 2-3 minutes.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Website URL</label>
            <input
              type="text"
              value={fields.website}
              onChange={e => setFields(f => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Primary Services</label>
            <input
              type="text"
              value={fields.primary_services}
              onChange={e => setFields(f => ({ ...f, primary_services: e.target.value }))}
              placeholder="e.g. Tree removal, trimming, stump grinding"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Target Keywords</label>
            <input
              type="text"
              value={fields.target_keywords}
              onChange={e => setFields(f => ({ ...f, target_keywords: e.target.value }))}
              placeholder="e.g. tree service Alexandria VA, tree removal near me"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Competitors</label>
            <input
              type="text"
              value={fields.competitors}
              onChange={e => setFields(f => ({ ...f, competitors: e.target.value }))}
              placeholder="e.g. Competitor A, Competitor B"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={runAudit}
            disabled={running || !fields.website}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 8,
              fontSize: 14, fontWeight: 600, background: 'var(--accent)', color: 'white',
              border: 'none', cursor: (running || !fields.website) ? 'not-allowed' : 'pointer',
              opacity: (running || !fields.website) ? 0.6 : 1, transition: 'opacity 0.15s ease',
            }}
          >
            <PlayCircle size={16} />
            {running ? 'Running audit...' : 'Run SEO Audit'}
          </button>
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saving...</span>}
          {!fields.website && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Website URL is required</span>
          )}
        </div>
      </div>

      {/* What gets analyzed */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
          What gets analyzed
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {AUDIT_STEPS.map(step => (
            <div key={step.num} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8,
              fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-muted)',
                color: 'var(--accent)', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{step.num}</span>
              {step.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

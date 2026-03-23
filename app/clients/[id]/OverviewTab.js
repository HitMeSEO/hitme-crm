'use client';

import { useState } from 'react';
import { SERVICE_KEYS, TASK_STATUS_COLORS, PRIORITY_COLORS, CONTENT_TYPE_COLORS, CONTENT_STATUS_COLORS } from '@/lib/constants';
import { Globe, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';

function ScoreCircle({ score, label, size = 48 }) {
  const color = score >= 90 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color,
      }}>{score}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{label}</div>
    </div>
  );
}

function PageSpeedCard({ client, onUpdate }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const ps = client.pagespeed_data;

  const runAudit = async () => {
    if (!client.website) { setError('No website URL on this client'); return; }
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/pagespeed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, url: client.website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      if (onUpdate) onUpdate(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid #6366f133', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          ⚡ PageSpeed Insights
        </h3>
        <button onClick={runAudit} disabled={running} style={{
          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: running ? 'wait' : 'pointer',
          background: running ? 'var(--bg-tertiary)' : 'rgba(99,102,241,0.1)', color: '#6366f1', border: 'none',
        }}>
          {running ? '⏳ Running...' : ps ? '🔄 Re-run' : '▶️ Run Audit'}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}
      {ps ? (
        <div>
          {/* Mobile Scores */}
          {ps.mobile?.scores && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>📱 Mobile</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around' }}>
                <ScoreCircle score={ps.mobile.scores.performance} label="Perf" />
                <ScoreCircle score={ps.mobile.scores.seo} label="SEO" />
                <ScoreCircle score={ps.mobile.scores.accessibility} label="A11y" />
                <ScoreCircle score={ps.mobile.scores.bestPractices} label="Best P." />
              </div>
            </div>
          )}
          {/* Desktop Scores */}
          {ps.desktop?.scores && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>🖥️ Desktop</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around' }}>
                <ScoreCircle score={ps.desktop.scores.performance} label="Perf" />
                <ScoreCircle score={ps.desktop.scores.seo} label="SEO" />
                <ScoreCircle score={ps.desktop.scores.accessibility} label="A11y" />
                <ScoreCircle score={ps.desktop.scores.bestPractices} label="Best P." />
              </div>
            </div>
          )}
          {/* Core Web Vitals */}
          {ps.mobile?.coreWebVitals && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Core Web Vitals (Mobile)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ps.mobile.coreWebVitals.lcp && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>LCP: <b>{ps.mobile.coreWebVitals.lcp}</b></span>}
                {ps.mobile.coreWebVitals.cls && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CLS: <b>{ps.mobile.coreWebVitals.cls}</b></span>}
                {ps.mobile.coreWebVitals.tbt && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>TBT: <b>{ps.mobile.coreWebVitals.tbt}</b></span>}
                {ps.mobile.coreWebVitals.fcp && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>FCP: <b>{ps.mobile.coreWebVitals.fcp}</b></span>}
                {ps.mobile.coreWebVitals.si && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>SI: <b>{ps.mobile.coreWebVitals.si}</b></span>}
              </div>
            </div>
          )}
          {ps.audited_at && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, textAlign: 'right' }}>
              Last run: {new Date(ps.audited_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          No audit data yet — click Run Audit to check site speed
        </div>
      )}
    </div>
  );
}

function SearchConsoleCard({ client, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(28);
  const [tab, setScTab] = useState('queries');
  const sc = client.search_console_data;

  const fetchData = async (period) => {
    const d = period || days;
    if (!client.website) { setError('No website URL on this client'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/google/search-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: client.website, clientId: client.id, days: d }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to fetch';
        if (msg.includes('sufficient permission')) {
          throw new Error('Site not found in Search Console for the connected Google account.');
        }
        throw new Error(msg);
      }
      if (onUpdate) onUpdate(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changePeriod = (d) => { setDays(d); fetchData(d); };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid #3b82f633', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          🔍 Search Console
        </h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sc && (
            <div style={{ display: 'flex', gap: 2 }}>
              {[7, 28, 90].map(d => (
                <button key={d} onClick={() => changePeriod(d)} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: days === d ? '#3b82f6' : 'var(--bg-tertiary)', color: days === d ? '#fff' : 'var(--text-muted)',
                }}>{d}d</button>
              ))}
            </div>
          )}
          <button onClick={() => fetchData()} disabled={loading} style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
            background: loading ? 'var(--bg-tertiary)' : 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none',
          }}>
            {loading ? '⏳ Fetching...' : sc ? '🔄 Refresh' : '▶️ Fetch Data'}
          </button>
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, padding: '8px 10px', background: '#ef444410', borderRadius: 6 }}>{error}</div>}
      {sc ? (
        <div>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{(sc.totals?.clicks || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Clicks</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{(sc.totals?.impressions || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Impressions</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{sc.totals?.ctr || 0}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>CTR</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{sc.totals?.avgPosition || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avg Position</div>
            </div>
          </div>
          {/* Tabs: Queries / Pages */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
            {['queries', 'pages'].map(t => (
              <button key={t} onClick={() => setScTab(t)} style={{
                fontSize: 11, fontWeight: 600, padding: '6px 14px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: tab === t ? '#3b82f6' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent', marginBottom: -1,
              }}>{t === 'queries' ? 'Top Queries' : 'Top Pages'}</button>
            ))}
          </div>
          {/* Top Queries */}
          {tab === 'queries' && sc.topQueries && sc.topQueries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sc.topQueries.slice(0, 10).map((q, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                  background: 'var(--bg-tertiary)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, width: 16, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{q.clicks}</span>
                  <span style={{ color: '#8b5cf6', fontSize: 10, minWidth: 30, textAlign: 'right' }}>{q.impressions}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 40, textAlign: 'right' }}>pos {q.position}</span>
                </div>
              ))}
            </div>
          )}
          {/* Top Pages */}
          {tab === 'pages' && sc.topPages && sc.topPages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sc.topPages.slice(0, 10).map((p, i) => {
                let shortUrl = p.page;
                try { shortUrl = new URL(p.page).pathname; } catch {}
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                    background: 'var(--bg-tertiary)', fontSize: 11,
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700, width: 16, textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.page}>{shortUrl}</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{p.clicks}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 40, textAlign: 'right' }}>pos {p.position}</span>
                  </div>
                );
              })}
            </div>
          )}
          {sc.period && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, textAlign: 'right' }}>
              {sc.siteUrl && <span style={{ marginRight: 8 }}>Property: {sc.siteUrl}</span>}
              {sc.period.start} → {sc.period.end}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          No Search Console data yet — click Fetch Data to pull keywords & clicks
        </div>
      )}
    </div>
  );
}

function AnalyticsCard({ client, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(28);
  const [gaTab, setGaTab] = useState('channels');
  const ga = client.analytics_data;

  const fetchData = async (period) => {
    const d = period || days;
    if (!client.ga4_property_id) { setError('No GA4 property ID set. Add it in Edit → GA4 Analytics.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/google/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: client.ga4_property_id, clientId: client.id, days: d }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      if (onUpdate) onUpdate(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changePeriod = (d) => { setDays(d); fetchData(d); };

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid #f9731633', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          📊 GA4 Analytics
        </h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {ga && (
            <div style={{ display: 'flex', gap: 2 }}>
              {[7, 28, 90].map(d => (
                <button key={d} onClick={() => changePeriod(d)} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: days === d ? '#f97316' : 'var(--bg-tertiary)', color: days === d ? '#fff' : 'var(--text-muted)',
                }}>{d}d</button>
              ))}
            </div>
          )}
          <button onClick={() => fetchData()} disabled={loading} style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
            background: loading ? 'var(--bg-tertiary)' : 'rgba(249,115,22,0.1)', color: '#f97316', border: 'none',
          }}>
            {loading ? '⏳ Fetching...' : ga ? '🔄 Refresh' : '▶️ Fetch Data'}
          </button>
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, padding: '8px 10px', background: '#ef444410', borderRadius: 6 }}>{error}</div>}
      {ga ? (
        <div>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f97316' }}>{(ga.totals?.sessions || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Sessions</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{(ga.totals?.users || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Users</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{(ga.totals?.pageviews || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Pageviews</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6' }}>{formatDuration(ga.totals?.avgSessionDuration)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Avg Duration</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{((ga.totals?.bounceRate || 0) * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Bounce Rate</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{(ga.totals?.conversions || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Conversions</div>
            </div>
          </div>
          {/* Tabs: Channels / Pages */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
            {['channels', 'pages'].map(t => (
              <button key={t} onClick={() => setGaTab(t)} style={{
                fontSize: 11, fontWeight: 600, padding: '6px 14px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: gaTab === t ? '#f97316' : 'var(--text-muted)',
                borderBottom: gaTab === t ? '2px solid #f97316' : '2px solid transparent', marginBottom: -1,
              }}>{t === 'channels' ? 'Top Channels' : 'Top Pages'}</button>
            ))}
          </div>
          {/* Top Sources */}
          {gaTab === 'channels' && ga.topSources && ga.topSources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ga.topSources.slice(0, 8).map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                  background: 'var(--bg-tertiary)', fontSize: 11,
                }}>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{s.channel}</span>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{s.sessions} sessions</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{s.users} users</span>
                </div>
              ))}
            </div>
          )}
          {/* Top Pages */}
          {gaTab === 'pages' && ga.topPages && ga.topPages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ga.topPages.slice(0, 8).map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                  background: 'var(--bg-tertiary)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, width: 16, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.page}>{p.page}</span>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{p.views}</span>
                </div>
              ))}
            </div>
          )}
          {ga.period && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, textAlign: 'right' }}>
              {client.ga4_property_id && <span style={{ marginRight: 8 }}>Property: {client.ga4_property_id}</span>}
              {ga.period.start} → {ga.period.end}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          {client.ga4_property_id
            ? 'No analytics data yet — click Fetch Data to pull traffic stats'
            : 'No GA4 property ID set — add it in client Edit to enable analytics'}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ client, locations, contacts, looker, tasks, content, setTab, onClientUpdate }) {
  const primaryContact = contacts.find(c => c.is_primary);
  return (
    <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Info Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Company Info
        </h3>
        <InfoRow icon={<Globe size={14} />} label="Website" value={client.website} link />
        <InfoRow icon={<Phone size={14} />} label="Phone" value={client.phone} />
        <InfoRow icon={<Mail size={14} />} label="Email" value={client.email} />
        <InfoRow icon={<MapPin size={14} />} label="Address" value={
          [client.address_street, client.address_city, client.address_state, client.address_zip].filter(Boolean).join(', ')
        } />
        {client.notes && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {client.notes}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* GBP At a Glance */}
        {(client.gbp_rating || client.gbp_review_count || client.gbp_categories) && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid #10b98133', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              📍 Google Business Profile
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {client.gbp_rating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>
                    {client.gbp_rating}
                  </span>
                  <div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(i => (
                        <span key={i} style={{ fontSize: 14, color: i <= Math.round(client.gbp_rating) ? '#f59e0b' : 'var(--border)' }}>★</span>
                      ))}
                    </div>
                    {client.gbp_review_count && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {client.gbp_review_count.toLocaleString()} reviews
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!client.gbp_rating && client.gbp_review_count && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  💬 {client.gbp_review_count.toLocaleString()} reviews
                </div>
              )}
              {client.gbp_categories && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>🏷️</span>
                  {client.gbp_categories}
                </div>
              )}
              {client.phone && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  {client.phone}
                </div>
              )}
              {(client.address_city || client.address_street) && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                  {[client.address_street, client.address_city, client.address_state, client.address_zip].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Primary Contact */}
        {primaryContact && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Primary Contact
            </h3>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {primaryContact.first_name} {primaryContact.last_name}
            </div>
            {primaryContact.title && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{primaryContact.title}</div>
            )}
            {primaryContact.email && (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{primaryContact.email}</div>
            )}
            {primaryContact.phone && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{primaryContact.phone}</div>
            )}
          </div>
        )}

        {/* Looker Report */}
        {looker && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Reporting
            </h3>
            <a href={looker.url} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(249,115,22,0.1)', color: '#f97316', textDecoration: 'none',
            }}>
              📊 Open Looker Studio <ExternalLink size={12} />
            </a>
            {looker.report_contacts && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Report to: {looker.report_contacts}
              </div>
            )}
            {looker.report_notes && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                {looker.report_notes}
              </div>
            )}
          </div>
        )}

        {/* Services Summary */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Active Services
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SERVICE_KEYS.filter(s => client[s.key]).map(s => (
              <span key={s.key} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: `${s.color}18`, color: s.color,
              }}>
                {s.icon} {s.label}
              </span>
            ))}
            {SERVICE_KEYS.filter(s => client[s.key]).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No services assigned</span>
            )}
          </div>
        </div>

        {/* PageSpeed Insights */}
        <PageSpeedCard client={client} onUpdate={(data) => onClientUpdate && onClientUpdate({ ...client, pagespeed_data: data })} />
      </div>

      {/* SEO & Analytics Row - full width */}
      <SearchConsoleCard client={client} onUpdate={(data) => onClientUpdate && onClientUpdate({ ...client, search_console_data: data })} />
      <AnalyticsCard client={client} onUpdate={(data) => onClientUpdate && onClientUpdate({ ...client, analytics_data: data })} />

      {/* Recent Tasks */}
      {tasks && tasks.length > 0 && (
        <div style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              Open Tasks
            </h3>
            <button onClick={() => setTab('tasks')} style={{
              fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>View All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.filter(t => !['Done', 'Archived'].includes(t.status)).slice(0, 5).map(t => (
              <div key={t.id} onClick={() => setTab('tasks')} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-tertiary)', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{t.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                  background: `${TASK_STATUS_COLORS[t.status] || '#64748b'}15`, color: TASK_STATUS_COLORS[t.status] || '#64748b',
                }}>{t.status}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                  background: `${PRIORITY_COLORS[t.priority] || '#64748b'}15`, color: PRIORITY_COLORS[t.priority] || '#64748b',
                }}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Content */}
      {content && content.length > 0 && (
        <div style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              Recent Content
            </h3>
            <button onClick={() => setTab('content')} style={{
              fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>View All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {content.slice(0, 5).map(item => {
              const typeColor = CONTENT_TYPE_COLORS[item.content_type] || '#64748b';
              return (
                <div key={item.id} onClick={() => setTab('content')} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-tertiary)', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{item.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                    background: `${typeColor}18`, color: typeColor,
                  }}>{item.content_type === 'service_location_page' ? 'Service Page' : item.content_type}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                    background: `${CONTENT_STATUS_COLORS[item.status] || '#64748b'}18`, color: CONTENT_STATUS_COLORS[item.status] || '#64748b',
                  }}>{item.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, link }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <span style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)' }}>{value}</a>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
        )}
      </div>
    </div>
  );
}

export default OverviewTab;

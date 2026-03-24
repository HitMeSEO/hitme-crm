'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Globe, Phone, MapPin, Star, CheckSquare, Square, ExternalLink, Clock, Radar, Play, RotateCw, Zap, FileText, Code, MessageSquare, HelpCircle, Wrench } from 'lucide-react';

const STATIC_ACTIONS = [
  { key: 'respond_reviews', label: 'Respond to recent reviews' },
  { key: 'post_this_week', label: 'Post to GBP this week' },
  { key: 'add_photos', label: 'Add more photos' },
];

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function calcScore(client) {
  const hasPhone = !!client.phone;
  const hasWebsite = !!client.website;
  const hasCategories = !!client.gbp_categories;
  const rating = client.gbp_rating ? parseFloat(client.gbp_rating) : null;
  const reviews = client.gbp_review_count ? parseInt(client.gbp_review_count) : null;

  const checks = [];

  checks.push({ label: 'Phone number on file', pass: hasPhone, color: hasPhone ? '#10b981' : '#ef4444', points: hasPhone ? 20 : 0 });
  checks.push({ label: 'Website on file', pass: hasWebsite, color: hasWebsite ? '#10b981' : '#ef4444', points: hasWebsite ? 20 : 0 });
  checks.push({ label: 'Business categories set', pass: hasCategories, color: hasCategories ? '#10b981' : '#ef4444', points: hasCategories ? 20 : 0 });

  let reviewColor = '#ef4444', reviewLabel = 'Reviews: not tracked yet', reviewPoints = 0;
  if (reviews !== null) {
    if (reviews >= 50) { reviewColor = '#10b981'; reviewLabel = `Reviews: ${reviews.toLocaleString()} (great)`; reviewPoints = 20; }
    else if (reviews >= 10) { reviewColor = '#f59e0b'; reviewLabel = `Reviews: ${reviews} (building)`; reviewPoints = 10; }
    else { reviewLabel = `Reviews: ${reviews} (needs work)`; }
  }
  checks.push({ label: reviewLabel, pass: reviews >= 50, color: reviewColor, points: reviewPoints });

  let ratingColor = '#ef4444', ratingLabel = 'Rating: not tracked yet', ratingPoints = 0;
  if (rating !== null) {
    if (rating >= 4.5) { ratingColor = '#10b981'; ratingLabel = `Rating: ${rating} (excellent)`; ratingPoints = 20; }
    else if (rating >= 4.0) { ratingColor = '#f59e0b'; ratingLabel = `Rating: ${rating} (good)`; ratingPoints = 10; }
    else { ratingLabel = `Rating: ${rating} (needs attention)`; }
  }
  checks.push({ label: ratingLabel, pass: rating >= 4.5, color: ratingColor, points: ratingPoints });

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  return { score, checks };
}

function StarRow({ rating, size = 13 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size}
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : 'var(--border)'} />
      ))}
    </div>
  );
}

export default function GbpHealthTab({ client, setClient, clientId }) {
  const supabase = createClient();
  const [checklist, setChecklist] = useState({});
  const [notes, setNotes] = useState(client.gbp_health_notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [lastPostDate, setLastPostDate] = useState(client.gbp_last_post_date || '');
  const [postFrequency, setPostFrequency] = useState(client.gbp_post_frequency || 'weekly');
  const [postSaving, setPostSaving] = useState(false);
  const [postSaved, setPostSaved] = useState(false);

  useEffect(() => {
    if (client.gbp_action_checklist) {
      setChecklist(
        typeof client.gbp_action_checklist === 'string'
          ? JSON.parse(client.gbp_action_checklist)
          : client.gbp_action_checklist
      );
    }
    setNotes(client.gbp_health_notes || '');
    setLastPostDate(client.gbp_last_post_date || '');
    setPostFrequency(client.gbp_post_frequency || 'weekly');
  }, [client.id]);

  const savePostTracker = useCallback(async (dateVal, freqVal) => {
    setPostSaving(true);
    const updates = { gbp_last_post_date: dateVal || null, gbp_post_frequency: freqVal || 'weekly' };
    await supabase.from('clients').update(updates).eq('id', clientId);
    setClient(prev => ({ ...prev, ...updates }));
    setPostSaving(false);
    setPostSaved(true);
    setTimeout(() => setPostSaved(false), 2000);
  }, [clientId]);

  const toggleCheck = async (key) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    await supabase.from('clients').update({ gbp_action_checklist: updated }).eq('id', clientId);
    setClient(prev => ({ ...prev, gbp_action_checklist: updated }));
  };

  const saveNotes = useCallback(async () => {
    setNotesSaving(true);
    await supabase.from('clients').update({ gbp_health_notes: notes }).eq('id', clientId);
    setClient(prev => ({ ...prev, gbp_health_notes: notes }));
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }, [notes, clientId]);

  // Derived data
  const rating = client.gbp_rating ? parseFloat(client.gbp_rating) : null;
  const reviews = client.gbp_review_count ? parseInt(client.gbp_review_count) : null;
  const categories = client.gbp_categories
    ? client.gbp_categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  const hours = client.gbp_hours
    ? (typeof client.gbp_hours === 'string' ? JSON.parse(client.gbp_hours) : client.gbp_hours)
    : null;
  const weekdayDescriptions = hours?.weekdayDescriptions || [];

  const gbpReviews = client.gbp_reviews
    ? (typeof client.gbp_reviews === 'string' ? JSON.parse(client.gbp_reviews) : client.gbp_reviews)
    : [];

  const serviceAreas = client.gbp_service_areas
    ? (typeof client.gbp_service_areas === 'string' ? JSON.parse(client.gbp_service_areas) : client.gbp_service_areas)
    : [];

  const dynamicActions = [];
  if (!client.phone) dynamicActions.push({ key: 'add_phone', label: 'Add phone number to GBP listing' });
  if (!client.website) dynamicActions.push({ key: 'add_website', label: 'Add website to GBP listing' });
  const allActions = [...dynamicActions, ...STATIC_ACTIONS];

  const { score, checks } = calcScore(client);
  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Work' : 'Critical';

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 };
  const sectionTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── AI Readiness Dashboard ── */}
      <AiReadinessDashboard clientId={clientId} clientName={client.company_name} />

      {/* ── Health Score ── */}
      <div style={{ ...card, borderColor: `${scoreColor}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={sectionTitle}>GBP Health Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}%</span>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: `${scoreColor}18`, color: scoreColor }}>
                {scoreLabel}
              </span>
            </div>
          </div>
          <div style={{ flex: '1 1 200px', maxWidth: 300 }}>
            <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 6, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{score} / 100 points</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginTop: 20 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: `${c.color}10`, border: `1px solid ${c.color}30` }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{c.pass ? '✓' : '✗'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${c.color}20`, color: c.color }}>+{c.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── GBP Snapshot + Hours side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Snapshot */}
        <div style={card}>
          <div style={sectionTitle}>GBP Snapshot</div>

          {/* Rating */}
          {rating !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{rating}</span>
              <div>
                <StarRow rating={rating} />
                {reviews !== null && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{reviews.toLocaleString()} reviews</div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Editorial summary */}
            {client.gbp_editorial_summary && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                {client.gbp_editorial_summary}
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Categories</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {categories.map((cat, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', textTransform: 'capitalize' }}>{cat}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Service areas */}
            {serviceAreas.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Service Areas</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {serviceAreas.map((area, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      📍 {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Phone */}
            {client.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Phone size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {client.phone}
              </div>
            )}

            {/* Address */}
            {(client.address_street || client.address_city) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                {[client.address_street, client.address_city, client.address_state, client.address_zip].filter(Boolean).join(', ')}
              </div>
            )}

            {/* Website */}
            {client.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <a href={client.website} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* Google Maps button */}
            {client.gbp_maps_url && (
              <a href={client.gbp_maps_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
                padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: 'rgba(66,133,244,0.1)', color: '#4285f4',
                border: '1px solid rgba(66,133,244,0.3)', textDecoration: 'none',
              }}>
                🗺️ Open in Google Maps <ExternalLink size={11} />
              </a>
            )}

            {!rating && !reviews && !client.phone && !client.website && categories.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                No GBP data yet. Use the Add Client form to search and import GBP data.
              </div>
            )}
          </div>
        </div>

        {/* Business Hours */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Clock size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={sectionTitle}>Business Hours</div>
            </div>
            {weekdayDescriptions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {weekdayDescriptions.map((desc, i) => {
                  const colonIdx = desc.indexOf(':');
                  const day = colonIdx >= 0 ? desc.slice(0, colonIdx) : desc;
                  const time = colonIdx >= 0 ? desc.slice(colonIdx + 2) : '';
                  const isClosed = time.toLowerCase().includes('closed');
                  const isToday = new Date().getDay() === (i + 1) % 7;
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px', borderRadius: 6,
                      background: isToday ? 'var(--accent-muted)' : 'transparent',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', minWidth: 90 }}>
                        {day}
                        {isToday && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'var(--accent)', color: 'white' }}>TODAY</span>}
                      </span>
                      <span style={{ fontSize: 12, color: isClosed ? '#ef4444' : isToday ? 'var(--accent)' : 'var(--text-primary)', fontWeight: isToday ? 600 : 400, textAlign: 'right' }}>
                        {time || 'Closed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Hours not available. Re-import from GBP to pull hours.
              </div>
            )}
          </div>

          {/* Post Tracker — editable */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={sectionTitle}>Post Tracker</div>
              {(postSaving || postSaved) && (
                <span style={{ fontSize: 11, color: postSaved ? '#10b981' : 'var(--text-muted)' }}>
                  {postSaving ? 'Saving...' : '✓ Saved'}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Last Post</div>
                <input
                  type="date"
                  value={lastPostDate}
                  onChange={e => {
                    setLastPostDate(e.target.value);
                    savePostTracker(e.target.value, postFrequency);
                  }}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Days Since Post</div>
                {(() => {
                  if (!lastPostDate) return <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>;
                  const days = Math.floor((Date.now() - new Date(lastPostDate + 'T00:00:00').getTime()) / 86400000);
                  const color = days <= 7 ? '#10b981' : days <= 14 ? '#f59e0b' : '#ef4444';
                  return <div style={{ fontSize: 20, fontWeight: 700, color }}>{days < 0 ? 0 : days}</div>;
                })()}
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Post Frequency</div>
              <select
                value={postFrequency}
                onChange={e => {
                  setPostFrequency(e.target.value);
                  savePostTracker(lastPostDate, e.target.value);
                }}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  boxSizing: 'border-box', cursor: 'pointer',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                <option value="daily">Daily</option>
                <option value="3x_week">3x per week</option>
                <option value="2x_week">2x per week</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {lastPostDate && (() => {
              const days = Math.floor((Date.now() - new Date(lastPostDate + 'T00:00:00').getTime()) / 86400000);
              const freqDays = { daily: 1, '3x_week': 3, '2x_week': 4, weekly: 7, biweekly: 14, monthly: 30 };
              const threshold = freqDays[postFrequency] || 7;
              const overdue = days > threshold;
              if (overdue) {
                return (
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠ Overdue — last posted {days} days ago (target: every {threshold} days)
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* ── Recent Reviews ── */}
      {gbpReviews.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Recent Reviews ({gbpReviews.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gbpReviews.map((review, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-muted)', color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                    }}>
                      {(review.author || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{review.author}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{review.date}</div>
                    </div>
                  </div>
                  <StarRow rating={review.rating} size={12} />
                </div>
                {review.text && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {review.text.length > 280 ? review.text.slice(0, 280) + '…' : review.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Action Items ── */}
      <div style={card}>
        <div style={sectionTitle}>Action Items</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allActions.map(action => {
            const checked = !!checklist[action.key];
            return (
              <button key={action.key} onClick={() => toggleCheck(action.key)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: checked ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                border: '1px solid var(--border)', textAlign: 'left', transition: 'all 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {checked
                  ? <CheckSquare size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                  : <Square size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, color: checked ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: checked ? 'line-through' : 'none' }}>
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notes ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={sectionTitle}>GBP Notes</div>
          {(notesSaving || notesSaved) && (
            <span style={{ fontSize: 11, color: notesSaved ? '#10b981' : 'var(--text-muted)' }}>
              {notesSaving ? 'Saving...' : '✓ Saved'}
            </span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notes about this client's GBP listing — missing info, action history, issues to flag..."
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
            outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {/* ── GEO Radar: AI Search Visibility ── */}
      <GeoRadarSection clientId={clientId} clientName={client.company_name} />

    </div>
  );
}

function AiReadinessDashboard({ clientId, clientName }) {
  const [audit, setAudit] = useState(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState('');
  const [fixMsg, setFixMsg] = useState('');

  useEffect(() => {
    loadLatestAudit();
  }, [clientId]);

  const loadLatestAudit = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('client_audits')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    // If audit has a linked GEO Radar scan, fetch its score
    if (data?.geo_radar_scan_id) {
      const { data: radar } = await supabase
        .from('geo_radar_scans')
        .select('visibility_score')
        .eq('id', data.geo_radar_scan_id)
        .maybeSingle();
      if (radar) data._geo_radar_score = radar.visibility_score;
    }
    setAudit(data);
  };

  const runAudit = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      await loadLatestAudit();
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  const runFix = async () => {
    if (!audit) return;
    setFixing(true);
    setFixMsg('');
    setError('');
    try {
      const res = await fetch('/api/audit/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, audit_id: audit.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fix failed');
      setFixMsg(data.message);
    } catch (e) {
      setError(e.message);
    }
    setFixing(false);
  };

  const scoreColor = (pct) => {
    if (pct >= 60) return '#10b981';
    if (pct >= 30) return '#f59e0b';
    return '#ef4444';
  };

  const barStyle = (pct) => ({
    height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden', flex: 1,
  });

  const fillStyle = (pct) => ({
    height: '100%', borderRadius: 4, background: scoreColor(pct),
    width: `${Math.min(pct, 100)}%`, transition: 'width 0.5s ease',
  });

  const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 20,
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: '#f59e0b' }} />
          AI Readiness Audit
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {audit && (
            <button onClick={runFix} disabled={fixing} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7,
              fontSize: 12, fontWeight: 600, border: 'none', cursor: fixing ? 'not-allowed' : 'pointer',
              background: 'rgba(16,185,129,0.15)', color: '#10b981', opacity: fixing ? 0.6 : 1,
            }}>
              <Wrench size={13} />{fixing ? 'Fixing...' : 'Fix Everything'}
            </button>
          )}
          <button onClick={runAudit} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7,
            fontSize: 12, fontWeight: 600, border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            background: running ? 'var(--bg-tertiary)' : 'var(--accent)', color: running ? 'var(--text-muted)' : 'white',
            opacity: running ? 0.7 : 1,
          }}>
            {running ? <><RotateCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Scanning...</> : <><Play size={13} /> Run Audit</>}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: 12 }}>{error}</div>
      )}
      {fixMsg && (
        <div style={{ fontSize: 12, color: '#10b981', padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 6, marginBottom: 12 }}>{fixMsg}</div>
      )}

      {running && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Scanning content gaps, schema, GBP activity, and FAQ coverage...
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!running && !audit && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
          No audit yet. Click &quot;Run Audit&quot; to scan {clientName}&apos;s AI readiness across all dimensions.
        </div>
      )}

      {!running && audit && (
        <div>
          {/* Overall Score */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
            padding: 16, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              border: `4px solid ${scoreColor(audit.ai_readiness_score)}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(audit.ai_readiness_score) }}>
                {audit.ai_readiness_score}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                AI Readiness Score
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Scanned {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Individual Scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                icon: <FileText size={14} />,
                label: 'Content Coverage',
                pct: audit.content_gap_results?.coverage_pct || 0,
                detail: `${audit.content_gap_results?.locations_with_content || 0}/${audit.content_gap_results?.total_locations || 0} locations`,
                gaps: audit.content_gap_results?.total_gaps || 0,
                gapLabel: 'pages needed',
              },
              {
                icon: <Radar size={14} />,
                label: 'AI Visibility',
                pct: audit._geo_radar_score ?? (audit.geo_radar_scan_id ? 0 : null),
                detail: audit.geo_radar_scan_id ? `${audit._geo_radar_score || 0}% visibility` : 'No scan yet — run GEO Radar below',
                gaps: null,
                gapLabel: 'Run GEO Radar below',
                noBar: !audit.geo_radar_scan_id,
              },
              {
                icon: <Code size={14} />,
                label: 'Schema Markup',
                pct: audit.schema_scan_results?.coverage_pct || 0,
                detail: `${audit.schema_scan_results?.pages_with_schema || 0}/${audit.schema_scan_results?.total_pages || 0} pages`,
                gaps: audit.schema_scan_results?.gaps?.length || 0,
                gapLabel: 'pages need schema',
              },
              {
                icon: <MessageSquare size={14} />,
                label: 'GBP Activity',
                pct: audit.gbp_post_results?.activity_pct || 0,
                detail: `${audit.gbp_post_results?.recent_posts || 0} recent posts`,
                gaps: audit.gbp_post_results?.stale_locations || 0,
                gapLabel: 'locations need posts',
              },
              {
                icon: <HelpCircle size={14} />,
                label: 'FAQ Coverage',
                pct: audit.faq_gap_results?.coverage_pct || 0,
                detail: `${audit.faq_gap_results?.answered || 0}/${audit.faq_gap_results?.total_questions || 0} questions`,
                gaps: audit.faq_gap_results?.unanswered?.length || 0,
                gapLabel: 'unanswered questions',
              },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ width: 120, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.detail}</div>
                </div>
                {!item.noBar && (
                  <>
                    <div style={barStyle(item.pct)}>
                      <div style={fillStyle(item.pct)} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(item.pct), minWidth: 36, textAlign: 'right' }}>
                      {item.pct}%
                    </span>
                  </>
                )}
                {item.gaps !== null && item.gaps > 0 && (
                  <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {item.gaps} {item.gapLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GeoRadarSection({ clientId, clientName }) {
  const supabase = createClient();
  const [scans, setScans] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [expandedScan, setExpandedScan] = useState(null);

  const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 20,
  };
  const sTitle = {
    fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
    display: 'flex', alignItems: 'center', gap: 8,
  };

  useEffect(() => {
    loadScans();
  }, [clientId]);

  const loadScans = async () => {
    const { data } = await supabase
      .from('geo_radar_scans')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10);
    setScans(data || []);
  };

  const runScan = async () => {
    setScanning(true);
    setScanError('');
    try {
      const res = await fetch('/api/geo-radar/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      await loadScans();
    } catch (e) {
      setScanError(e.message);
    }
    setScanning(false);
  };

  const scoreColor = (score) => {
    if (score >= 60) return '#10b981';
    if (score >= 30) return '#f59e0b';
    return '#ef4444';
  };

  const scoreLabel = (score) => {
    if (score >= 60) return 'Strong';
    if (score >= 30) return 'Moderate';
    return 'Low';
  };

  const latestScan = scans.find(s => s.status === 'complete');

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={sTitle}>
          <Radar size={18} style={{ color: 'var(--accent)' }} />
          GEO Radar — AI Search Visibility
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7,
            fontSize: 12, fontWeight: 600, border: 'none', cursor: scanning ? 'not-allowed' : 'pointer',
            background: scanning ? 'var(--bg-tertiary)' : 'var(--accent)', color: scanning ? 'var(--text-muted)' : 'white',
            opacity: scanning ? 0.7 : 1,
          }}
        >
          {scanning ? <><RotateCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Scanning...</> : <><Play size={13} /> Run Scan</>}
        </button>
      </div>

      {scanError && (
        <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: 12 }}>
          {scanError}
        </div>
      )}

      {scanning && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Querying AI search engines for <strong style={{ color: 'var(--text-primary)' }}>{clientName}</strong>... This takes 1-2 minutes.
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!scanning && latestScan && (
        <div style={{ marginBottom: 16 }}>
          {/* Score card */}
          <div style={{
            display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, padding: 16,
            background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                border: `4px solid ${scoreColor(latestScan.visibility_score)}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(latestScan.visibility_score) }}>
                  {latestScan.visibility_score}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2 }}>/ 100</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, marginTop: 6,
                color: scoreColor(latestScan.visibility_score),
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {scoreLabel(latestScan.visibility_score)}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Queries</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{latestScan.queries_run}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Mentions</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(latestScan.visibility_score) }}>{latestScan.mentions_found}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Scanned</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {latestScan.scanned_at ? new Date(latestScan.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </div>
                </div>
              </div>
              {latestScan.summary && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {latestScan.summary}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setExpandedScan(expandedScan === latestScan.id ? null : latestScan.id)}
            style={{
              marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}
          >
            {expandedScan === latestScan.id ? '▼ Hide query details' : '▶ Show query details'}
          </button>

          {expandedScan === latestScan.id && latestScan.results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {latestScan.results.map((r, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: r.mentioned ? 'rgba(16,185,129,0.06)' : 'var(--bg-tertiary)',
                  border: `1px solid ${r.mentioned ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: r.mentioned ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                      color: r.mentioned ? '#10b981' : '#ef4444',
                    }}>
                      {r.mentioned ? 'FOUND' : 'NOT FOUND'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{r.service}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{r.query}</div>
                  {r.context && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      &quot;...{r.context}...&quot;
                    </div>
                  )}
                  {r.competitors && r.competitors.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Competitors: {r.competitors.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!scanning && !latestScan && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
          No scans yet. Click &quot;Run Scan&quot; to check how {clientName} appears in AI search results.
        </div>
      )}

      {scans.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Previous Scans
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {scans.slice(1).map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: scoreColor(s.visibility_score),
                  minWidth: 36,
                }}>{s.visibility_score}%</span>
                <span>{s.mentions_found}/{s.queries_run} mentions</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {s.scanned_at ? new Date(s.scanned_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

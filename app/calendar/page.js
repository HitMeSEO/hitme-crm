'use client';

// Force dynamic rendering — prevents Next 15 from trying to prerender this
// page at build time when AppShell's transitively-imported Supabase client
// would fail without runtime env vars. The calendar always needs runtime
// session data anyway.
export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, MapPin, Users, ExternalLink, Video, RefreshCw, AlertCircle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────

function startOfWeek(d) {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfWeek(d) {
  const e = new Date(d);
  e.setDate(e.getDate() + (6 - e.getDay()));
  e.setHours(23, 59, 59, 999);
  return e;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatTime(isoStr) {
  if (!isoStr || !isoStr.includes('T')) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatRange(ev) {
  if (ev.allDay) return 'All day';
  return `${formatTime(ev.start)} – ${formatTime(ev.end)}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Event color palette (maps Google Calendar colorId or hash-based)
const EVENT_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
];

function eventColor(ev) {
  if (ev.color) return EVENT_COLORS[(parseInt(ev.color) - 1) % EVENT_COLORS.length];
  // Hash the title for consistent coloring
  let hash = 0;
  for (let i = 0; i < (ev.title || '').length; i++) {
    hash = ((hash << 5) - hash + ev.title.charCodeAt(i)) | 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

// ── Main Component ───────────────────────────────────────────────

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  // Navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month | week | day
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Fetch events for the visible range
  const fetchEvents = useCallback(async (date, viewType) => {
    setLoading(true);
    setError(null);
    setNeedsReauth(false);

    let timeMin, timeMax;
    if (viewType === 'month') {
      // Fetch full month + buffer for calendar grid edges
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      start.setDate(start.getDate() - 7);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setDate(end.getDate() + 7);
      timeMin = start.toISOString();
      timeMax = end.toISOString();
    } else if (viewType === 'week') {
      timeMin = startOfWeek(date).toISOString();
      const we = endOfWeek(date);
      we.setDate(we.getDate() + 1);
      timeMax = we.toISOString();
    } else {
      const ds = new Date(date);
      ds.setHours(0, 0, 0, 0);
      const de = new Date(date);
      de.setHours(23, 59, 59, 999);
      timeMin = ds.toISOString();
      timeMax = de.toISOString();
    }

    try {
      const params = new URLSearchParams({ timeMin, timeMax });
      const res = await fetch(`/api/google/calendar?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.needsReauth) setNeedsReauth(true);
        throw new Error(data.error);
      }
      setEvents(data.events || []);
      setCalendars(data.calendars || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(currentDate, view);
  }, [currentDate, view, fetchEvents]);

  // ── Navigation handlers ──

  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const ws = startOfWeek(currentDate);
      const we = endOfWeek(currentDate);
      const fmt = { month: 'short', day: 'numeric' };
      return `${ws.toLocaleDateString('en-US', fmt)} – ${we.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, [currentDate, view]);

  // Events grouped by date string
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const d = new Date(ev.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  function eventsForDay(date) {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return eventsByDate[key] || [];
  }

  // Click a day in month view → switch to day view
  const clickDay = (date) => {
    setCurrentDate(date);
    setView('day');
  };

  // ── Render ──

  return (
    <AppShell>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarIcon size={24} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Calendar</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {['month', 'week', 'day'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: view === v ? 600 : 400,
                    background: view === v ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: view === v ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    minHeight: 'unset',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Nav buttons */}
            <button onClick={goToday} style={btnStyle}>Today</button>
            <button onClick={goPrev} style={btnIconStyle}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 15, fontWeight: 600, minWidth: 180, textAlign: 'center' }}>{headerLabel}</span>
            <button onClick={goNext} style={btnIconStyle}><ChevronRight size={16} /></button>

            <button
              onClick={() => fetchEvents(currentDate, view)}
              disabled={loading}
              title="Refresh"
              style={btnIconStyle}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Error / Reauth banner */}
        {error && (
          <div style={{
            background: needsReauth ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${needsReauth ? 'var(--warning)' : 'var(--danger)'}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: needsReauth ? 'var(--warning)' : 'var(--danger)',
          }}>
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{error}</span>
            {needsReauth && (
              <a href="/api/google/connect" style={{
                padding: '6px 14px',
                borderRadius: 6,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}>
                Re-connect Google
              </a>
            )}
          </div>
        )}

        {/* Calendar body */}
        {view === 'month' && <MonthView currentDate={currentDate} eventsForDay={eventsForDay} clickDay={clickDay} onEventClick={setSelectedEvent} />}
        {view === 'week' && <WeekView currentDate={currentDate} eventsForDay={eventsForDay} onEventClick={setSelectedEvent} />}
        {view === 'day' && <DayView currentDate={currentDate} events={eventsForDay(currentDate)} onEventClick={setSelectedEvent} />}

        {/* Event detail modal */}
        {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AppShell>
  );
}

// ── Shared button styles ──

const btnStyle = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  minHeight: 'unset',
};

const btnIconStyle = {
  ...btnStyle,
  padding: '6px 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ── MONTH VIEW ───────────────────────────────────────────────────

function MonthView({ currentDate, eventsForDay, clickDay, onEventClick }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date();

  // Build 6-row grid (42 cells)
  const cells = [];
  const prevMonth = new Date(year, month, 0);
  const prevDays = prevMonth.getDate();

  // Previous month's trailing days
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevDays - i));
  }
  // This month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  // Next month fill
  while (cells.length < 42) {
    cells.push(new Date(year, month + 1, cells.length - firstDow - daysInMonth + 1));
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            background: 'var(--bg-secondary)',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((date, i) => {
          const isThisMonth = date.getMonth() === month;
          const isToday = isSameDay(date, today);
          const dayEvents = eventsForDay(date);

          return (
            <div
              key={i}
              onClick={() => clickDay(date)}
              style={{
                minHeight: 90,
                padding: 4,
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: i < 35 ? '1px solid var(--border)' : 'none',
                background: isToday ? 'var(--accent-muted)' : 'var(--bg-primary)',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'var(--bg-primary)'; }}
            >
              {/* Day number */}
              <div style={{
                fontSize: 12,
                fontWeight: isToday ? 700 : 400,
                color: !isThisMonth ? 'var(--text-muted)' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                padding: '2px 4px',
                marginBottom: 2,
              }}>
                {isToday ? (
                  <span style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {date.getDate()}
                  </span>
                ) : date.getDate()}
              </div>

              {/* Events (max 3, then "+N more") */}
              {dayEvents.slice(0, 3).map(ev => (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  style={{
                    fontSize: 11,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: eventColor(ev),
                    color: '#fff',
                    marginBottom: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer',
                    lineHeight: '16px',
                  }}
                >
                  {ev.allDay ? '' : formatTime(ev.start) + ' '}{ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 4px' }}>
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WEEK VIEW ────────────────────────────────────────────────────

function WeekView({ currentDate, eventsForDay, onEventClick }) {
  const ws = startOfWeek(currentDate);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header row with day names */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ borderRight: '1px solid var(--border)' }} />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} style={{
              padding: '8px 4px',
              textAlign: 'center',
              borderRight: i < 6 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {WEEKDAYS[d.getDay()]}
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                marginTop: 2,
              }}>
                {isToday ? (
                  <span style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 30,
                    height: 30,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {d.getDate()}
                  </span>
                ) : d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        {HOURS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: 48 }}>
            {/* Time label */}
            <div style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'right',
              padding: '2px 8px 0 0',
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              {h === 0 ? '' : h <= 12 ? `${h} ${h < 12 ? 'AM' : 'PM'}` : `${h - 12} PM`}
            </div>

            {/* Day columns */}
            {days.map((d, di) => {
              const dayEvs = eventsForDay(d).filter(ev => {
                if (ev.allDay) return h === 0;
                const eH = new Date(ev.start).getHours();
                return eH === h;
              });

              return (
                <div key={di} style={{
                  borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  padding: 1,
                  position: 'relative',
                }}>
                  {dayEvs.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      style={{
                        fontSize: 11,
                        padding: '2px 4px',
                        borderRadius: 3,
                        background: eventColor(ev),
                        color: '#fff',
                        marginBottom: 1,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '15px',
                      }}
                    >
                      {ev.allDay ? '● ' : formatTime(ev.start) + ' '}{ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DAY VIEW ─────────────────────────────────────────────────────

function DayView({ currentDate, events, onEventClick }) {
  const allDay = events.filter(e => e.allDay);
  const timed = events.filter(e => !e.allDay);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* All-day events */}
      {allDay.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>All Day</div>
          {allDay.map(ev => (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: eventColor(ev),
                color: '#fff',
                fontSize: 13,
                marginBottom: 2,
                cursor: 'pointer',
              }}
            >
              {ev.title}
            </div>
          ))}
        </div>
      )}

      {/* Hour rows */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
        {HOURS.map(h => {
          const hourEvs = timed.filter(ev => new Date(ev.start).getHours() === h);

          return (
            <div key={h} style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr',
              minHeight: 52,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'right',
                padding: '4px 10px 0 0',
                borderRight: '1px solid var(--border)',
              }}>
                {h === 0 ? '12 AM' : h <= 12 ? `${h} ${h < 12 ? 'AM' : 'PM'}` : `${h - 12} PM`}
              </div>
              <div style={{ padding: 4, position: 'relative' }}>
                {/* Current time indicator */}
                {isToday && today.getHours() === h && (
                  <div style={{
                    position: 'absolute',
                    top: `${(today.getMinutes() / 60) * 100}%`,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: 'var(--danger)',
                    zIndex: 1,
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      position: 'absolute',
                      left: -4,
                      top: -3,
                    }} />
                  </div>
                )}

                {hourEvs.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: eventColor(ev),
                      color: '#fff',
                      marginBottom: 3,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>{formatRange(ev)}</div>
                    {ev.location && (
                      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                        <MapPin size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                        {ev.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EVENT DETAIL MODAL ───────────────────────────────────────────

function EventModal({ event, onClose }) {
  const ev = event;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420,
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        zIndex: 1001,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Color bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: eventColor(ev), marginBottom: 12 }} />

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{ev.title}</h2>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <Clock size={14} />
          <span>
            {ev.allDay
              ? new Date(ev.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : `${new Date(ev.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}  ·  ${formatRange(ev)}`
            }
          </span>
        </div>

        {/* Location */}
        {ev.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <MapPin size={14} />
            <span>{ev.location}</span>
          </div>
        )}

        {/* Video call */}
        {ev.hangoutLink && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
            <Video size={14} style={{ color: 'var(--info)' }} />
            <a href={ev.hangoutLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
              Join video call
            </a>
          </div>
        )}

        {/* Attendees */}
        {ev.attendees?.length > 0 && (
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <Users size={12} />
              Attendees
            </div>
            {ev.attendees.map((a, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: a.status === 'accepted' ? 'var(--success)' : a.status === 'declined' ? 'var(--danger)' : 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                {a.name || a.email}
                {a.self && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(you)</span>}
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {ev.description && (
          <div style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-tertiary)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {ev.description}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {ev.htmlLink && (
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
              Open in Google Calendar
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

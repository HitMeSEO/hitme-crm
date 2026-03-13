'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { SERVICE_KEYS, STATUS_COLORS, WIKI_SECTIONS, TASK_STATUS_COLORS, TASK_STATUSES, TASK_PRIORITIES, PRIORITY_COLORS, CONTENT_TYPE_COLORS, CONTENT_TYPES, CONTENT_STATUS_COLORS, CONTENT_STATUSES, ACTIVITY_TYPES } from '@/lib/constants';
import { ArrowLeft, ExternalLink, Globe, Phone, Mail, MapPin, Trash2, Plus } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'content', label: 'Content' },
  { key: 'notes', label: 'Notes' },
  { key: 'wiki', label: 'Wiki' },
  { key: 'services', label: 'Services' },
  { key: 'locations', label: 'Locations' },
  { key: 'contacts', label: 'Contacts' },
];

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState('overview');
  const [locations, setLocations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [wikiLinks, setWikiLinks] = useState([]);
  const [looker, setLooker] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false });
    setTasks(data || []);
  };

  const refreshContent = async () => {
    const { data } = await supabase.from('content_queue').select('*').eq('client_id', id).order('created_at', { ascending: false });
    setContent(data || []);
  };

  const refreshActivities = async () => {
    const { data } = await supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false });
    setActivities(data || []);
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (error) {
      console.error('Delete failed:', error);
      return;
    }
    router.push('/clients');
  };

  useEffect(() => {
    async function load() {
      const [
        { data: c },
        { data: locs },
        { data: conts },
        { data: wiki },
        { data: lk },
        { data: t },
        { data: acts },
        { data: cont },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('locations').select('*').eq('client_id', id).order('location_name'),
        supabase.from('contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
        supabase.from('wiki_links').select('*').eq('client_id', id).order('section').order('sort_order'),
        supabase.from('looker_links').select('*').eq('client_id', id).limit(1),
        supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('content_queue').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ]);
      setClient(c);
      setLocations(locs || []);
      setContacts(conts || []);
      setWikiLinks(wiki || []);
      setLooker(lk?.[0] || null);
      setTasks(t || []);
      setActivities(acts || []);
      setContent(cont || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <AppShell><div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div></AppShell>;
  }

  if (!client) {
    return <AppShell><div style={{ color: 'var(--danger)', padding: 40 }}>Client not found</div></AppShell>;
  }

  const tabCounts = {
    tasks: tasks.length,
    content: content.length,
    notes: activities.length,
    wiki: wikiLinks.length,
    services: SERVICE_KEYS.filter(s => client[s.key]).length,
    locations: locations.length,
    contacts: contacts.length,
  };

  return (
    <AppShell>
      {/* Back + Header */}
      <button
        onClick={() => router.push('/clients')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0,
        }}
      >
        <ArrowLeft size={14} /> Back to Clients
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {client.company_name}
        </h1>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
          background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
          color: STATUS_COLORS[client.status] || '#64748b',
        }}>
          {client.status}
        </span>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
            border: '1px solid var(--danger)', cursor: 'pointer',
          }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Delete client?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete {client.company_name}? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => !deleting && setShowDeleteConfirm(false)} style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleDeleteClient} disabled={deleting} style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: 'var(--danger)', color: 'white', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
              }}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick links row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {client.website && (
          <a href={client.website} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)',
          }}>
            <Globe size={12} /> Website
          </a>
        )}
        {looker && (
          <a href={looker.url} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)',
          }}>
            📊 Looker
          </a>
        )}
        {client.phone && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
          }}>
            <Phone size={12} /> {client.phone}
          </span>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
        marginBottom: 24, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
            {tabCounts[t.key] !== undefined && (
              <span style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                background: 'var(--bg-tertiary)', padding: '1px 6px',
                borderRadius: 4, color: 'var(--text-muted)',
              }}>
                {tabCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab client={client} locations={locations} contacts={contacts} looker={looker} />}
      {tab === 'locations' && <LocationsTab locations={locations} />}
      {tab === 'contacts' && <ContactsTab contacts={contacts} />}
      {tab === 'wiki' && <WikiTab wikiLinks={wikiLinks} />}
      {tab === 'services' && <ServicesTab client={client} />}
      {tab === 'tasks' && <TasksTab tasks={tasks} clientId={id} refreshTasks={refreshTasks} />}
      {tab === 'content' && <ContentTab content={content} clientId={id} refreshContent={refreshContent} />}
      {tab === 'notes' && <NotesTab activities={activities} clientId={id} refreshActivities={refreshActivities} />}
    </AppShell>
  );
}

/* ============================================================
   TAB COMPONENTS
   ============================================================ */

function OverviewTab({ client, locations, contacts, looker }) {
  const primaryContact = contacts.find(c => c.is_primary);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
      </div>
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

function LocationsTab({ locations }) {
  if (locations.length === 0) {
    return <Empty msg="No locations added yet" />;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
      {locations.map(loc => {
        const isOverdue = loc.post_status && loc.post_status.toLowerCase().includes('overdue');
        const neverPosted = loc.post_status && loc.post_status.toLowerCase().includes('never');
        return (
          <div key={loc.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{loc.location_name}</div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: loc.gbp_status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: loc.gbp_status === 'ACTIVE' ? '#10b981' : '#f59e0b',
              }}>
                {loc.gbp_status}
              </span>
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
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: isOverdue ? 'rgba(239,68,68,0.1)' : neverPosted ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              color: isOverdue ? '#ef4444' : neverPosted ? '#f59e0b' : '#10b981',
              display: 'inline-block',
            }}>
              Last post: {loc.post_status || 'Unknown'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactsTab({ contacts }) {
  if (contacts.length === 0) return <Empty msg="No contacts added yet" />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {contacts.map(c => (
        <div key={c.id} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {c.first_name} {c.last_name}
            </div>
            {c.is_primary && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(99,102,241,0.15)', color: '#6366f1',
              }}>PRIMARY</span>
            )}
          </div>
          {c.title && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.title}</div>}
          {c.email && <div style={{ fontSize: 12, color: 'var(--accent)' }}>{c.email}</div>}
          {c.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.phone}</div>}
        </div>
      ))}
    </div>
  );
}

function WikiTab({ wikiLinks }) {
  if (wikiLinks.length === 0) return <Empty msg="No wiki links added yet" />;
  const grouped = {};
  wikiLinks.forEach(w => {
    if (!grouped[w.section]) grouped[w.section] = [];
    grouped[w.section].push(w);
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(grouped).map(([section, links]) => {
        const config = WIKI_SECTIONS[section] || { label: section, color: '#64748b', icon: '📄' };
        return (
          <div key={section} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: config.color, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {config.icon} {config.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-tertiary)', textDecoration: 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{link.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{link.link_type}</span>
                  <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServicesTab({ client }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {SERVICE_KEYS.map(s => {
        const active = client[s.key];
        return (
          <div key={s.key} style={{
            background: 'var(--bg-card)', border: `1px solid ${active ? s.color + '44' : 'var(--border)'}`,
            borderRadius: 10, padding: 16, opacity: active ? 1 : 0.4,
            transition: 'all 0.15s ease',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: active ? s.color : 'var(--text-muted)' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {active ? 'Active' : 'Not subscribed'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TasksTab({ tasks, clientId, refreshTasks }) {
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('team_members').select('*').eq('is_active', true).order('first_name');
      setTeamMembers(data || []);
    }
    load();
  }, []);

  const cycleStatus = async (task) => {
    const order = ['Not Started', 'In Progress', 'Done'];
    const idx = order.indexOf(task.status);
    const next = idx >= 0 && idx < 2 ? order[idx + 1] : 'Not Started';
    const updates = { status: next };
    if (next === 'Done') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
    if (!error) refreshTasks();
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('tasks').insert({
      client_id: clientId,
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    if (!error) {
      setForm({ title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '' });
      setShowAddForm(false);
      refreshTasks();
    }
  };

  const getMemberName = (id) => {
    if (!id) return '—';
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveTask} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} placeholder="Task title" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Optional description" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save Task'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {tasks.length === 0 && !showAddForm ? (
        <Empty msg="No tasks yet. Add one to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(task => (
            <div key={task.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                {task.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{task.description}</div>}
              </div>
              <button onClick={() => cycleStatus(task)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                background: `${TASK_STATUS_COLORS[task.status] || '#64748b'}18`, color: TASK_STATUS_COLORS[task.status] || '#64748b',
              }}>{task.status}</button>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: `${PRIORITY_COLORS[task.priority] || '#64748b'}18`, color: PRIORITY_COLORS[task.priority] || '#64748b',
              }}>{task.priority}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getMemberName(task.assigned_to)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentTab({ content, clientId, refreshContent }) {
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    title: '', content_type: 'Blog Post', status: 'Not Started', due_date: '', assigned_to: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('team_members').select('*').eq('is_active', true).order('first_name');
      setTeamMembers(data || []);
    }
    load();
  }, []);

  const cycleStatus = async (item) => {
    const order = ['Not Started', 'In Progress', 'Review', 'Approved', 'Published'];
    const idx = order.indexOf(item.status);
    const next = idx >= 0 && idx < 4 ? order[idx + 1] : 'Not Started';
    const updates = { status: next };
    if (next === 'Published') updates.published_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('content_queue').update(updates).eq('id', item.id);
    if (!error) refreshContent();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('content_queue').insert({
      client_id: clientId,
      title: form.title.trim(),
      content_type: form.content_type,
      status: form.status,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (!error) {
      setForm({ title: '', content_type: 'Blog Post', status: 'Not Started', due_date: '', assigned_to: '', notes: '' });
      setShowAddForm(false);
      refreshContent();
    }
  };

  const getMemberName = (id) => {
    if (!id) return '—';
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{content.length} content item{content.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Content
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} placeholder="Content title" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Content Type</label>
              <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Optional notes" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {content.length === 0 && !showAddForm ? (
        <Empty msg="No content yet. Add one to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content.map(item => (
            <div key={item.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                {item.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{item.notes}</div>}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: `${CONTENT_TYPE_COLORS[item.content_type] || '#64748b'}18`, color: CONTENT_TYPE_COLORS[item.content_type] || '#64748b',
              }}>{item.content_type}</span>
              <button onClick={() => cycleStatus(item)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                background: `${CONTENT_STATUS_COLORS[item.status] || '#64748b'}18`, color: CONTENT_STATUS_COLORS[item.status] || '#64748b',
              }}>{item.status}</button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getMemberName(item.assigned_to)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab({ activities, clientId, refreshActivities }) {
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'Note', content: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('activities').insert({
      client_id: clientId,
      activity_type: form.activity_type,
      content: form.content.trim(),
    });
    setSaving(false);
    if (!error) {
      setForm({ activity_type: 'Note', content: '' });
      setShowAddForm(false);
      refreshActivities();
    }
  };

  const getActivityBadge = (type) => ACTIVITY_TYPES.find(a => a.value === type)?.badge || '📌';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Note
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Type</label>
              <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}>
                {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.badge} {a.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Content *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={4}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} placeholder="Note content..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {activities.length === 0 && !showAddForm ? (
        <Empty msg="No activity yet. Add a note to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map(act => (
            <div key={act.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{
                fontSize: 14, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', flexShrink: 0,
              }}>{getActivityBadge(act.activity_type)} {act.activity_type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{act.content}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {new Date(act.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ name, count }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 40, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {count} {name.toLowerCase()} records
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Full {name.toLowerCase()} management coming in Phase 2B
      </div>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
    }}>
      {msg}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { SERVICE_KEYS, STATUS_COLORS, WIKI_SECTIONS } from '@/lib/constants';
import { ArrowLeft, ExternalLink, Globe, Phone, Mail, MapPin } from 'lucide-react';

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
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
      </div>

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
      {tab === 'tasks' && <PlaceholderTab name="Tasks" count={tasks.length} />}
      {tab === 'content' && <PlaceholderTab name="Content" count={content.length} />}
      {tab === 'notes' && <PlaceholderTab name="Notes" count={activities.length} />}
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { SERVICE_KEYS, STATUS_COLORS, STATUS_LABELS, CLIENT_STATUSES } from '@/lib/constants';
import { ArrowLeft, Pencil, Trash2, X, Save } from 'lucide-react';
import GbpHealthTab from './GbpHealthTab';
import OverviewTab from './OverviewTab';
import FolderLinksRow from './FolderLinksRow';
import LocationsTab from './LocationsTab';
import ContactsTab from './ContactsTab';
import WikiTab from './WikiTab';
import ServicesTab from './ServicesTab';
import TasksTab from './TasksTab';
import ContentTab from './ContentTab';
import NotesTab from './NotesTab';
import OnboardingTab from './OnboardingTab';
import SeoAuditTab from './SeoAuditTab';
import ImagesTab from './ImagesTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'content', label: 'Content' },
  { key: 'notes', label: 'Notes' },
  { key: 'services', label: 'Services' },
  { key: 'locations', label: 'Locations' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'gbp_health', label: 'GBP Health' },
  { key: 'images', label: 'Images' },
  { key: 'seo_audit', label: 'SEO Audit' },
  { key: 'wiki', label: 'Wiki' },
  { key: 'onboarding', label: 'Onboarding' },
];

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [client, setClient] = useState(null);
  const initialTab = searchParams.get('tab') || 'overview';
  const [tab, setTab] = useState(initialTab);
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [gbpRefreshing, setGbpRefreshing] = useState(false);
  const [gbpRefreshMsg, setGbpRefreshMsg] = useState('');
  const [clientSettings, setClientSettings] = useState(null);
  const [onboardingForm, setOnboardingForm] = useState(null);
  const [sendingOnboard, setSendingOnboard] = useState(false);
  const [onboardUrl, setOnboardUrl] = useState('');
  const [onboardCopied, setOnboardCopied] = useState(false);
  const [showOnboardPanel, setShowOnboardPanel] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [showOnboardPrompt, setShowOnboardPrompt] = useState(false);

  const refreshOnboarding = async () => {
    const { data: obForm } = await supabase.from('onboarding_forms').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setOnboardingForm(obForm || null);
  };

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

  const refreshWikiLinks = async () => {
    const { data } = await supabase.from('wiki_links').select('*').eq('client_id', id).order('section').order('sort_order');
    setWikiLinks(data || []);
  };

  const refreshContacts = async () => {
    const { data } = await supabase.from('contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false });
    setContacts(data || []);
  };

  const refreshClient = async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClient(data);
  };

  const handleRefreshGbp = async () => {
    const query = [client.company_name, client.address_city].filter(Boolean).join(' ');
    if (!query) return;
    setGbpRefreshing(true);
    setGbpRefreshMsg('');
    try {
      const res = await fetch(`/api/places/lookup?q=${encodeURIComponent(query)}`);
      const places = await res.json();
      if (!res.ok || !Array.isArray(places) || !places.length) {
        setGbpRefreshMsg('No GBP match found. Try editing the company name or city.');
        setGbpRefreshing(false);
        return;
      }
      const place = places[0];
      const categories = [
        place.primaryTypeDisplayName?.text,
        ...(place.types || []).slice(0, 3).map(t => t.replace(/_/g, ' ')),
      ].filter(Boolean).slice(0, 3).join(', ');
      const payload = {
        gbp_place_id: place.id || null,
        gbp_rating: place.rating || null,
        gbp_review_count: place.userRatingCount || null,
        gbp_categories: categories || null,
        gbp_hours: place.regularOpeningHours || null,
        gbp_maps_url: place.googleMapsUri || null,
        gbp_editorial_summary: place.editorialSummary?.text || null,
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', id);
      if (error) throw error;
      setClient(prev => ({ ...prev, ...payload }));
      setGbpRefreshMsg(`✓ Updated from GBP — ${place.displayName?.text || client.company_name}`);
    } catch (e) {
      setGbpRefreshMsg(`Error: ${e.message}`);
    }
    setGbpRefreshing(false);
    setTimeout(() => setGbpRefreshMsg(''), 5000);
  };

  const handleStatusChange = async (newStatus) => {
    setStatusDropdownOpen(false);
    if (newStatus === client.status) return;
    await supabase.from('clients').update({ status: newStatus }).eq('id', id);
    setClient(prev => ({ ...prev, status: newStatus }));
    if (newStatus === 'client') {
      setShowOnboardPrompt(true);
    }
  };

  const handleSendOnboard = async () => {
    setSendingOnboard(true);
    const { data: existing } = await supabase
      .from('onboarding_forms')
      .select('*')
      .eq('client_id', id)
      .neq('status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let form = existing;
    if (!form) {
      const { data: created } = await supabase
        .from('onboarding_forms')
        .insert({ client_id: id, status: 'sent' })
        .select()
        .single();
      form = created;
    }
    setSendingOnboard(false);
    if (!form) return;
    const url = `${window.location.origin}/onboard/${form.token}`;
    setOnboardUrl(url);
    setOnboardingForm(form);
    setShowOnboardPanel(true);
    try { await navigator.clipboard.writeText(url); setOnboardCopied(true); setTimeout(() => setOnboardCopied(false), 3000); } catch {}
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (error) { console.error('Delete failed:', error); return; }
    router.push('/clients');
  };

  const openEditModal = () => {
    setEditForm({
      company_name: client.company_name || '',
      website: client.website || '',
      phone: client.phone || '',
      email: client.email || '',
      address_street: client.address_street || '',
      address_city: client.address_city || '',
      address_state: client.address_state || '',
      address_zip: client.address_zip || '',
      status: CLIENT_STATUSES.includes(client.status) ? client.status : 'client',
      notes: client.notes || '',
      service_seo: client.service_seo || false,
      service_gbp: client.service_gbp || false,
      service_ads: client.service_ads || false,
      service_social: client.service_social || false,
      service_crm: client.service_crm || false,
      drive_folder: client.drive_folder || '',
      image_folder: client.image_folder || '',
      content_folder: client.content_folder || '',
      dropbox_folder: client.dropbox_folder || '',
      industry_type: clientSettings?.industry_type || '',
      business_services: (clientSettings?.business_services || []).join(', '),
      wordpress_url: clientSettings?.wordpress_url || '',
      wordpress_api_key: clientSettings?.wordpress_api_key || '',
      ga4_property_id: client.ga4_property_id || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editForm.company_name.trim()) { setEditError('Company name is required.'); return; }
    setEditSaving(true);
    setEditError('');
    const payload = {
      company_name: editForm.company_name.trim(),
      website: editForm.website.trim() || null,
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      address_street: editForm.address_street.trim() || null,
      address_city: editForm.address_city.trim() || null,
      address_state: editForm.address_state.trim() || null,
      address_zip: editForm.address_zip.trim() || null,
      status: editForm.status,
      notes: editForm.notes.trim() || null,
      service_seo: editForm.service_seo,
      service_gbp: editForm.service_gbp,
      service_ads: editForm.service_ads,
      service_social: editForm.service_social,
      service_crm: editForm.service_crm,
      drive_folder: editForm.drive_folder.trim() || '',
      image_folder: editForm.image_folder.trim() || '',
      content_folder: editForm.content_folder.trim() || '',
      dropbox_folder: editForm.dropbox_folder.trim() || '',
      ga4_property_id: editForm.ga4_property_id?.trim() || null,
    };
    const { error } = await supabase.from('clients').update(payload).eq('id', id);
    if (error) { setEditSaving(false); setEditError(error.message); return; }

    const servicesArray = editForm.business_services
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const settingsPayload = {
      client_id: id,
      industry_type: editForm.industry_type || null,
      business_services: servicesArray.length > 0 ? servicesArray : null,
      wordpress_url: editForm.wordpress_url?.trim() || null,
      wordpress_api_key: editForm.wordpress_api_key?.trim() || null,
    };
    const { error: settingsError } = await supabase
      .from('client_settings')
      .upsert(settingsPayload, { onConflict: 'client_id' });

    setEditSaving(false);
    if (settingsError) { setEditError(settingsError.message); return; }

    setClient(prev => ({ ...prev, ...payload }));
    setClientSettings(prev => ({ ...(prev || {}), ...settingsPayload }));
    setShowEditModal(false);
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
        { data: settings },
        { data: obForm },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('locations').select('*').eq('client_id', id).order('location_name'),
        supabase.from('contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
        supabase.from('wiki_links').select('*').eq('client_id', id).order('section').order('sort_order'),
        supabase.from('looker_links').select('*').eq('client_id', id).limit(1),
        supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('content_queue').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('client_settings').select('*').eq('client_id', id).maybeSingle(),
        supabase.from('onboarding_forms').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setClient(c);
      setClientSettings(settings || null);
      setOnboardingForm(obForm || null);
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

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 };
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', width: '100%' }}>
          {client.company_name}
        </h1>
        {/* Clickable status badge with dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setStatusDropdownOpen(o => !o)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
              color: STATUS_COLORS[client.status] || '#64748b',
              border: `1px solid ${STATUS_COLORS[client.status] || '#64748b'}40`,
              display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize',
            }}
          >
            {STATUS_LABELS[client.status] || client.status}
            <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
          </button>
          {statusDropdownOpen && (
            <>
              <div onClick={() => setStatusDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', top: '110%', left: 0, zIndex: 100,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: 150, overflow: 'hidden',
              }}>
                {CLIENT_STATUSES.map(s => {
                  const color = STATUS_COLORS[s] || '#64748b';
                  const active = client.status === s;
                  return (
                    <button key={s} onClick={() => handleStatusChange(s)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 14px', border: 'none',
                      background: active ? `${color}12` : 'transparent',
                      cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? color : 'var(--text-primary)', textAlign: 'left',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {STATUS_LABELS[s]}
                      {active && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button
          onClick={openEditModal}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'var(--accent-muted)', color: 'var(--accent)',
            border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
          }}
        >
          <Pencil size={14} /> Edit
        </button>
        <button
          onClick={handleRefreshGbp}
          disabled={gbpRefreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.3)',
            cursor: gbpRefreshing ? 'not-allowed' : 'pointer',
            opacity: gbpRefreshing ? 0.7 : 1,
          }}
        >
          {gbpRefreshing ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Refreshing GBP...
            </>
          ) : (
            <>📍 Refresh GBP</>
          )}
        </button>
        <button
          onClick={handleSendOnboard}
          disabled={sendingOnboard}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.35)',
            cursor: sendingOnboard ? 'not-allowed' : 'pointer',
            opacity: sendingOnboard ? 0.7 : 1,
          }}
        >
          📋 {onboardingForm?.status === 'submitted' ? 'Onboarding Submitted' : onboardingForm?.status === 'in_progress' ? 'In Progress' : onboardingForm?.status === 'sent' ? 'Resend Form' : 'Send Onboarding Form'}
        </button>
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
      {gbpRefreshMsg && (
        <div style={{
          fontSize: 12, padding: '6px 12px', borderRadius: 6, marginBottom: 4, display: 'inline-block',
          background: gbpRefreshMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: gbpRefreshMsg.startsWith('✓') ? '#10b981' : 'var(--danger)',
          border: `1px solid ${gbpRefreshMsg.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {gbpRefreshMsg}
        </div>
      )}

      {showOnboardPanel && onboardUrl && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>📋 Onboarding Form Link</div>
            <div style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{onboardUrl}</div>
          </div>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(onboardUrl); setOnboardCopied(true); setTimeout(() => setOnboardCopied(false), 2500); } catch {} }}
            style={{
              padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: onboardCopied ? 'rgba(16,185,129,0.15)' : 'var(--accent-muted)',
              color: onboardCopied ? '#10b981' : 'var(--accent)',
              border: `1px solid ${onboardCopied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {onboardCopied ? '✓ Copied!' : 'Copy Link'}
          </button>
          <button onClick={() => setShowOnboardPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {showOnboardPrompt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowOnboardPrompt(false)}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 28, maxWidth: 420, width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {client.company_name} is now a Client!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Would you like to send them an onboarding form to collect their business info, account access, and goals?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowOnboardPrompt(false)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Not Yet
              </button>
              <button
                onClick={() => { setShowOnboardPrompt(false); handleSendOnboard(); }}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#f59e0b', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                📋 Send Onboarding Form
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit Client Modal */}
      {showEditModal && (
        <div
          className="crm-modal-wrap"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={() => !editSaving && setShowEditModal(false)}
        >
          <div
            className="crm-modal-inner"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Client</h2>
              <button onClick={() => !editSaving && setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditClient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Company Name */}
              <div>
                <label style={labelStyle}>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" value={editForm.company_name} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Acme Corp" required style={inputStyle} />
              </div>
              {/* Website + Phone */}
              <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input type="text" value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" style={inputStyle} />
                </div>
              </div>
              {/* Email */}
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@example.com" style={inputStyle} />
              </div>
              {/* Address */}
              <div>
                <label style={labelStyle}>Street Address</label>
                <input type="text" value={editForm.address_street} onChange={e => setEditForm(f => ({ ...f, address_street: e.target.value }))} placeholder="123 Main St" style={inputStyle} />
              </div>
              <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input type="text" value={editForm.address_city} onChange={e => setEditForm(f => ({ ...f, address_city: e.target.value }))} placeholder="Washington" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input type="text" value={editForm.address_state} onChange={e => setEditForm(f => ({ ...f, address_state: e.target.value }))} placeholder="DC" maxLength={2} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP</label>
                  <input type="text" value={editForm.address_zip} onChange={e => setEditForm(f => ({ ...f, address_zip: e.target.value }))} placeholder="20001" style={inputStyle} />
                </div>
              </div>
              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  {CLIENT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              {/* Services */}
              <div>
                <label style={labelStyle}>Services</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {SERVICE_KEYS.map(s => (
                    <button
                      key={s.key} type="button"
                      onClick={() => setEditForm(f => ({ ...f, [s.key]: !f[s.key] }))}
                      style={{
                        padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${editForm[s.key] ? s.color : 'var(--border)'}`,
                        background: editForm[s.key] ? `${s.color}20` : 'var(--bg-tertiary)',
                        color: editForm[s.key] ? s.color : 'var(--text-muted)',
                      }}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Content Research Settings */}
              <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Primary Category</label>
                  <select value={editForm.industry_type} onChange={e => setEditForm(f => ({ ...f, industry_type: e.target.value }))} style={inputStyle}>
                    <option value="">— Select industry —</option>
                    <option value="junk_hauling">Junk Hauling</option>
                    <option value="dumpster_rental">Dumpster Rental</option>
                    <option value="septic_service">Septic Service</option>
                    <option value="tree_service">Tree Service</option>
                    <option value="fencing">Fencing</option>
                    <option value="attorney">Attorney</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Services / Keywords</label>
                  <input
                    type="text"
                    value={editForm.business_services}
                    onChange={e => setEditForm(f => ({ ...f, business_services: e.target.value }))}
                    placeholder="Junk Removal, Demolition, Hauling"
                    style={inputStyle}
                  />
                </div>
              </div>
              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this client..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              {/* Folder Links */}
              <div>
                <label style={labelStyle}>Folder Links</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {[
                    { key: 'drive_folder', label: '📂 Google Drive', placeholder: 'https://drive.google.com/...' },
                    { key: 'image_folder', label: '🖼️ Image Folder', placeholder: 'https://drive.google.com/...' },
                    { key: 'content_folder', label: '✍️ Content Folder', placeholder: 'https://drive.google.com/...' },
                    { key: 'dropbox_folder', label: '📦 Dropbox', placeholder: 'https://www.dropbox.com/...' },
                  ].map(f => (
                    <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{f.label}</span>
                      <input
                        type="text"
                        value={editForm[f.key]}
                        onChange={e => setEditForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* WordPress Integration */}
              <div>
                <label style={labelStyle}>WordPress Integration</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>🌐 Site URL</span>
                    <input
                      type="text"
                      value={editForm.wordpress_url}
                      onChange={e => setEditForm(fm => ({ ...fm, wordpress_url: e.target.value }))}
                      placeholder="https://clientsite.com"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>🔑 App Password</span>
                    <input
                      type="password"
                      value={editForm.wordpress_api_key}
                      onChange={e => setEditForm(fm => ({ ...fm, wordpress_api_key: e.target.value }))}
                      placeholder="username:xxxx xxxx xxxx xxxx"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Format: username:application-password (WordPress → Users → Application Passwords)
                  </div>
                </div>
              </div>

              {/* Google Analytics */}
              <div>
                <label style={labelStyle}>📊 GA4 Analytics</label>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Property ID</span>
                  <input
                    value={editForm.ga4_property_id}
                    onChange={e => setEditForm(fm => ({ ...fm, ga4_property_id: e.target.value }))}
                    placeholder="123456789"
                    style={inputStyle}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  GA4 Property ID (Admin → Property Settings → Property ID). Just the number, no prefix needed.
                </div>
              </div>
              {editError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {editError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => !editSaving && setShowEditModal(false)} style={{
                  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--accent)', color: 'white', border: 'none', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1,
                }}><Save size={14} />{editSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick links row */}
      <FolderLinksRow client={client} setClient={setClient} clientId={id} looker={looker} supabase={supabase} />

      {/* Tab Bar */}
      <div className="crm-tab-bar" style={{
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
      {tab === 'overview' && <OverviewTab client={client} locations={locations} contacts={contacts} looker={looker} tasks={tasks} content={content} setTab={setTab} onClientUpdate={setClient} />}
      {tab === 'locations' && <LocationsTab locations={locations} setLocations={setLocations} clientId={id} setTab={setTab} refreshContent={refreshContent} clientSettings={clientSettings} />}
      {tab === 'contacts' && <ContactsTab contacts={contacts} clientId={id} refreshContacts={refreshContacts} />}
      {tab === 'wiki' && <WikiTab wikiLinks={wikiLinks} clientId={id} refreshWikiLinks={refreshWikiLinks} />}
      {tab === 'services' && <ServicesTab client={client} setClient={setClient} clientId={id} />}
      {tab === 'tasks' && <TasksTab tasks={tasks} clientId={id} refreshTasks={refreshTasks} />}
      {tab === 'content' && <ContentTab content={content} client={client} clientId={id} refreshContent={refreshContent} setClient={setClient} clientSettings={clientSettings} />}
      {tab === 'notes' && <NotesTab activities={activities} clientId={id} refreshActivities={refreshActivities} />}
      {tab === 'gbp_health' && <GbpHealthTab client={client} setClient={setClient} clientId={id} />}
      {tab === 'images' && <ImagesTab clientId={id} />}
      {tab === 'seo_audit' && <SeoAuditTab clientId={id} client={client} setClient={setClient} />}
      {tab === 'onboarding' && <OnboardingTab onboardingForm={onboardingForm} clientId={id} onSendForm={handleSendOnboard} sendingOnboard={sendingOnboard} onboardUrl={onboardUrl} onboardCopied={onboardCopied} setOnboardCopied={setOnboardCopied} setOnboardUrl={setOnboardUrl} setShowOnboardPanel={setShowOnboardPanel} refreshOnboarding={refreshOnboarding} />}
    </AppShell>
  );
}

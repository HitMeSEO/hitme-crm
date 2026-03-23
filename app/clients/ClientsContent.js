'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import { SERVICE_KEYS, STATUS_COLORS, STATUS_LABELS, CLIENT_STATUSES } from '@/lib/constants';
import { Search, ExternalLink, Plus, X, MapPin } from 'lucide-react';

const EMPTY_FORM = {
  company_name: '',
  website: '',
  phone: '',
  email: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  status: 'lead',
  service_seo: false,
  service_gbp: false,
  service_ads: false,
  service_social: false,
  service_crm: false,
  gbp_place_id: '',
  gbp_rating: null,
  gbp_review_count: null,
  gbp_categories: '',
  gbp_hours: null,
  gbp_maps_url: '',
  gbp_reviews: null,
  gbp_editorial_summary: '',
  gbp_service_areas: null,
};

export default function ClientsContent() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // GBP search state
  const [gbpQuery, setGbpQuery] = useState('');
  const [gbpSearching, setGbpSearching] = useState(false);
  const [gbpResults, setGbpResults] = useState([]);
  const [gbpError, setGbpError] = useState('');

  const searchParams = useSearchParams();
  const serviceFilter = searchParams.get('service') || 'all';
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clients').select('*').order('company_name');
      setClients(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleGbpSearch = async (e) => {
    e?.preventDefault();
    if (!gbpQuery.trim()) return;
    setGbpSearching(true);
    setGbpError('');
    setGbpResults([]);
    try {
      const res = await fetch(`/api/places/lookup?q=${encodeURIComponent(gbpQuery)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setGbpResults(data);
      if (data.length === 0) setGbpError('No results found. Try a different search.');
    } catch (e) {
      setGbpError(e.message);
    }
    setGbpSearching(false);
  };

  const handlePickGbp = (place) => {
    // Raw Google Places API fields from /api/places/lookup
    const addr = place.formattedAddress || '';
    const parts = addr.split(', ');
    let street = '', city = '', state = '', zip = '';
    if (parts.length >= 3) {
      street = parts[0];
      city = parts[1];
      const stateZipParts = (parts[2] || '').split(' ');
      state = stateZipParts[0] || '';
      zip = stateZipParts[1] || '';
    }

    const categories = [
      place.primaryTypeDisplayName?.text,
      ...(place.types || []).slice(0, 3).map(t => t.replace(/_/g, ' ')),
    ].filter(Boolean).slice(0, 3).join(', ');

    setAddForm(f => ({
      ...f,
      company_name: place.displayName?.text || f.company_name,
      phone: place.nationalPhoneNumber || f.phone,
      website: place.websiteUri || f.website,
      address_street: street,
      address_city: city,
      address_state: state,
      address_zip: zip,
      gbp_place_id: place.id || '',
      gbp_rating: place.rating || null,
      gbp_review_count: place.userRatingCount || null,
      gbp_categories: categories,
      gbp_hours: place.regularOpeningHours || null,
      gbp_maps_url: place.googleMapsUri || '',
      gbp_reviews: null,
      gbp_editorial_summary: place.editorialSummary?.text || '',
      gbp_service_areas: null,
    }));
    setGbpResults([]);
    setGbpQuery('');
    setGbpError('');
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!addForm.company_name.trim()) { setAddError('Company name is required.'); return; }
    setAddSaving(true);
    setAddError('');
    const payload = {
      company_name: addForm.company_name.trim(),
      website: addForm.website.trim() || null,
      phone: addForm.phone.trim() || null,
      email: addForm.email.trim() || null,
      address_street: addForm.address_street.trim() || null,
      address_city: addForm.address_city.trim() || null,
      address_state: addForm.address_state.trim() || null,
      address_zip: addForm.address_zip.trim() || null,
      status: addForm.status,
      service_seo: addForm.service_seo,
      service_gbp: addForm.service_gbp,
      service_ads: addForm.service_ads,
      service_social: addForm.service_social,
      service_crm: addForm.service_crm,
      gbp_place_id: addForm.gbp_place_id || null,
      gbp_rating: addForm.gbp_rating || null,
      gbp_review_count: addForm.gbp_review_count || null,
      gbp_categories: addForm.gbp_categories || null,
      gbp_hours: addForm.gbp_hours || null,
      gbp_maps_url: addForm.gbp_maps_url || null,
      gbp_reviews: addForm.gbp_reviews || null,
      gbp_editorial_summary: addForm.gbp_editorial_summary || null,
      gbp_service_areas: addForm.gbp_service_areas || null,
    };
    const { data, error } = await supabase.from('clients').insert(payload).select().single();
    setAddSaving(false);
    if (error) { setAddError(error.message); return; }
    setClients(prev => [...prev, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    setShowAddModal(false);
    setAddForm(EMPTY_FORM);
    router.push(`/clients/${data.id}`);
  };

  const filtered = clients.filter(c => {
    if (search && !c.company_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (serviceFilter !== 'all' && !c[serviceFilter]) return false;
    return true;
  });

  const FILTER_STAGES = ['all', ...CLIENT_STATUSES];
  // Count per status for badges
  const statusCounts = CLIENT_STATUSES.reduce((acc, s) => {
    acc[s] = clients.filter(c => c.status === s).length;
    return acc;
  }, {});

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5,
  };

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Clients
            {serviceFilter !== 'all' && (
              <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, marginLeft: 8 }}>
                — {SERVICE_KEYS.find(s => s.key === serviceFilter)?.label}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} client{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setAddForm(EMPTY_FORM); setAddError(''); setGbpQuery(''); setGbpResults([]); setGbpError(''); setShowAddModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Add Client
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', flex: '1 1 280px', maxWidth: 400,
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text" placeholder="Search clients..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTER_STAGES.map(s => {
            const active = statusFilter === s;
            const color = s === 'all' ? 'var(--accent)' : (STATUS_COLORS[s] || '#64748b');
            const count = s === 'all' ? clients.length : (statusCounts[s] || 0);
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '5px 12px', borderRadius: 6,
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? `${color}18` : 'var(--bg-card)',
                color: active ? color : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {s === 'all' ? 'All' : (STATUS_LABELS[s] || s)}
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 10,
                  background: active ? `${color}28` : 'var(--bg-tertiary)',
                  color: active ? color : 'var(--text-muted)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {serviceFilter !== 'all' && (
          <button onClick={() => router.push('/clients')} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--danger)',
            background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            ✕ Clear service filter
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading clients...</div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Status', 'Services', 'Phone', 'Location'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {client.company_name}
                      </span>
                      {client.website && (
                        <a href={client.website} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--text-muted)', display: 'flex' }}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: `${STATUS_COLORS[client.status] || '#64748b'}18`,
                      color: STATUS_COLORS[client.status] || '#64748b',
                      textTransform: 'capitalize',
                    }}>
                      {STATUS_LABELS[client.status] || client.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {SERVICE_KEYS.filter(s => client[s.key]).map(s => (
                        <span key={s.key} title={s.label} style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                          background: `${s.color}18`, color: s.color,
                        }}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {client.phone}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {[client.address_city, client.address_state].filter(Boolean).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No clients match your filters
            </div>
          )}
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={() => !addSaving && setShowAddModal(false)}
        >
          <div
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Add New Client</h2>
              <button onClick={() => !addSaving && setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* GBP Search */}
            <div style={{
              padding: 16, borderRadius: 10, marginBottom: 20,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            }}>
              <label style={{ ...labelStyle, color: '#10b981', marginBottom: 8 }}>
                📍 Search Google Business Profile
              </label>
              <form onSubmit={handleGbpSearch} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={gbpQuery}
                  onChange={e => setGbpQuery(e.target.value)}
                  placeholder="Business name + city (e.g. Hillmuth Automotive Gaithersburg)"
                  style={{ ...inputStyle, flex: 1, background: 'var(--bg-card)' }}
                />
                <button
                  type="submit"
                  disabled={gbpSearching || !gbpQuery.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: '#10b981', color: 'white', border: 'none',
                    cursor: gbpSearching || !gbpQuery.trim() ? 'not-allowed' : 'pointer',
                    opacity: gbpSearching || !gbpQuery.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {gbpSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {gbpError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{gbpError}</div>
              )}

              {gbpResults.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {gbpResults.map(place => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handlePickGbp(place)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {place.displayName?.text}
                        {place.rating && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>
                            ⭐ {place.rating} ({place.userRatingCount?.toLocaleString()})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} /> {place.formattedAddress}
                      </div>
                      {place.primaryTypeDisplayName?.text && (
                        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 500 }}>
                          {place.primaryTypeDisplayName.text}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {addForm.gbp_place_id && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✓ GBP matched — form auto-filled
                  {addForm.gbp_rating && <span style={{ color: '#f59e0b', marginLeft: 4 }}>⭐ {addForm.gbp_rating}</span>}
                </div>
              )}
            </div>

            <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Company Name */}
              <div>
                <label style={labelStyle}>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text" value={addForm.company_name}
                  onChange={e => setAddForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Acme Corp" required style={inputStyle}
                />
              </div>

              {/* Website + Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input type="text" value={addForm.website}
                    onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 000-0000" style={inputStyle} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contact@example.com" style={inputStyle} />
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Street Address</label>
                <input type="text" value={addForm.address_street}
                  onChange={e => setAddForm(f => ({ ...f, address_street: e.target.value }))}
                  placeholder="123 Main St" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input type="text" value={addForm.address_city}
                    onChange={e => setAddForm(f => ({ ...f, address_city: e.target.value }))}
                    placeholder="Washington" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input type="text" value={addForm.address_state}
                    onChange={e => setAddForm(f => ({ ...f, address_state: e.target.value }))}
                    placeholder="DC" maxLength={2} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP</label>
                  <input type="text" value={addForm.address_zip}
                    onChange={e => setAddForm(f => ({ ...f, address_zip: e.target.value }))}
                    placeholder="20001" style={inputStyle} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select value={addForm.status}
                  onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                  style={inputStyle}>
                  {CLIENT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Services */}
              <div>
                <label style={labelStyle}>Services</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SERVICE_KEYS.map(s => (
                    <button
                      key={s.key} type="button"
                      onClick={() => setAddForm(f => ({ ...f, [s.key]: !f[s.key] }))}
                      style={{
                        padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${addForm[s.key] ? s.color : 'var(--border)'}`,
                        background: addForm[s.key] ? `${s.color}20` : 'var(--bg-tertiary)',
                        color: addForm[s.key] ? s.color : 'var(--text-muted)',
                      }}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {addError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => !addSaving && setShowAddModal(false)} style={{
                  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={addSaving} style={{
                  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--accent)', color: 'white', border: 'none',
                  cursor: addSaving ? 'not-allowed' : 'pointer', opacity: addSaving ? 0.7 : 1,
                }}>{addSaving ? 'Saving...' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

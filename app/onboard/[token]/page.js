'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ACCOUNT_ROWS = [
  'Google Business Profile',
  'Google Analytics',
  'Google Search Console',
  'Google Ads',
  'WordPress CMS',
  'Hosting',
  'Domain Registrar',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'YouTube',
];

const SECTIONS = [
  'Business Info',
  'Locations',
  'Services',
  'Target Areas',
  'Competitors',
  'Ideal Customer',
  'Lead Definition',
  'Account Access',
  'Brand',
  'Anything Else',
];

const EMPTY_DATA = {
  // Business Info
  business_name: '',
  owner_name: '',
  phone: '',
  cell: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  date_opened: '',
  // Locations
  extra_locations: [{ address: '', city: '', state: '', zip: '' }],
  // Services
  top_services: '',
  // Target Areas
  target_areas: '',
  // Competitors
  competitor_1: '', competitor_1_url: '',
  competitor_2: '', competitor_2_url: '',
  competitor_3: '', competitor_3_url: '',
  // Ideal Customer
  ideal_customer: '',
  // Lead Definition
  lead_definition: '',
  // Account Access
  account_access: {},
  // Brand
  websites_like_1: '', websites_like_2: '', websites_like_3: '',
  brand_colors: '',
  brand_messaging: '',
  // Anything Else
  anything_else: '',
};

export default function OnboardingForm() {
  const { token } = useParams();
  const [form, setForm] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const saveTimer = useRef(null);
  const periodicTimer = useRef(null);
  const latestData = useRef(data);
  const lastSavedData = useRef(null);
  const isSaving = useRef(false);
  const [revealedAccounts, setRevealedAccounts] = useState({});

  // Keep latestData ref in sync
  useEffect(() => { latestData.current = data; }, [data]);

  // Core save function with error handling and retry
  const saveToDb = useCallback(async (dataToSave) => {
    if (isSaving.current) return;
    // Skip if data hasn't changed since last save
    const dataStr = JSON.stringify(dataToSave);
    if (lastSavedData.current === dataStr) return;

    isSaving.current = true;
    setSaveIndicator('saving');
    setSaveError(false);

    try {
      const { error } = await supabase.from('onboarding_forms')
        .update({ form_data: dataToSave, status: 'in_progress' })
        .eq('token', token);

      if (error) {
        console.error('Autosave failed:', error.message);
        setSaveIndicator('error');
        setSaveError(true);
        setRetryCount(prev => prev + 1);
      } else {
        lastSavedData.current = dataStr;
        setSaveIndicator('saved');
        setSaveError(false);
        setRetryCount(0);
        setTimeout(() => setSaveIndicator(''), 2500);
      }
    } catch (err) {
      console.error('Autosave exception:', err);
      setSaveIndicator('error');
      setSaveError(true);
      setRetryCount(prev => prev + 1);
    } finally {
      isSaving.current = false;
    }
  }, [token]);

  useEffect(() => {
    async function load() {
      const { data: row, error } = await supabase
        .from('onboarding_forms')
        .select('*')
        .eq('token', token)
        .single();
      if (error || !row) { setNotFound(true); setLoading(false); return; }
      if (row.status === 'submitted') { setSubmitted(true); }
      setForm(row);
      if (row.form_data && Object.keys(row.form_data).length > 0) {
        setData({ ...EMPTY_DATA, ...row.form_data });
        lastSavedData.current = JSON.stringify({ ...EMPTY_DATA, ...row.form_data });
      }
      setLoading(false);
      // Mark as in_progress if still sent
      if (row.status === 'sent') {
        await supabase.from('onboarding_forms').update({ status: 'in_progress' }).eq('token', token);
      }
    }
    load();
  }, [token]);

  // Periodic backup save every 15 seconds (catches anything the debounce might miss)
  useEffect(() => {
    periodicTimer.current = setInterval(() => {
      if (latestData.current && !isSaving.current) {
        saveToDb(latestData.current);
      }
    }, 15000);
    return () => { if (periodicTimer.current) clearInterval(periodicTimer.current); };
  }, [saveToDb]);

  // Save on tab close / navigate away
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const dataStr = JSON.stringify(latestData.current);
      if (lastSavedData.current !== dataStr) {
        // Use fetch with keepalive — supports custom headers unlike sendBeacon
        try {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/onboarding_forms?token=eq.${token}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ form_data: latestData.current, status: 'in_progress' }),
            keepalive: true,
          });
        } catch {}
        // Show browser warning
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    const handleVisibilityChange = () => {
      // Save immediately when user switches tabs or minimizes
      if (document.visibilityState === 'hidden' && latestData.current) {
        saveToDb(latestData.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, saveToDb]);

  // Retry failed saves
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      const retryTimer = setTimeout(() => {
        saveToDb(latestData.current);
      }, 2000 * retryCount); // 2s, 4s, 6s backoff
      return () => clearTimeout(retryTimer);
    }
  }, [retryCount, saveToDb]);

  const debouncedSave = useCallback((updatedData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveIndicator('saving');
    saveTimer.current = setTimeout(() => {
      saveToDb(updatedData);
    }, 800);
  }, [saveToDb]);

  const update = (field, value) => {
    const updated = { ...data, [field]: value };
    setData(updated);
    debouncedSave(updated);
  };

  const updateAccount = (platform, field, value) => {
    const updated = {
      ...data,
      account_access: {
        ...data.account_access,
        [platform]: { ...data.account_access[platform], [field]: value },
      },
    };
    setData(updated);
    debouncedSave(updated);
  };

  const updateLocation = (index, field, value) => {
    const locs = [...(data.extra_locations || [])];
    locs[index] = { ...locs[index], [field]: value };
    const updated = { ...data, extra_locations: locs };
    setData(updated);
    debouncedSave(updated);
  };

  const addLocation = () => {
    const updated = { ...data, extra_locations: [...(data.extra_locations || []), { address: '', city: '', state: '', zip: '' }] };
    setData(updated);
    debouncedSave(updated);
  };

  const removeLocation = (index) => {
    const locs = (data.extra_locations || []).filter((_, i) => i !== index);
    const updated = { ...data, extra_locations: locs };
    setData(updated);
    debouncedSave(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await supabase.from('onboarding_forms').update({
      form_data: data,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).eq('token', token);
    // Trigger server-side processing
    await fetch(`/api/onboard/${token}/submit`, { method: 'POST' });
    setSubmitting(false);
    setSubmitted(true);
    setConfirmSubmit(false);
  };

  // Calculate progress
  const filledFields = [
    data.business_name, data.owner_name, data.phone, data.email, data.website,
    data.address, data.city, data.state, data.top_services, data.target_areas,
    data.competitor_1, data.ideal_customer, data.lead_definition, data.brand_colors,
  ].filter(v => v && v.trim()).length;
  const progress = Math.round((filledFields / 14) * 100);

  const inp = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #d1d5db', background: 'white',
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
    color: '#111827', fontFamily: 'inherit',
  };
  const label = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
  const section = { background: 'white', borderRadius: 12, padding: '28px 32px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' };
  const sectionTitle = { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 };
  const sectionSub = { fontSize: 13, color: '#6b7280', marginBottom: 24 };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: 15 }}>Loading your form…</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Form not found</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>This link may have expired or is invalid. Contact your account manager.</div>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480, background: 'white', borderRadius: 16, padding: '48px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 12 }}>You're all set!</div>
        <div style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.7, marginBottom: 24 }}>
          Thanks for filling out your onboarding form. We'll review your answers and reach out to schedule your kickoff call.
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>— The Hit Me SEO Team</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#111827', padding: '20px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>Hit Me SEO</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Client Onboarding</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saveIndicator === 'saving' && <span style={{ fontSize: 12, color: '#9ca3af' }}>Saving…</span>}
            {saveIndicator === 'saved' && <span style={{ fontSize: 12, color: '#34d399' }}>✓ Saved</span>}
            {saveIndicator === 'error' && <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Save failed — retrying…</span>}
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{progress}% complete</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ maxWidth: 720, margin: '12px auto 0', height: 4, background: '#374151', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#10b981', borderRadius: 4, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Welcome to Hit Me SEO</h1>
          <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            This form helps us understand your business so we can build a strategy that actually works. It auto-saves as you type.
          </p>
        </div>

        {/* ── Section 1: Business Info ── */}
        <div style={section}>
          <div style={sectionTitle}>1. Business Information</div>
          <div style={sectionSub}>Tell us the basics about your business.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={label}>Business Name *</label>
              <input style={inp} value={data.business_name} onChange={e => update('business_name', e.target.value)} placeholder="Acme Roofing Co." />
            </div>
            <div>
              <label style={label}>Owner / Primary Contact *</label>
              <input style={inp} value={data.owner_name} onChange={e => update('owner_name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label style={label}>Business Phone *</label>
              <input style={inp} value={data.phone} onChange={e => update('phone', e.target.value)} placeholder="(555) 000-0000" type="tel" />
            </div>
            <div>
              <label style={label}>Cell / Text Number</label>
              <input style={inp} value={data.cell} onChange={e => update('cell', e.target.value)} placeholder="(555) 000-0001" type="tel" />
            </div>
            <div>
              <label style={label}>Email *</label>
              <input style={inp} value={data.email} onChange={e => update('email', e.target.value)} placeholder="jane@acmeroofing.com" type="email" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={label}>Website</label>
              <input style={inp} value={data.website} onChange={e => update('website', e.target.value)} placeholder="https://acmeroofing.com" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={label}>Street Address</label>
              <input style={inp} value={data.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St" />
            </div>
            <div>
              <label style={label}>City *</label>
              <input style={inp} value={data.city} onChange={e => update('city', e.target.value)} placeholder="Washington" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>State</label>
                <input style={inp} value={data.state} onChange={e => update('state', e.target.value)} placeholder="DC" maxLength={2} />
              </div>
              <div>
                <label style={label}>ZIP</label>
                <input style={inp} value={data.zip} onChange={e => update('zip', e.target.value)} placeholder="20001" />
              </div>
            </div>
            <div>
              <label style={label}>Year / Date Business Opened</label>
              <input style={inp} value={data.date_opened} onChange={e => update('date_opened', e.target.value)} placeholder="2010 or March 2010" />
            </div>
          </div>
        </div>

        {/* ── Section 2: Additional Locations ── */}
        <div style={section}>
          <div style={sectionTitle}>2. Additional Locations</div>
          <div style={sectionSub}>Add any other business locations. Skip if you only have one location.</div>
          {(data.extra_locations || []).map((loc, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <div>
                {i === 0 && <label style={label}>Street Address</label>}
                <input style={inp} value={loc.address} onChange={e => updateLocation(i, 'address', e.target.value)} placeholder="456 Oak Ave" />
              </div>
              <div>
                {i === 0 && <label style={label}>City</label>}
                <input style={inp} value={loc.city} onChange={e => updateLocation(i, 'city', e.target.value)} placeholder="Baltimore" />
              </div>
              <div>
                {i === 0 && <label style={label}>State</label>}
                <input style={inp} value={loc.state} onChange={e => updateLocation(i, 'state', e.target.value)} placeholder="MD" maxLength={2} />
              </div>
              <div>
                {i === 0 && <label style={label}>ZIP</label>}
                <input style={inp} value={loc.zip} onChange={e => updateLocation(i, 'zip', e.target.value)} placeholder="21201" />
              </div>
              <div style={{ paddingBottom: 2 }}>
                {i === 0 && <div style={{ marginBottom: 6 }}>&nbsp;</div>}
                <button onClick={() => removeLocation(i)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            </div>
          ))}
          <button onClick={addLocation} style={{ padding: '9px 18px', borderRadius: 8, border: '1px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            + Add Location
          </button>
        </div>

        {/* ── Section 3: Services ── */}
        <div style={section}>
          <div style={sectionTitle}>3. Your Services</div>
          <div style={sectionSub}>What are your top 3–5 services you want to promote?</div>
          <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={4}
            value={data.top_services} onChange={e => update('top_services', e.target.value)}
            placeholder="e.g. Roof replacement, roof repair, gutter installation, emergency tarping…" />
        </div>

        {/* ── Section 4: Target Areas ── */}
        <div style={section}>
          <div style={sectionTitle}>4. Geographic Target Areas</div>
          <div style={sectionSub}>What cities, counties, or regions do you want to rank in?</div>
          <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={4}
            value={data.target_areas} onChange={e => update('target_areas', e.target.value)}
            placeholder="e.g. Washington DC, Northern Virginia, Montgomery County MD…" />
        </div>

        {/* ── Section 5: Competitors ── */}
        <div style={section}>
          <div style={sectionTitle}>5. Top Competitors</div>
          <div style={sectionSub}>List up to 3 competitors you want to outrank, with their websites.</div>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Competitor {n} Name</label>
                <input style={inp} value={data[`competitor_${n}`]} onChange={e => update(`competitor_${n}`, e.target.value)} placeholder="ABC Roofing" />
              </div>
              <div>
                <label style={label}>Their Website</label>
                <input style={inp} value={data[`competitor_${n}_url`]} onChange={e => update(`competitor_${n}_url`, e.target.value)} placeholder="https://abcroofing.com" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Section 6: Ideal Customer ── */}
        <div style={section}>
          <div style={sectionTitle}>6. Ideal Customer</div>
          <div style={sectionSub}>Describe your ideal customer in a few sentences.</div>
          <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={4}
            value={data.ideal_customer} onChange={e => update('ideal_customer', e.target.value)}
            placeholder="e.g. Homeowners in the DC area who own properties worth $400k+, need roof work, and want a licensed contractor they can trust…" />
        </div>

        {/* ── Section 7: Lead Definition ── */}
        <div style={section}>
          <div style={sectionTitle}>7. What Is a Successful Lead?</div>
          <div style={sectionSub}>What does a qualified lead look like for your business?</div>
          <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={3}
            value={data.lead_definition} onChange={e => update('lead_definition', e.target.value)}
            placeholder="e.g. A phone call or form submission from a homeowner requesting a roof inspection or quote…" />
        </div>

        {/* ── Section 8: Account Access ── */}
        <div style={section}>
          <div style={sectionTitle}>8. Account Access</div>
          <div style={sectionSub}>
            Please share logins so we can audit your accounts and get to work. Your credentials are stored securely and never shared.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username / Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</th>
                </tr>
              </thead>
              <tbody>
                {ACCOUNT_ROWS.map(platform => (
                  <tr key={platform} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{platform}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <input
                        style={{ ...inp, fontSize: 13, padding: '8px 10px' }}
                        value={data.account_access?.[platform]?.username || ''}
                        onChange={e => updateAccount(platform, 'username', e.target.value)}
                        placeholder="email or username"
                        autoComplete="off"
                      />
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <input
                        style={{ ...inp, fontSize: 13, padding: '8px 10px' }}
                        type="text"
                        value={data.account_access?.[platform]?.password || ''}
                        onChange={e => updateAccount(platform, 'password', e.target.value)}
                        placeholder="password"
                        autoComplete="off"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔒 This form uses HTTPS encryption. Credentials are stored securely and only visible to your account manager.
          </div>
        </div>

        {/* ── Section 9: Brand ── */}
        <div style={section}>
          <div style={sectionTitle}>9. Brand</div>
          <div style={sectionSub}>Help us understand your visual identity and messaging.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={label}>Websites you like the look/feel of (up to 3)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(n => (
                  <input key={n} style={inp} value={data[`websites_like_${n}`]} onChange={e => update(`websites_like_${n}`, e.target.value)} placeholder={`Website ${n} URL`} />
                ))}
              </div>
            </div>
            <div>
              <label style={label}>Brand Colors (hex codes or descriptions)</label>
              <input style={inp} value={data.brand_colors} onChange={e => update('brand_colors', e.target.value)} placeholder="e.g. Dark blue #1a2b4c, red #d42b2b" />
            </div>
            <div>
              <label style={label}>Taglines, Slogans, or Key Messaging</label>
              <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={3}
                value={data.brand_messaging} onChange={e => update('brand_messaging', e.target.value)}
                placeholder="e.g. 'The roofers DC trusts' — we use this on our vans and website header…" />
            </div>
          </div>
        </div>

        {/* ── Section 10: Anything Else ── */}
        <div style={section}>
          <div style={sectionTitle}>10. Anything Else?</div>
          <div style={sectionSub}>Anything else we should know before we get started?</div>
          <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={5}
            value={data.anything_else} onChange={e => update('anything_else', e.target.value)}
            placeholder="Previous SEO experiences, specific goals, concerns, seasonal patterns, anything at all…" />
        </div>

        {/* Submit */}
        {!confirmSubmit ? (
          <button
            onClick={() => setConfirmSubmit(true)}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: '#111827', color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            Submit Onboarding Form →
          </button>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '2px solid #111827', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Ready to submit?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Once submitted, we'll review your answers and reach out to schedule a kickoff call.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirmSubmit(false)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#111827', color: 'white', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

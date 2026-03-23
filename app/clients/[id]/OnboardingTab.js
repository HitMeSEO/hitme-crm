'use client';

import { useState, useRef } from 'react';

function OnboardingTab({ onboardingForm, onSendForm, sendingOnboard, onboardUrl, onboardCopied, setOnboardCopied, setOnboardUrl, setShowOnboardPanel, refreshOnboarding }) {
  const [revealed, setRevealed] = useState({});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const statusColors = {
    sent: '#f59e0b',
    in_progress: '#3b82f6',
    submitted: '#10b981',
  };
  const statusLabels = {
    sent: 'Sent — awaiting response',
    in_progress: 'In Progress — client is filling it out',
    submitted: 'Submitted',
  };

  const d = onboardingForm?.form_data || {};

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 };
  const cardTitle = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 };
  const row = { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 };
  const keyStyle = { color: 'var(--text-muted)', fontWeight: 600 };
  const valStyle = { color: 'var(--text-primary)', wordBreak: 'break-word' };

  const ACCOUNT_ROWS = [
    'Google Business Profile','Google Analytics','Google Search Console','Google Ads',
    'WordPress CMS','Hosting','Domain Registrar','Facebook','Instagram','LinkedIn','YouTube',
  ];

  // ── Upload & Scan Handler ──
  const handleScan = async (inputFiles) => {
    if (!inputFiles || inputFiles.length === 0) return;
    setScanning(true);
    setScanError('');
    setScanResult(null);

    try {
      const processedFiles = [];

      for (const file of Array.from(inputFiles).slice(0, 5)) {
        const mediaType = file.type || 'application/octet-stream';

        // Word docs — extract text client-side with mammoth
        if (mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name?.endsWith('.docx')) {
          const mammoth = (await import('mammoth')).default;
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          processedFiles.push({ mediaType: 'text/plain', textContent: result.value });
        }
        // PDFs and images — send as base64
        else {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          processedFiles.push({ data: base64, mediaType });
        }
      }

      const res = await fetch('/api/onboard/scan-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: onboardingForm.id,
          files: processedFiles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || 'Scan failed');
      } else {
        setScanResult(data);
        if (refreshOnboarding) refreshOnboarding();
      }
    } catch (err) {
      setScanError('Upload failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleScan(e.dataTransfer.files);
  };

  if (!onboardingForm) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No onboarding form sent yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Send the client an onboarding form to collect their business info, account access, and goals.</div>
        <button
          onClick={onSendForm}
          disabled={sendingOnboard}
          style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', cursor: sendingOnboard ? 'not-allowed' : 'pointer' }}
        >
          {sendingOnboard ? 'Creating…' : '📋 Send Onboarding Form'}
        </button>
        {onboardUrl && (
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>
            {onboardUrl}
            <button onClick={async () => { try { await navigator.clipboard.writeText(onboardUrl); setOnboardCopied(true); setTimeout(() => setOnboardCopied(false), 2500); } catch {} }} style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'var(--accent-muted)', color: 'var(--accent)', border: 'none', cursor: 'pointer' }}>
              {onboardCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const statusColor = statusColors[onboardingForm.status] || '#64748b';

  return (
    <div>
      {/* Status Banner */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {statusLabels[onboardingForm.status] || onboardingForm.status}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Created {new Date(onboardingForm.created_at).toLocaleDateString()}
              {onboardingForm.submitted_at && ` · Submitted ${new Date(onboardingForm.submitted_at).toLocaleDateString()}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onboardingForm.status !== 'submitted' && (
            <button
              onClick={async () => {
                const url = `${window.location.origin}/onboard/${onboardingForm.token}`;
                setOnboardUrl(url);
                setShowOnboardPanel(true);
                try { await navigator.clipboard.writeText(url); setOnboardCopied(true); setTimeout(() => setOnboardCopied(false), 2500); } catch {}
              }}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}
            >
              {onboardCopied ? '✓ Copied!' : 'Copy Form Link'}
            </button>
          )}
          <button
            onClick={onSendForm}
            disabled={sendingOnboard}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer' }}
          >
            {sendingOnboard ? 'Creating…' : '+ New Form'}
          </button>
        </div>
      </div>

      {/* ── Upload Physical Form Card ── */}
      {onboardingForm.status !== 'submitted' && (
        <div style={card}>
          <div style={cardTitle}>Upload Physical Form</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Have a printed discovery form? Upload a photo or scan and AI will extract the answers automatically.
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !scanning && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: scanning ? '24px 20px' : '32px 20px',
              textAlign: 'center',
              cursor: scanning ? 'default' : 'pointer',
              background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--bg-tertiary)',
              transition: 'all 0.2s ease',
            }}
          >
            {scanning ? (
              <div>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Scanning form…</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI is reading the document and extracting answers. This takes 10-20 seconds.</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Drop image here or click to upload
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Supports photos, PDFs, and Word docs (.docx). Up to 5 files.
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleScan(e.target.files)}
          />

          {/* Scan Result */}
          {scanResult && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                Scan complete — {scanResult.fieldsFound} fields extracted
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                The form data has been filled in below. Review the results and make corrections via the form link if needed.
              </div>
            </div>
          )}

          {/* Scan Error */}
          {scanError && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{scanError}</div>
            </div>
          )}
        </div>
      )}

      {onboardingForm.status !== 'submitted' && Object.keys(d).filter(k => d[k]).length === 0 && !scanResult && (
        <div style={{ ...card, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          No answers saved yet. The client hasn't started filling out the form.
        </div>
      )}

      {/* Business Info */}
      {(d.business_name || d.owner_name || d.phone || d.email) && (
        <div style={card}>
          <div style={cardTitle}>Business Information</div>
          {d.business_name && <div style={row}><span style={keyStyle}>Business Name</span><span style={valStyle}>{d.business_name}</span></div>}
          {d.owner_name && <div style={row}><span style={keyStyle}>Owner</span><span style={valStyle}>{d.owner_name}</span></div>}
          {d.phone && <div style={row}><span style={keyStyle}>Phone</span><span style={valStyle}>{d.phone}</span></div>}
          {d.cell && <div style={row}><span style={keyStyle}>Cell</span><span style={valStyle}>{d.cell}</span></div>}
          {d.email && <div style={row}><span style={keyStyle}>Email</span><span style={valStyle}>{d.email}</span></div>}
          {d.website && <div style={row}><span style={keyStyle}>Website</span><span style={valStyle}><a href={d.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{d.website}</a></span></div>}
          {d.address && <div style={row}><span style={keyStyle}>Address</span><span style={valStyle}>{[d.address, d.city, d.state, d.zip].filter(Boolean).join(', ')}</span></div>}
          {d.date_opened && <div style={row}><span style={keyStyle}>Year Opened</span><span style={valStyle}>{d.date_opened}</span></div>}
        </div>
      )}

      {/* Services & Strategy */}
      {(d.top_services || d.target_areas || d.ideal_customer || d.lead_definition) && (
        <div style={card}>
          <div style={cardTitle}>Services & Strategy</div>
          {d.top_services && <div style={{ marginBottom: 14 }}><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Top Services</div><div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{d.top_services}</div></div>}
          {d.target_areas && <div style={{ marginBottom: 14 }}><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Target Areas</div><div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{d.target_areas}</div></div>}
          {d.ideal_customer && <div style={{ marginBottom: 14 }}><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Ideal Customer</div><div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{d.ideal_customer}</div></div>}
          {d.lead_definition && <div><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>What is a Lead?</div><div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{d.lead_definition}</div></div>}
        </div>
      )}

      {/* Competitors */}
      {(d.competitor_1 || d.competitor_2 || d.competitor_3) && (
        <div style={card}>
          <div style={cardTitle}>Competitors</div>
          {[1, 2, 3].map(n => d[`competitor_${n}`] ? (
            <div key={n} style={row}>
              <span style={keyStyle}>Competitor {n}</span>
              <span style={valStyle}>
                {d[`competitor_${n}`]}
                {d[`competitor_${n}_url`] && <> — <a href={d[`competitor_${n}_url`]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{d[`competitor_${n}_url`]}</a></>}
              </span>
            </div>
          ) : null)}
        </div>
      )}

      {/* Account Access */}
      {d.account_access && Object.keys(d.account_access).some(k => d.account_access[k]?.username || d.account_access[k]?.password) && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={cardTitle} className="mb-0">Account Access</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔒 Passwords hidden by default</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Platform</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Password</th>
                </tr>
              </thead>
              <tbody>
                {ACCOUNT_ROWS.map(platform => {
                  const acc = d.account_access[platform];
                  if (!acc?.username && !acc?.password) return null;
                  const isRevealed = revealed[platform];
                  return (
                    <tr key={platform} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{platform}</td>
                      <td style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text-secondary)' }}>{acc?.username || '—'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {acc?.password ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: isRevealed ? 'inherit' : 'monospace', letterSpacing: isRevealed ? 0 : 2 }}>
                              {isRevealed ? acc.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => setRevealed(r => ({ ...r, [platform]: !r[platform] }))}
                              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                              {isRevealed ? 'Hide' : 'Reveal'}
                            </button>
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Brand */}
      {(d.brand_colors || d.brand_messaging || d.websites_like_1) && (
        <div style={card}>
          <div style={cardTitle}>Brand</div>
          {(d.websites_like_1 || d.websites_like_2 || d.websites_like_3) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Websites They Like</div>
              {[d.websites_like_1, d.websites_like_2, d.websites_like_3].filter(Boolean).map((url, i) => (
                <div key={i}><a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)' }}>{url}</a></div>
              ))}
            </div>
          )}
          {d.brand_colors && <div style={{ marginBottom: 14 }}><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Brand Colors</div><div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{d.brand_colors}</div></div>}
          {d.brand_messaging && <div><div style={{ ...keyStyle, fontSize: 12, marginBottom: 4 }}>Messaging / Taglines</div><div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{d.brand_messaging}</div></div>}
        </div>
      )}

      {/* Anything Else */}
      {d.anything_else && (
        <div style={card}>
          <div style={cardTitle}>Anything Else</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>{d.anything_else}</div>
        </div>
      )}
    </div>
  );
}

export default OnboardingTab;

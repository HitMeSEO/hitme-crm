'use client';

import { useState } from 'react';
import { Bug, X, Send, Loader2 } from 'lucide-react';

export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    reported_by: '',
    severity: 'medium',
    description: '',
    steps_to_reproduce: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reported_by || !form.description) return;

    setSending(true);
    try {
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          page_url: window.location.href,
        }),
      });

      if (res.ok) {
        setSent(true);
        setForm({ reported_by: form.reported_by, severity: 'medium', description: '', steps_to_reproduce: '' });
        setTimeout(() => {
          setSent(false);
          setOpen(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Bug report error:', err);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Report a Bug"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
        }}
      >
        <Bug size={22} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      width: '360px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      border: '1px solid #e2e4e9',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#6366f1',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
          <Bug size={18} />
          Report a Bug
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Success state */}
      {sent ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#10003;</div>
          <div style={{ fontWeight: 600, color: '#22c55e' }}>Bug report submitted!</div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Tim has been notified.</div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Your Name *
            </label>
            <input
              type="text"
              value={form.reported_by}
              onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
              placeholder="Pam, Ben, Kevin..."
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Severity */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Severity
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { value: 'low', label: 'Low', color: '#22c55e' },
                { value: 'medium', label: 'Medium', color: '#f59e0b' },
                { value: 'high', label: 'High', color: '#f97316' },
                { value: 'critical', label: 'Critical', color: '#ef4444' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, severity: opt.value })}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: form.severity === opt.value ? `2px solid ${opt.color}` : '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: form.severity === opt.value ? `${opt.color}15` : 'white',
                    color: form.severity === opt.value ? opt.color : '#6b7280',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              What happened? *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the bug — what did you expect vs what actually happened?"
              required
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Steps */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Steps to reproduce <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={form.steps_to_reproduce}
              onChange={(e) => setForm({ ...form, steps_to_reproduce: e.target.value })}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
              rows={2}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={sending || !form.reported_by || !form.description}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              background: sending ? '#94a3b8' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Submitting...' : 'Submit Bug Report'}
          </button>

          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
            Current page URL will be included automatically.
          </div>
        </form>
      )}
    </div>
  );
}

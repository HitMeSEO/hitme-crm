// /app/api/bug-reports/route.js
// Saves a bug report to Supabase + sends email notification via Resend

import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { reported_by, page_url, severity, description, steps_to_reproduce } = await request.json();

    if (!reported_by || !description) {
      return Response.json({ error: 'reported_by and description are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Save to database
    const { data: report, error: insertError } = await supabase
      .from('bug_reports')
      .insert({
        reported_by,
        page_url: page_url || null,
        severity: severity || 'medium',
        description,
        steps_to_reproduce: steps_to_reproduce || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[bug-reports] insert error:', insertError.message);
      return Response.json({ error: 'Failed to save bug report: ' + insertError.message }, { status: 500 });
    }

    // Send email notification via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const severityColors = {
        low: '#22c55e',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444',
      };
      const severityColor = severityColors[severity] || '#f59e0b';

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fc; color: #1a1c26;">
  <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e4e9;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #6366f1;">Hit Me</span>
      <span style="font-size: 20px; font-weight: 800; color: #1a1c26;"> SEO</span>
    </div>

    <h2 style="font-size: 18px; color: #1a1c26; margin: 0 0 8px;">
      Bug Report
      <span style="display: inline-block; background: ${severityColor}; color: white; font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-left: 8px;">${severity || 'medium'}</span>
    </h2>
    <p style="color: #64748b; font-size: 13px; margin: 0 0 20px;">Reported by <strong>${reported_by}</strong></p>

    <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 6px;">Description</div>
      <div style="font-size: 14px; color: #1a1c26; white-space: pre-wrap;">${description}</div>
    </div>

    ${steps_to_reproduce ? `
    <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 6px;">Steps to Reproduce</div>
      <div style="font-size: 14px; color: #1a1c26; white-space: pre-wrap;">${steps_to_reproduce}</div>
    </div>` : ''}

    ${page_url ? `
    <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 6px;">Page URL</div>
      <div style="font-size: 14px; color: #6366f1;">${page_url}</div>
    </div>` : ''}

    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 16px 0 0;">Report ID: ${report.id}</p>
  </div>
</body>
</html>`;

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Hit Me SEO <noreply@hitmeseo.com>',
            to: ['timmarose@sponsorsource.com'],
            subject: `[Bug Report - ${(severity || 'medium').toUpperCase()}] ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`,
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const errData = await resendRes.json();
          console.error('[bug-reports] email send failed:', errData);
        }
      } catch (emailErr) {
        // Don't fail the whole request if email fails — report is already saved
        console.error('[bug-reports] email error:', emailErr.message);
      }
    }

    return Response.json({ success: true, report });
  } catch (err) {
    console.error('[bug-reports] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// GET: List bug reports (for admin view later)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ reports: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

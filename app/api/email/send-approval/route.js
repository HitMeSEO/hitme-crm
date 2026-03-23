// /app/api/email/send-approval/route.js
// Sends a content approval email to the client's primary contact via Resend
// POST body: { contentId }

import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { contentId } = await request.json();

    if (!contentId) {
      return Response.json({ error: 'contentId is required' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not configured. Add it to Vercel environment variables.' }, { status: 500 });
    }

    const supabase = await createClient();

    // Get the content item with client info
    const { data: content, error: contentErr } = await supabase
      .from('content_queue')
      .select('*, clients(*)')
      .eq('id', contentId)
      .single();

    if (contentErr || !content) {
      return Response.json({ error: 'Content item not found' }, { status: 404 });
    }

    const client = content.clients;
    if (!client) {
      return Response.json({ error: 'Client not found for this content' }, { status: 404 });
    }

    // Get the primary contact
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('client_id', client.id)
      .eq('is_primary', true)
      .limit(1);

    const primaryContact = contacts?.[0];
    if (!primaryContact?.email) {
      return Response.json({ error: 'No primary contact with email found. Add a primary contact first.' }, { status: 400 });
    }

    // Build the approval URL
    const approvalUrl = `https://hitme-crm-app.vercel.app/approve/${contentId}`;

    // Build the email HTML
    const contentPreview = (content.body_html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 300);

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

    <h2 style="font-size: 18px; color: #1a1c26; margin: 0 0 8px;">Content Ready for Your Review</h2>
    <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">
      Hi ${primaryContact.first_name || 'there'}, we've prepared new content for <strong>${client.company_name}</strong> and it's ready for your review.
    </p>

    <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 8px;">
        ${content.content_type || 'Content'}
      </div>
      <div style="font-size: 16px; font-weight: 600; color: #1a1c26; margin-bottom: 8px;">
        ${content.title || content.h1 || 'Untitled'}
      </div>
      ${contentPreview ? `<p style="font-size: 13px; color: #475569; line-height: 1.6; margin: 0;">${contentPreview}...</p>` : ''}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${approvalUrl}" style="display: inline-block; padding: 14px 32px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Review & Approve
      </a>
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
      This email was sent by Hit Me SEO on behalf of your account manager.
    </p>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hit Me SEO <noreply@hitmeseo.com>',
        to: [primaryContact.email],
        subject: `Content Ready for Review — ${content.title || client.company_name}`,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('[send-approval] Resend error:', resendData);
      return Response.json({ error: resendData.message || 'Failed to send email' }, { status: 500 });
    }

    // Update content status
    await supabase
      .from('content_queue')
      .update({ client_approval: 'pending' })
      .eq('id', contentId);

    // Log activity
    await supabase.from('activity_log').insert({
      client_id: client.id,
      type: 'Email',
      description: `Sent approval email to ${primaryContact.email} for "${content.title}"`,
    });

    return Response.json({
      success: true,
      emailId: resendData.id,
      sentTo: primaryContact.email,
    });

  } catch (err) {
    console.error('[send-approval] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

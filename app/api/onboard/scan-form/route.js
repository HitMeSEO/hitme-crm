// /app/api/onboard/scan-form/route.js
// Accepts uploaded images, PDFs, or Word docs of a physical discovery form,
// uses Claude to extract the answers, and saves them to the onboarding form.

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

const anthropic = new Anthropic();

const EXTRACTION_PROMPT = `You are extracting client onboarding data from a document or image of a discovery form.

Read the content carefully and extract ALL information you can find. Map it to this exact JSON structure:

{
  "business_name": "",
  "owner_name": "",
  "phone": "",
  "cell": "",
  "email": "",
  "website": "",
  "address": "",
  "city": "",
  "state": "",
  "zip": "",
  "date_opened": "",
  "top_services": "",
  "target_areas": "",
  "competitor_1": "",
  "competitor_1_url": "",
  "competitor_2": "",
  "competitor_2_url": "",
  "competitor_3": "",
  "competitor_3_url": "",
  "ideal_customer": "",
  "lead_definition": "",
  "brand_colors": "",
  "brand_messaging": "",
  "websites_like_1": "",
  "websites_like_2": "",
  "websites_like_3": "",
  "anything_else": "",
  "account_access": {},
  "extra_locations": []
}

Rules:
- Only fill in fields you can clearly read from the form. Leave empty string "" for anything unclear or missing.
- For account_access, use format: { "Platform Name": { "username": "...", "password": "..." } }
  Valid platforms: Google Business Profile, Google Analytics, Google Search Console, Google Ads, WordPress CMS, Hosting, Domain Registrar, Facebook, Instagram, LinkedIn, YouTube
- For extra_locations, use format: [{ "address": "", "city": "", "state": "", "zip": "" }]
- For multi-line text fields (services, target areas, etc.), combine into a single string with commas or line breaks.
- Return ONLY the JSON object. No explanation, no markdown, no code fences.`;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const { formId, files } = body;

    if (!formId || !files || !files.length) {
      return Response.json({ error: 'Missing formId or files' }, { status: 400 });
    }

    // Verify the form exists
    const { data: form, error: formErr } = await supabase
      .from('onboarding_forms')
      .select('id, token, form_data, status')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    // Build content blocks for Claude based on file type
    const contentBlocks = [];

    for (const file of files) {
      const mediaType = file.mediaType || 'image/jpeg';

      if (mediaType === 'application/pdf') {
        // PDFs use document type in Claude API
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.data,
          },
        });
      } else if (mediaType === 'text/plain') {
        // Plain text extracted from Word docs (handled client-side)
        contentBlocks.push({
          type: 'text',
          text: `--- DOCUMENT CONTENT ---\n${file.textContent}\n--- END DOCUMENT ---`,
        });
      } else {
        // Images (JPEG, PNG, etc.)
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: file.data,
          },
        });
      }
    }

    // Add the extraction prompt
    contentBlocks.push({ type: 'text', text: EXTRACTION_PROMPT });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    const rawText = response.content[0]?.text || '{}';

    // Parse the JSON — handle potential markdown fences
    let extracted;
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extracted = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', rawText);
      return Response.json({ error: 'Failed to parse extracted data', raw: rawText }, { status: 500 });
    }

    // Merge with existing form data (don't overwrite fields that already have values)
    const existing = form.form_data || {};
    const merged = { ...extracted };

    for (const [key, val] of Object.entries(existing)) {
      if (val && (typeof val === 'string' ? val.trim() : true)) {
        if (!merged[key] || (typeof merged[key] === 'string' && !merged[key].trim())) {
          merged[key] = val;
        }
      }
    }

    // Save to database
    const { error: updateErr } = await supabase
      .from('onboarding_forms')
      .update({
        form_data: merged,
        status: form.status === 'sent' ? 'in_progress' : form.status,
      })
      .eq('id', formId);

    if (updateErr) {
      return Response.json({ error: 'Failed to save: ' + updateErr.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      extracted,
      merged,
      fieldsFound: Object.entries(extracted).filter(([k, v]) => {
        if (typeof v === 'string') return v.trim().length > 0;
        if (typeof v === 'object') return Object.keys(v).length > 0;
        return false;
      }).length,
    });

  } catch (err) {
    console.error('Scan form error:', err);
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// /app/api/content/generate-gbp-batch/route.js
// Generates a batch of GBP posts for a client using neighborhood + service rotation
// Each post targets a different service/neighborhood combination
// POST body: { clientId, count: 4 }

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

function buildGbpPostPromptV2(client, settings, service, neighborhood, city, state, linkUrl, previousPosts) {
  const phone = client.phone || '';
  const previousContext = previousPosts.length > 0
    ? `\n=== PREVIOUSLY GENERATED POSTS (do NOT repeat topics or angles) ===\n${previousPosts.map((p, i) => `Post ${i + 1}: ${p.title} — ${p.body_html?.substring(0, 100)}...`).join('\n')}\n`
    : '';

  return `You are writing a Google Business Profile post for a local service business.

Return ONLY a valid JSON object — no markdown, no preamble, nothing outside the JSON.

=== CLIENT ===
Company: ${client.company_name}
Phone: ${phone}
City: ${city}, ${state}
Target Service: ${service}
Neighborhood Focus: ${neighborhood || city}
Link URL: ${linkUrl || client.website || ''}
${settings?.brand_voice_notes ? `Brand voice: ${settings.brand_voice_notes}` : ''}
${settings?.trust_signals ? `Trust signals: ${settings.trust_signals}` : ''}
${previousContext}

=== GBP POST RULES ===
- Length: 120-160 words TOTAL (count carefully)
- Plain text ONLY — no HTML tags, no markdown, no bullet points
- Write in first person or second person ("We" or "You"), not third person
- First sentence: lead with the service AND the specific neighborhood or area name "${neighborhood || city}"
- Middle: 2-3 sentences of value — what the service solves, a quick concrete detail (price range, timeframe, or fact relevant to this neighborhood)
- Mention the neighborhood "${neighborhood || city}" naturally 1-2 times (not forced)
- End with a hard CTA: include the phone number (${phone}) and the link URL (${linkUrl || client.website || ''})
- No em dashes. No one-sentence paragraphs. No AI-pattern phrases.
- Sound like a real local business owner, not a marketing bot.
- Do NOT use: "comprehensive", "tailored", "unique", "navigating", "in today's", "don't face this alone"
- The body_html field is the COMPLETE post — no title, no H-tags, just the post body as plain text
- Make each post DIFFERENT from previous posts — vary the angle, opening, and CTA style

Return this exact JSON structure:
{
  "title_tag": "${service} in ${neighborhood || city} — ${client.company_name}",
  "meta_description": "",
  "h1": "${service} in ${neighborhood || city}, ${state}",
  "url_slug": "",
  "body_html": "<the full GBP post as plain text, no HTML tags>"
}`;
}

export async function POST(request) {
  try {
    const { clientId, count = 4, locationId, schedule = 'none', startDate } = await request.json();
    // schedule: 'none' | 'weekly' | 'biweekly' — spreads posts over time
    // startDate: ISO date string for when to start scheduling (defaults to today)

    if (!clientId) {
      return Response.json({ error: 'clientId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get client, settings, and locations
    const [
      { data: client, error: clientError },
      { data: settings },
      { data: locations },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('locations').select('*').eq('client_id', clientId).order('location_name'),
    ]);

    if (clientError || !client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Determine the target location (use provided or first with research)
    let targetLocation = null;
    if (locationId) {
      targetLocation = (locations || []).find(l => l.id === locationId);
    }
    if (!targetLocation) {
      targetLocation = (locations || []).find(l => l.research_status === 'complete' && l.keyword_brief);
    }
    if (!targetLocation && locations?.length > 0) {
      targetLocation = locations[0];
    }

    const city = targetLocation?.address_city || client.address_city || '';
    const state = targetLocation?.address_state || client.address_state || '';
    const linkUrl = client.website || '';

    // Get services from client settings
    const services = settings?.business_services || [];
    if (services.length === 0) {
      return Response.json({ error: 'No business services configured. Add services in client settings first.' }, { status: 400 });
    }

    // Get neighborhoods from keyword brief
    const brief = targetLocation?.keyword_brief || {};
    const neighborhoods = brief.local_details?.neighborhoods || [city];
    if (neighborhoods.length === 0) neighborhoods.push(city);

    // Get existing GBP posts to avoid repetition
    const { data: existingPosts } = await supabase
      .from('content_queue')
      .select('title, body_html, notes')
      .eq('client_id', clientId)
      .eq('content_type', 'GBP Post')
      .order('created_at', { ascending: false })
      .limit(10);

    // Build rotation: cycle through services × neighborhoods
    const combos = [];
    for (let s = 0; s < services.length; s++) {
      for (let n = 0; n < neighborhoods.length; n++) {
        combos.push({ service: services[s], neighborhood: neighborhoods[n] });
      }
    }

    // Find how many GBP posts already exist to offset the rotation
    const existingCount = (existingPosts || []).length;
    const startIdx = existingCount % combos.length;

    // Generate posts
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const generated = [];
    const actualCount = Math.min(count, 8); // Cap at 8 to avoid timeout

    for (let i = 0; i < actualCount; i++) {
      const combo = combos[(startIdx + i) % combos.length];
      const prompt = buildGbpPostPromptV2(
        client, settings, combo.service, combo.neighborhood,
        city, state, linkUrl,
        [...(existingPosts || []), ...generated]
      );

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawText = message.content[0]?.text?.trim() || '';
        const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        // Calculate scheduled date if scheduling is enabled
        let scheduledDate = null;
        if (schedule !== 'none') {
          const base = startDate ? new Date(startDate) : new Date();
          const daysPerPost = schedule === 'biweekly' ? 14 : 7;
          const postDate = new Date(base);
          postDate.setDate(postDate.getDate() + (i * daysPerPost));
          scheduledDate = postDate.toISOString().split('T')[0];
        }

        // Save to content_queue
        const insertData = {
          client_id: clientId,
          location_id: targetLocation?.id || null,
          title: parsed.h1 || parsed.title_tag,
          content_type: 'GBP Post',
          status: 'Not Started',
          title_tag: parsed.title_tag,
          meta_description: parsed.meta_description || null,
          h1: parsed.h1 || null,
          url_slug: null,
          body_html: parsed.body_html || null,
          notes: `Auto-generated GBP post. Service: ${combo.service} | Neighborhood: ${combo.neighborhood}`,
        };
        if (scheduledDate) insertData.scheduled_date = scheduledDate;

        const { data: contentItem, error: insertError } = await supabase
          .from('content_queue')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error(`[gbp-batch] insert error for post ${i + 1}:`, insertError.message);
        } else {
          generated.push(contentItem);
        }
      } catch (genErr) {
        console.error(`[gbp-batch] generation error for post ${i + 1}:`, genErr.message);
        // Continue generating remaining posts
      }
    }

    // Update last_gbp_post_date on the client
    if (generated.length > 0) {
      await supabase
        .from('clients')
        .update({ last_gbp_post_date: new Date().toISOString().split('T')[0] })
        .eq('id', clientId);
    }

    return Response.json({
      success: true,
      generated: generated.length,
      requested: actualCount,
      posts: generated.map(p => ({
        id: p.id,
        title: p.title,
        service: p.notes?.match(/Service: ([^|]+)/)?.[1]?.trim(),
        neighborhood: p.notes?.match(/Neighborhood: (.+)/)?.[1]?.trim(),
      })),
      rotation: {
        services,
        neighborhoods,
        totalCombos: combos.length,
        startedAt: startIdx,
      },
    });

  } catch (err) {
    console.error('[gbp-batch] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

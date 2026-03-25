// /app/api/content/generate/route.js
// Generates content from a completed keyword brief
// Supports: service_location_page, blog_post, gbp_post

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildMapEmbedForContent } from '@/lib/map-embed';
import { buildServicePagePrompt, WRITING_RULES } from '@/lib/content-engine';

export const maxDuration = 120;

// ============================================================
// PROMPT: BLOG POST
// ============================================================
function buildBlogPostPrompt(client, location, settings, brief, targetService) {
  const city = location.address_city || client.address_city || '';
  const state = location.address_state || client.address_state || '';
  const phone = client.phone || '';
  const website = client.website || '';
  const keyword = targetService || brief.primary_keyword;
  const secondaryKws = (brief.secondary_keywords || []).slice(0, 5).join(', ');

  return `You are an expert content writer for local service businesses.

Write an informational blog post targeting the keyword: "${keyword}"

Return ONLY a valid JSON object — no markdown, no preamble, nothing outside the JSON.

=== CLIENT ===
Company: ${client.company_name}
Website: ${website}
Phone: ${phone}
Location: ${city}, ${state}
${settings?.trust_signals ? `Trust signals: ${settings.trust_signals}` : ''}
${settings?.brand_voice_notes ? `Brand voice: ${settings.brand_voice_notes}` : ''}

=== KEYWORD CONTEXT ===
Primary Topic: ${keyword}
Related Terms: ${secondaryKws}
Target Word Count: 800-1000 words

=== BLOG POST RULES ===
- This is an INFORMATIONAL article, not a sales page. Educate the reader.
- Title tag: max 60 chars, keyword-forward, Title Case, no pipes (|)
- Meta description: max 160 chars, include a soft CTA, no pipes (|)
- H1: clear, benefit-driven headline about the topic
- Use 3-4 H2 sections covering different angles of the topic
- End with a brief section mentioning ${client.company_name} as a resource, with a link to ${website}
- Include one internal link to the website: <a href="${website}">${client.company_name}</a>
- URL slug: lowercase, hyphens only, no "the", 3-6 words
- Output valid HTML using only: p, h2, h3, ul, li, strong, em, a tags
- Do NOT include local details (neighborhoods, zip codes) — this is a broad educational piece
${WRITING_RULES}

Return this exact JSON structure:
{
  "title_tag": "...",
  "meta_description": "...",
  "h1": "...",
  "url_slug": "...",
  "body_html": "..."
}`;
}

// ============================================================
// PROMPT: GBP POST
// ============================================================
function buildGbpPostPrompt(client, location, settings, brief, targetService, linkUrl) {
  const city = location.address_city || client.address_city || '';
  const state = location.address_state || client.address_state || '';
  const phone = client.phone || '';
  const keyword = targetService || brief.primary_keyword;

  return `You are writing a Google Business Profile post for a local service business.

Return ONLY a valid JSON object — no markdown, no preamble, nothing outside the JSON.

=== CLIENT ===
Company: ${client.company_name}
Phone: ${phone}
City: ${city}, ${state}
Service to promote: ${keyword}
Link URL: ${linkUrl || client.website || ''}
${settings?.brand_voice_notes ? `Brand voice: ${settings.brand_voice_notes}` : ''}

=== GBP POST RULES ===
- Length: 120-160 words TOTAL (count carefully)
- Plain text ONLY — no HTML tags, no markdown, no bullet points
- Write in first person or second person ("We" or "You"), not third person
- First sentence: lead with the service and a specific local detail (city name, neighborhood, or local reference)
- Middle: 2-3 sentences of value — what the service solves, a quick concrete detail (price range, timeframe, or fact)
- End with a hard CTA: include the phone number (${phone}) and the link URL (${linkUrl || client.website || ''})
- No em dashes. No one-sentence paragraphs. No AI-pattern phrases.
- Sound like a real local business owner, not a marketing bot.
- Do NOT use: "comprehensive", "tailored", "unique", "navigating", "in today's"
- The post_text field is the COMPLETE post — no title, no H-tags, just the post body

Return this exact JSON structure:
{
  "title_tag": "${keyword} — ${client.company_name}",
  "meta_description": "",
  "h1": "${keyword} in ${city}, ${state}",
  "url_slug": "",
  "body_html": "<the full GBP post as plain text, no HTML tags>"
}`;
}

// ============================================================
// MAIN ROUTE HANDLER
// ============================================================
export async function POST(request) {
  try {
    const { clientId, locationId, page_type = 'service_location_page', target_service, link_url, editedBrief } = await request.json();

    if (!clientId || !locationId) {
      return Response.json({ error: 'clientId and locationId are required' }, { status: 400 });
    }

    const supabase = await createClient();

    const [
      { data: client, error: clientError },
      { data: location, error: locationError },
      { data: settings },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('locations').select('*').eq('id', locationId).single(),
      supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle(),
    ]);

    if (clientError) console.error('[generate] client error:', clientError.message);
    if (locationError) console.error('[generate] location error:', locationError.message);

    if (!client || !location) {
      return Response.json({ error: 'Client or location not found' }, { status: 404 });
    }

    if (location.research_status !== 'complete' || !location.keyword_brief) {
      return Response.json(
        { error: 'Location must have completed research before generating content' },
        { status: 400 }
      );
    }

    // Save edited brief back to the location record if Pam made changes
    if (editedBrief && typeof editedBrief === 'object') {
      const { error: briefSaveError } = await supabase
        .from('locations')
        .update({ keyword_brief: editedBrief })
        .eq('id', locationId);
      if (briefSaveError) console.error('[generate] brief save error:', briefSaveError.message);
    }

    const brief = editedBrief || location.keyword_brief;

    // Pick the right prompt and token budget
    let prompt;
    let maxTokens;
    let dbContentType;

    if (page_type === 'gbp_post') {
      prompt = buildGbpPostPrompt(client, location, settings, brief, target_service, link_url);
      maxTokens = 2000;
      dbContentType = 'GBP Post';
    } else if (page_type === 'blog_post') {
      prompt = buildBlogPostPrompt(client, location, settings, brief, target_service);
      maxTokens = 10000;
      dbContentType = 'Blog Post';
    } else {
      prompt = buildServicePagePrompt(client, location, settings, brief, target_service);
      maxTokens = 12000;
      dbContentType = 'service_location_page';
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0]?.text?.trim() || '';
    const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

    let generated;
    try {
      generated = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[generate] JSON parse failed. Raw:', rawText.substring(0, 500));
      throw new Error('Claude returned invalid JSON: ' + parseErr.message);
    }

    const { title_tag, meta_description, h1, url_slug, body_html: rawBodyHtml } = generated;

    if (!title_tag || !rawBodyHtml) {
      throw new Error('Claude response missing required fields (title_tag, body_html)');
    }

    // Append Google Map embed to service location pages (bottom of content)
    const mapEmbed = buildMapEmbedForContent(client, location, page_type);
    const body_html = mapEmbed ? rawBodyHtml + '\n' + mapEmbed : rawBodyHtml;

    // Auto-generate schema for service location pages
    let schemaJson = null;
    if (page_type === 'service_location_page' && body_html) {
      const loc = location;
      const city = loc.address_city || client.address_city || '';
      const state = loc.address_state || client.address_state || '';
      const localBusiness = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `${client.website || ''}#${city.toLowerCase().replace(/\s+/g, '-')}`,
        name: client.company_name,
        url: client.website || '',
        telephone: client.phone || '',
        address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: state },
        areaServed: { '@type': 'City', name: city },
      };
      if (client.gbp_rating && client.gbp_review_count) {
        localBusiness.aggregateRating = { '@type': 'AggregateRating', ratingValue: client.gbp_rating, reviewCount: client.gbp_review_count };
      }
      if (client.gbp_maps_url) localBusiness.sameAs = [client.gbp_maps_url];
      const svcList = settings?.business_services || [];
      if (svcList.length > 0) {
        localBusiness.hasOfferCatalog = {
          '@type': 'OfferCatalog', name: 'Services',
          itemListElement: svcList.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })),
        };
      }
      // Extract FAQ from body_html
      let faqSchema = null;
      const faqRegex = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
      const faqItems = [];
      let faqMatch;
      while ((faqMatch = faqRegex.exec(body_html)) !== null) {
        faqItems.push({ '@type': 'Question', name: faqMatch[1].trim(), acceptedAnswer: { '@type': 'Answer', text: faqMatch[2].replace(/<[^>]+>/g, '').trim() } });
      }
      if (faqItems.length > 0) {
        faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems };
      }
      schemaJson = { localBusiness, faq: faqSchema };
    }

    const { data: contentItem, error: insertError } = await supabase
      .from('content_queue')
      .insert({
        client_id: clientId,
        location_id: locationId,
        title: h1 || title_tag,
        content_type: dbContentType,
        status: 'Not Started',
        title_tag,
        meta_description: meta_description || null,
        url_slug: url_slug || null,
        h1: h1 || null,
        body_html: body_html || null,
        schema_json: schemaJson,
        notes: `Generated ${page_type.replace(/_/g, ' ')}. Keyword: ${target_service || brief.primary_keyword}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[generate] insert error:', insertError.message);
      throw new Error('Failed to save content: ' + insertError.message);
    }

    // Only update content_status for service pages (not blog/GBP which are extras)
    if (page_type === 'service_location_page') {
      await supabase
        .from('locations')
        .update({ content_status: 'draft' })
        .eq('id', locationId);
    }

    // Auto-create a review task for Pam (only for service location pages, no duplicates)
    if (page_type === 'service_location_page') {
      // Look up Pam's profile
      const { data: pamProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', '%pam%')
        .limit(1)
        .maybeSingle();

      const taskTitle = `Review ${location.location_name} service location page`;

      // Check for an existing open task for this location to avoid duplicates
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', clientId)
        .eq('title', taskTitle)
        .not('status', 'eq', 'Complete')
        .maybeSingle();

      if (!existingTask) {
        await supabase.from('tasks').insert({
          client_id: clientId,
          title: taskTitle,
          description: `Service location page generated for ${location.location_name}. Primary keyword: ${target_service || brief.primary_keyword}`,
          status: 'Not Started',
          priority: 'Medium',
          assigned_to: pamProfile?.id || null,
        });
      }
    }

    return Response.json({
      success: true,
      contentItem,
      page_type,
      primary_keyword: target_service || brief.primary_keyword,
    });

  } catch (err) {
    console.error('[generate] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

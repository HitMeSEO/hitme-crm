// /app/api/content/preview-schema/route.js
// DRY RUN: Preview what schema markup would be injected WITHOUT touching WordPress.
// Returns the full JSON-LD for review before pushing.

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { buildPageSchema } from '../schema/route';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { content_id, client_id, bulk } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: settings } = await supabase
      .from('client_settings')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    let query = supabase
      .from('content_queue')
      .select('*')
      .eq('client_id', client_id);

    if (content_id && !bulk) {
      query = query.eq('id', content_id);
    } else {
      query = query.not('wordpress_post_id', 'is', null);
    }

    const { data: items } = await query;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, pages: [], message: 'No published pages found.' });
    }

    const locationIds = [...new Set(items.filter(i => i.location_id).map(i => i.location_id))];
    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .in('id', locationIds.length > 0 ? locationIds : ['none']);

    const locMap = {};
    (locations || []).forEach(l => { locMap[l.id] = l; });

    const previews = [];

    for (const item of items) {
      const schemas = buildPageSchema(item, client, settings, locMap);
      const warnings = validateSchema(schemas, item, client);

      // Build script tags for preview
      const scriptTags = [];
      if (schemas.service) {
        scriptTags.push(`<script type="application/ld+json">\n${JSON.stringify(schemas.service, null, 2)}\n</script>`);
      }
      if (schemas.breadcrumb) {
        scriptTags.push(`<script type="application/ld+json">\n${JSON.stringify(schemas.breadcrumb, null, 2)}\n</script>`);
      }
      if (schemas.faq) {
        scriptTags.push(`<script type="application/ld+json">\n${JSON.stringify(schemas.faq, null, 2)}\n</script>`);
      }
      if (schemas.webpage) {
        scriptTags.push(`<script type="application/ld+json">\n${JSON.stringify(schemas.webpage, null, 2)}\n</script>`);
      }

      previews.push({
        id: item.id,
        title: item.title || item.title_tag || 'Untitled',
        url_slug: item.url_slug || '',
        published_url: item.published_url || '',
        wordpress_post_id: item.wordpress_post_id || null,
        content_type: item.content_type || '',
        schemas,
        schema_types: Object.keys(schemas).filter(k => schemas[k]),
        faq_count: schemas.faq?.mainEntity?.length || 0,
        service_name: schemas.service?.name || '',
        area_served: schemas.service?.areaServed?.name || '',
        has_image: !!schemas.service?.image,
        has_webpage: !!schemas.webpage,
        warnings,
        script_tags: scriptTags,
      });
    }

    const totalWarnings = previews.reduce((sum, p) => sum + p.warnings.length, 0);

    return NextResponse.json({
      success: true,
      client: client.company_name,
      total_pages: previews.length,
      total_warnings: totalWarnings,
      pages: previews,
    });

  } catch (err) {
    console.error('[preview-schema] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Validate schema for potential issues
function validateSchema(schemas, item, client) {
  const warnings = [];

  // Service schema checks
  if (!schemas.service?.name || schemas.service.name === item.title) {
    warnings.push('Could not extract specific service name from title — using full title as service name.');
  }
  if (!schemas.service?.areaServed?.name) {
    warnings.push('Missing area served — no city found for this page.');
  }
  if (!schemas.service?.provider?.telephone) {
    warnings.push('Missing phone number on provider — add phone to client record.');
  }
  if (!schemas.service?.url) {
    warnings.push('No published URL — schema will not have a page URL reference.');
  }
  if (!schemas.service?.description || schemas.service.description.length < 20) {
    warnings.push('Short or missing description — add a meta description to improve schema quality.');
  }

  // Breadcrumb checks
  if (!schemas.breadcrumb) {
    warnings.push('No breadcrumb schema — client has no website URL set.');
  }

  // FAQ checks
  if (!schemas.faq && item.body_html?.toLowerCase().includes('faq')) {
    warnings.push('Page mentions FAQ but no Q&A pairs extracted. Check that FAQ uses <h3>Question?</h3><p>Answer</p> format.');
  }
  if (schemas.faq?.mainEntity) {
    for (const qa of schemas.faq.mainEntity) {
      if (qa.acceptedAnswer?.text?.length < 20) {
        warnings.push(`Short answer for "${qa.name}" (${qa.acceptedAnswer.text.length} chars).`);
      }
    }
  }

  // Rating check
  if (!client.gbp_rating) {
    warnings.push('No GBP rating — aggregateRating omitted from provider. Not required but helpful.');
  }

  // Image check — CRITICAL for uniqueness
  if (!item.image_url) {
    warnings.push('⚠️ NO UNIQUE IMAGE — attach a unique image from the Images tab. Pages without unique images lose ranking power. Each page MUST have its own image.');
  }

  return warnings;
}

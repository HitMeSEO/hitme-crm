// /app/api/content/push-schema/route.js
// Injects schema markup into an EXISTING WordPress page without touching the body content.
// 1. Fetches current page content from WordPress
// 2. Strips any existing JSON-LD schema scripts
// 3. Appends fresh schema from content_queue.schema_json
// 4. PUTs updated content back to WordPress
//
// POST body: { content_id, client_id }
// Optional: { bulk: true } to push schema to ALL published pages for a client

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { content_id, client_id, bulk } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    // Get WP credentials
    const { data: settings } = await supabase
      .from('client_settings')
      .select('wordpress_url, wordpress_api_key')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!settings?.wordpress_url || !settings?.wordpress_api_key) {
      return NextResponse.json({ error: 'WordPress credentials not configured for this client.' }, { status: 400 });
    }

    const wpUrl = settings.wordpress_url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + Buffer.from(settings.wordpress_api_key).toString('base64');

    // Get content items to process
    let query = supabase
      .from('content_queue')
      .select('*')
      .eq('client_id', client_id)
      .not('wordpress_post_id', 'is', null); // Must already be published to WP

    if (content_id && !bulk) {
      query = query.eq('id', content_id);
    }

    // Only items that have schema_json
    query = query.not('schema_json', 'is', null);

    const { data: items, error: queryErr } = await query;

    if (queryErr) {
      return NextResponse.json({ error: queryErr.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No published pages with schema to push.' });
    }

    const results = [];

    for (const item of items) {
      try {
        const wpPostId = item.wordpress_post_id;

        // Step 1: Fetch current page content from WordPress
        const getRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPostId}`, {
          headers: { 'Authorization': authHeader },
        });

        if (!getRes.ok) {
          results.push({ id: item.id, title: item.title, status: 'error', message: `WP fetch failed (${getRes.status})` });
          continue;
        }

        const wpPage = await getRes.json();
        let currentContent = wpPage.content?.rendered || wpPage.content?.raw || '';

        // If we can't get raw content, try fetching with context=edit
        if (!wpPage.content?.raw) {
          const editRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPostId}?context=edit`, {
            headers: { 'Authorization': authHeader },
          });
          if (editRes.ok) {
            const editPage = await editRes.json();
            currentContent = editPage.content?.raw || currentContent;
          }
        }

        // Step 2: Strip any existing JSON-LD schema scripts from the content
        const strippedContent = currentContent.replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, '').trimEnd();

        // Step 3: Build fresh schema script tags from new structure
        const schemaTags = [];
        if (item.schema_json.service) {
          schemaTags.push(`<script type="application/ld+json">${JSON.stringify(item.schema_json.service)}</script>`);
        }
        if (item.schema_json.breadcrumb) {
          schemaTags.push(`<script type="application/ld+json">${JSON.stringify(item.schema_json.breadcrumb)}</script>`);
        }
        if (item.schema_json.faq) {
          schemaTags.push(`<script type="application/ld+json">${JSON.stringify(item.schema_json.faq)}</script>`);
        }
        if (item.schema_json.webpage) {
          schemaTags.push(`<script type="application/ld+json">${JSON.stringify(item.schema_json.webpage)}</script>`);
        }
        // Backward compat: support old localBusiness key
        if (!item.schema_json.service && item.schema_json.localBusiness) {
          schemaTags.push(`<script type="application/ld+json">${JSON.stringify(item.schema_json.localBusiness)}</script>`);
        }

        if (schemaTags.length === 0) {
          results.push({ id: item.id, title: item.title, status: 'skipped', message: 'No schema data' });
          continue;
        }

        // Step 4: Append schema to content and PUT back
        const updatedContent = strippedContent + '\n' + schemaTags.join('\n');

        const putRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPostId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ content: updatedContent }),
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          let errMsg = `WP update failed (${putRes.status})`;
          try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
          results.push({ id: item.id, title: item.title, status: 'error', message: errMsg });
          continue;
        }

        results.push({
          id: item.id,
          title: item.title,
          status: 'success',
          wordpress_post_id: wpPostId,
          schemas_injected: schemaTags.length,
        });

      } catch (itemErr) {
        results.push({ id: item.id, title: item.title, status: 'error', message: itemErr.message });
      }
    }

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      updated: succeeded,
      failed,
      total: items.length,
      results,
    });

  } catch (err) {
    console.error('[push-schema] error:', err);
    return NextResponse.json({ error: err.message || 'Push schema failed' }, { status: 500 });
  }
}

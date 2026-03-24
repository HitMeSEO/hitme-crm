// /app/api/content/push-schema/route.js
// Pushes schema markup to WordPress pages via custom meta field.
//
// Strategy: Instead of injecting <script> tags into post content (which WP strips),
// we store the full JSON-LD schema array in a custom post meta field `_hitme_schema`.
// A companion mu-plugin on the WordPress side reads this field and renders the
// JSON-LD script tags in the <head> via wp_head action.
//
// Additionally, strips any previously-injected JSON-LD from the post content body
// (cleanup from the old approach).
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

        // Build the schema array from the structured schema_json
        const schemaBlocks = [];
        if (item.schema_json.service) {
          schemaBlocks.push(item.schema_json.service);
        }
        if (item.schema_json.breadcrumb) {
          schemaBlocks.push(item.schema_json.breadcrumb);
        }
        if (item.schema_json.faq) {
          schemaBlocks.push(item.schema_json.faq);
        }
        if (item.schema_json.webpage) {
          schemaBlocks.push(item.schema_json.webpage);
        }
        // Backward compat: support old localBusiness key
        if (!item.schema_json.service && item.schema_json.localBusiness) {
          schemaBlocks.push(item.schema_json.localBusiness);
        }

        if (schemaBlocks.length === 0) {
          results.push({ id: item.id, title: item.title, status: 'skipped', message: 'No schema data' });
          continue;
        }

        // Also clean up any old JSON-LD that was injected into content body (legacy approach)
        // Fetch current content to check for old scripts
        let contentUpdate = {};
        const getRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPostId}?context=edit`, {
          headers: { 'Authorization': authHeader },
        });

        if (getRes.ok) {
          const wpPage = await getRes.json();
          const rawContent = wpPage.content?.raw || '';
          // Strip any old JSON-LD scripts from body content
          const stripped = rawContent.replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, '').trimEnd();
          if (stripped !== rawContent) {
            contentUpdate = { content: stripped };
          }
        }

        // Push schema as meta field + clean up content if needed
        const putRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPostId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            ...contentUpdate,
            meta: {
              _hitme_schema: JSON.stringify(schemaBlocks),
            },
          }),
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
          schemas_injected: schemaBlocks.length,
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

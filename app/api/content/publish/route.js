import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/google-auth';
import { buildMapEmbedForContent } from '@/lib/map-embed';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { content_id, client_id } = await request.json();

    if (!content_id || !client_id) {
      return NextResponse.json({ error: 'content_id and client_id required' }, { status: 400 });
    }

    // Get content record
    const { data: content, error: contentErr } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', content_id)
      .single();

    if (contentErr || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (!content.body_html || !content.title_tag) {
      return NextResponse.json({ error: 'Content must have a title tag and body HTML before publishing' }, { status: 400 });
    }

    // Get client + settings + location in parallel
    const [
      { data: client },
      { data: settings },
      locationResult,
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('client_settings').select('wordpress_url, wordpress_api_key').eq('client_id', client_id).maybeSingle(),
      content.location_id
        ? supabase.from('locations').select('*').eq('id', content.location_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const location = locationResult?.data || null;

    if (!settings?.wordpress_url || !settings?.wordpress_api_key) {
      return NextResponse.json({ error: 'WordPress credentials not configured. Go to Edit Client to add them.' }, { status: 400 });
    }

    const wpUrl = settings.wordpress_url.replace(/\/+$/, '');
    const apiKey = settings.wordpress_api_key;
    const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');

    // Build publish HTML: body content + map embed (if not already present)
    let publishHtml = content.body_html;

    // Append Google Map embed if not already in the content
    if (client && !publishHtml.includes('google.com/maps/embed')) {
      const mapEmbed = buildMapEmbedForContent(client, location, content.content_type);
      if (mapEmbed) {
        publishHtml = publishHtml + '\n' + mapEmbed;
      }
    }

    // Note: Schema is now handled via _hitme_schema meta field (push-schema route),
    // NOT injected into page content. WordPress strips <script> tags from content.

    // Build schema blocks for the meta field (if schema_json exists)
    const schemaBlocks = [];
    if (content.schema_json) {
      if (content.schema_json.service) schemaBlocks.push(content.schema_json.service);
      if (content.schema_json.breadcrumb) schemaBlocks.push(content.schema_json.breadcrumb);
      if (content.schema_json.faq) schemaBlocks.push(content.schema_json.faq);
      if (content.schema_json.webpage) schemaBlocks.push(content.schema_json.webpage);
      if (!content.schema_json.service && content.schema_json.localBusiness) {
        schemaBlocks.push(content.schema_json.localBusiness);
      }
    }

    const wpBody = {
      title: content.title_tag,
      content: publishHtml,
      status: 'publish',
      slug: content.url_slug ? content.url_slug.replace(/^\/+|\/+$/g, '') : undefined,
      // Store schema in meta field for the mu-plugin to render in <head>
      ...(schemaBlocks.length > 0 ? {
        meta: {
          _hitme_schema: JSON.stringify(schemaBlocks),
        },
      } : {}),
    };

    // Add meta description as excerpt
    if (content.meta_description) {
      wpBody.excerpt = content.meta_description;
    }

    // Check if this content was already published (has a wordpress_post_id)
    const method = content.wordpress_post_id ? 'PUT' : 'POST';
    const endpoint = content.wordpress_post_id
      ? `${wpUrl}/wp-json/wp/v2/pages/${content.wordpress_post_id}`
      : `${wpUrl}/wp-json/wp/v2/pages`;

    const wpRes = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(wpBody),
    });

    if (!wpRes.ok) {
      const errText = await wpRes.text();
      let errMsg = `WordPress API error (${wpRes.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errMsg;
      } catch {}
      return NextResponse.json({ error: errMsg }, { status: wpRes.status });
    }

    const wpData = await wpRes.json();
    const publishedUrl = wpData.link || `${wpUrl}/${content.url_slug || ''}`;
    const now = new Date().toISOString();

    // Update content record with published info
    await supabase.from('content_queue').update({
      wordpress_post_id: String(wpData.id),
      published_url: publishedUrl,
      published_at: now,
      status: 'Published',
    }).eq('id', content_id);

    // Update location content_status if linked
    if (content.location_id) {
      await supabase.from('locations').update({
        content_status: 'published',
      }).eq('id', content.location_id);
    }

    // Fire-and-forget: Ping Google Indexing API to crawl the new URL
    let indexingResult = null;
    try {
      const accessToken = await getAccessToken(supabase);
      if (accessToken && publishedUrl) {
        const indexRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url: publishedUrl, type: 'URL_UPDATED' }),
        });
        if (indexRes.ok) {
          indexingResult = await indexRes.json();
          console.log('[publish] Indexing API pinged:', publishedUrl);
        } else {
          const indexErr = await indexRes.json();
          console.warn('[publish] Indexing API failed (non-blocking):', indexErr.error?.message);
        }
      }
    } catch (indexErr) {
      console.warn('[publish] Indexing API error (non-blocking):', indexErr.message);
    }

    return NextResponse.json({
      success: true,
      url: publishedUrl,
      wordpress_post_id: wpData.id,
      indexed: !!indexingResult,
      has_map: publishHtml.includes('google.com/maps/embed'),
      has_schema: schemaBlocks.length > 0,
    });

  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

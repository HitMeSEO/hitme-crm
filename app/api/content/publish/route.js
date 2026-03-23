import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/google-auth';

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

    // Get client settings for WP credentials
    const { data: settings } = await supabase
      .from('client_settings')
      .select('wordpress_url, wordpress_api_key')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!settings?.wordpress_url || !settings?.wordpress_api_key) {
      return NextResponse.json({ error: 'WordPress credentials not configured. Go to Edit Client to add them.' }, { status: 400 });
    }

    const wpUrl = settings.wordpress_url.replace(/\/+$/, '');
    const apiKey = settings.wordpress_api_key;

    // Build the WP REST API request
    // apiKey format is "username:application_password"
    const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');

    // Inject schema markup into body HTML before publishing
    let publishHtml = content.body_html;
    if (content.schema_json) {
      const schemas = [];
      // New structure: service, breadcrumb, faq
      if (content.schema_json.service) {
        schemas.push(`<script type="application/ld+json">${JSON.stringify(content.schema_json.service)}</script>`);
      }
      if (content.schema_json.breadcrumb) {
        schemas.push(`<script type="application/ld+json">${JSON.stringify(content.schema_json.breadcrumb)}</script>`);
      }
      if (content.schema_json.faq) {
        schemas.push(`<script type="application/ld+json">${JSON.stringify(content.schema_json.faq)}</script>`);
      }
      if (content.schema_json.webpage) {
        schemas.push(`<script type="application/ld+json">${JSON.stringify(content.schema_json.webpage)}</script>`);
      }
      // Backward compat: old localBusiness key
      if (!content.schema_json.service && content.schema_json.localBusiness) {
        schemas.push(`<script type="application/ld+json">${JSON.stringify(content.schema_json.localBusiness)}</script>`);
      }
      if (schemas.length > 0) {
        publishHtml = publishHtml + '\n' + schemas.join('\n');
      }
    }

    const wpBody = {
      title: content.title_tag,
      content: publishHtml,
      status: 'publish',
      slug: content.url_slug ? content.url_slug.replace(/^\/+|\/+$/g, '') : undefined,
    };

    // If meta_description exists, try to set it via Yoast/RankMath meta
    // We'll add it as an excerpt which most themes display
    if (content.meta_description) {
      wpBody.excerpt = content.meta_description;
    }

    // Check if this content was already published (has a wordpress_post_id)
    const method = content.wordpress_post_id ? 'PUT' : 'POST';
    const endpoint = content.wordpress_post_id
      ? `${wpUrl}/wp-json/wp/v2/pages/${content.wordpress_post_id}`
      : `${wpUrl}/wp-json/wp/v2/pages`;

    const wpRes = await fetch(endpoint, {
      method: method === 'PUT' ? 'PUT' : 'POST',
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
    });

  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

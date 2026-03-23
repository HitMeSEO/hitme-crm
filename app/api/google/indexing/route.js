// /app/api/google/indexing/route.js
// Notifies Google to crawl/index a URL via the Indexing API
// Requires Google OAuth to be connected

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { url, type = 'URL_UPDATED' } = await request.json();

    if (!url) {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      return Response.json({ error: 'Google not connected. Go to Settings to connect Google.' }, { status: 401 });
    }

    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type, // URL_UPDATED or URL_DELETED
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[indexing] API error:', err);
      return Response.json({
        error: `Indexing API error: ${err.error?.message || res.status}`,
        details: err,
      }, { status: res.status });
    }

    const data = await res.json();
    console.log('[indexing] URL submitted:', url, data);
    return Response.json({ success: true, data });
  } catch (err) {
    console.error('[indexing] Route error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

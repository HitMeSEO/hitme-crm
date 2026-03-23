// /app/api/google/search-console-sites/route.js
// Lists all Search Console sites the connected Google account has access to
// Used to match client websites to their Search Console properties

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function GET() {
  try {
    const supabase = await createClient();
    const accessToken = await getAccessToken(supabase);

    if (!accessToken) {
      return Response.json({ error: 'Google not connected' }, { status: 401 });
    }

    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: err.error?.message || 'Failed to list sites' }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ sites: data.siteEntry || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

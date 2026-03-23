// /app/api/google/callback/route.js
// Handles Google OAuth callback — exchanges code for tokens, stores in Supabase
import { createClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/lib/google-auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/';

  if (error) {
    console.error('[google-callback] OAuth error:', error);
    return Response.redirect(new URL(`${state}?google_error=${error}`, request.url));
  }

  if (!code) {
    return Response.redirect(new URL(`${state}?google_error=no_code`, request.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();

    // Store tokens — single row keyed as 'default'
    const tokenData = {
      id: 'default',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope,
      connected_at: new Date().toISOString(),
    };

    // Upsert — create or update the single token row
    const { error: dbErr } = await supabase
      .from('google_tokens')
      .upsert(tokenData, { onConflict: 'id' });

    if (dbErr) {
      console.error('[google-callback] DB error:', dbErr);
      return Response.redirect(new URL(`${state}?google_error=db_save_failed`, request.url));
    }

    console.log('[google-callback] Google OAuth connected successfully');
    return Response.redirect(new URL(`${state}?google_connected=true`, request.url));
  } catch (err) {
    console.error('[google-callback] Exchange error:', err.message);
    return Response.redirect(new URL(`${state}?google_error=${encodeURIComponent(err.message)}`, request.url));
  }
}

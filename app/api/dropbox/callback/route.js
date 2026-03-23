// /app/api/dropbox/callback/route.js
// Handles Dropbox OAuth callback — exchanges code for tokens, stores in Supabase
import { createClient } from '@/lib/supabase/server';
import { exchangeDropboxCode } from '@/lib/dropbox-auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/';

  if (error) {
    console.error('[dropbox-callback] OAuth error:', error);
    return Response.redirect(new URL(`${state}?dropbox_error=${error}`, request.url));
  }

  if (!code) {
    return Response.redirect(new URL(`${state}?dropbox_error=no_code`, request.url));
  }

  try {
    const tokens = await exchangeDropboxCode(code);
    const supabase = await createClient();

    // Store tokens — single row keyed as 'default' (same pattern as google_tokens)
    const tokenData = {
      id: 'default',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      account_id: tokens.account_id || '',
      uid: tokens.uid || '',
      connected_at: new Date().toISOString(),
    };

    // Upsert — create or update the single token row
    const { error: dbErr } = await supabase
      .from('dropbox_tokens')
      .upsert(tokenData, { onConflict: 'id' });

    if (dbErr) {
      console.error('[dropbox-callback] DB error:', dbErr);
      return Response.redirect(new URL(`${state}?dropbox_error=db_save_failed`, request.url));
    }

    console.log('[dropbox-callback] Dropbox OAuth connected successfully');
    return Response.redirect(new URL(`${state}?dropbox_connected=true`, request.url));
  } catch (err) {
    console.error('[dropbox-callback] Exchange error:', err.message);
    return Response.redirect(new URL(`${state}?dropbox_error=${encodeURIComponent(err.message)}`, request.url));
  }
}

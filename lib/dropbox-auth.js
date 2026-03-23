// /lib/dropbox-auth.js
// Shared Dropbox OAuth2 token management
// Mirrors google-auth.js pattern — stores refresh_token in Supabase

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/dropbox/callback`
  : 'https://hitme-crm-app.vercel.app/api/dropbox/callback';

// Build the Dropbox OAuth URL
export function getDropboxAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    redirect_uri: DROPBOX_REDIRECT_URI,
    response_type: 'code',
    token_access_type: 'offline', // Gets us a refresh_token
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeDropboxCode(code) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
      redirect_uri: DROPBOX_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Dropbox token exchange failed: ${err.error_description || err.error}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, token_type, uid, account_id }
}

// Refresh access token using stored refresh token
export async function refreshDropboxToken(refreshToken) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Dropbox token refresh failed: ${err.error_description || err.error}`);
  }
  return res.json(); // { access_token, expires_in, token_type }
}

// Get a valid Dropbox access token from Supabase (refreshing if needed)
export async function getDropboxAccessToken(supabase) {
  const { data: tokenRow } = await supabase
    .from('dropbox_tokens')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (!tokenRow?.refresh_token) {
    return null; // Not connected
  }

  // Check if access token is still valid (with 5 min buffer)
  const expiresAt = new Date(tokenRow.expires_at || 0).getTime();
  if (tokenRow.access_token && Date.now() < expiresAt - 300000) {
    return tokenRow.access_token;
  }

  // Refresh the token
  const refreshed = await refreshDropboxToken(tokenRow.refresh_token);

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from('dropbox_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
    })
    .eq('id', 'default');

  return refreshed.access_token;
}

export { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REDIRECT_URI };

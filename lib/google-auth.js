// /lib/google-auth.js
// Shared Google OAuth2 token management
// Stores refresh_token in Supabase, handles token refresh automatically

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  : 'https://hitme-crm-app.vercel.app/api/google/callback';

// All scopes we need across the CRM
const SCOPES = [
  'https://www.googleapis.com/auth/indexing',                    // Indexing API
  'https://www.googleapis.com/auth/webmasters.readonly',         // Search Console
  'https://www.googleapis.com/auth/analytics.readonly',          // GA4
  'https://www.googleapis.com/auth/siteverification',            // Site Verification
  'https://www.googleapis.com/auth/drive.readonly',              // Google Drive (read image folders)
].join(' ');

// Build the Google OAuth URL
export function getAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCode(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token exchange failed: ${err.error_description || err.error}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, token_type }
}

// Refresh access token using stored refresh token
export async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${err.error_description || err.error}`);
  }
  return res.json(); // { access_token, expires_in, token_type }
}

// Get a valid access token from Supabase (refreshing if needed)
export async function getAccessToken(supabase) {
  const { data: tokenRow } = await supabase
    .from('google_tokens')
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
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from('google_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
    })
    .eq('id', 'default');

  return refreshed.access_token;
}

export { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SCOPES };

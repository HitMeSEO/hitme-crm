// /app/api/dropbox/connect/route.js
// Redirects user to Dropbox OAuth consent screen
import { getDropboxAuthUrl } from '@/lib/dropbox-auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/';
  const authUrl = getDropboxAuthUrl(returnTo);
  return Response.redirect(authUrl);
}

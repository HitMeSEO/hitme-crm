// /app/api/google/connect/route.js
// Redirects user to Google OAuth consent screen
import { getAuthUrl } from '@/lib/google-auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/';
  const authUrl = getAuthUrl(returnTo);
  return Response.redirect(authUrl);
}

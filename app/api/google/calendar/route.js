// /app/api/google/calendar/route.js
// Pulls Google Calendar events for the connected account
// Returns events within a date range (default: current month)

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Accept date range params — defaults to current month ±7 days for buffer
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    defaultStart.setDate(defaultStart.getDate() - 7); // 7 days before month start
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 7); // 7 days after month end

    const timeMin = searchParams.get('timeMin') || defaultStart.toISOString();
    const timeMax = searchParams.get('timeMax') || defaultEnd.toISOString();
    const calendarId = searchParams.get('calendarId') || 'primary';

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      return Response.json(
        { error: 'Google not connected. Visit Settings → Google to authorize.' },
        { status: 401 }
      );
    }

    // Fetch events from Google Calendar API v3
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',     // Expand recurring events into individual instances
      orderBy: 'startTime',
      maxResults: '250',
    });

    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!eventsRes.ok) {
      const err = await eventsRes.json();
      console.error('[calendar] Events fetch error:', err);

      // Handle specific Calendar API errors
      if (err.error?.status === 'PERMISSION_DENIED' || eventsRes.status === 403) {
        return Response.json({
          error: 'Calendar access not granted. Please re-connect Google (Settings → Google) to grant calendar permissions.',
          needsReauth: true,
        }, { status: 403 });
      }

      return Response.json(
        { error: `Calendar API error: ${err.error?.message || eventsRes.status}` },
        { status: eventsRes.status }
      );
    }

    const data = await eventsRes.json();

    // Also fetch calendar list so we can show which calendars are available
    const calendarsRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    let calendars = [];
    if (calendarsRes.ok) {
      const calData = await calendarsRes.json();
      calendars = (calData.items || []).map(c => ({
        id: c.id,
        summary: c.summary,
        backgroundColor: c.backgroundColor,
        primary: c.primary || false,
      }));
    }

    // Normalize events for the frontend
    const events = (data.items || []).map(ev => ({
      id: ev.id,
      title: ev.summary || '(No title)',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      allDay: !ev.start?.dateTime, // date-only = all-day event
      status: ev.status,
      htmlLink: ev.htmlLink,
      color: ev.colorId || null,
      creator: ev.creator?.email || '',
      attendees: (ev.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName || '',
        status: a.responseStatus || '',
        self: a.self || false,
      })),
      hangoutLink: ev.hangoutLink || ev.conferenceData?.entryPoints?.[0]?.uri || '',
    }));

    return Response.json({
      events,
      calendars,
      timeMin,
      timeMax,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[calendar] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// /app/api/google/analytics/route.js
// Pulls GA4 data for a client website
// Returns: sessions, users, pageviews, top sources, top pages
// Requires Google OAuth + GA4 property ID

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { propertyId, clientId, days = 28 } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId is required (GA4 property ID, e.g. "properties/123456789")' }, { status: 400 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      return Response.json({ error: 'Google not connected. Visit /api/google/connect to authorize.' }, { status: 401 });
    }

    // Normalize property ID format
    const propId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d) => d.toISOString().split('T')[0];

    // Query 1: Overall metrics
    const metricsRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'conversions' },
          ],
        }),
      }
    );

    if (!metricsRes.ok) {
      const err = await metricsRes.json();
      console.error('[analytics] Metrics error:', err);
      return Response.json({
        error: `GA4 error: ${err.error?.message || metricsRes.status}`,
      }, { status: metricsRes.status });
    }

    const metricsData = await metricsRes.json();

    // Query 2: Top traffic sources
    const sourcesRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        }),
      }
    );

    const sourcesData = sourcesRes.ok ? await sourcesRes.json() : null;

    // Query 3: Top pages
    const pagesRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'averageSessionDuration' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 15,
        }),
      }
    );

    const pagesData = pagesRes.ok ? await pagesRes.json() : null;

    // Query 4: Daily trend
    const trendRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
        }),
      }
    );

    const trendData = trendRes.ok ? await trendRes.json() : null;

    // Parse overall metrics
    const row = metricsData.rows?.[0]?.metricValues || [];
    const totals = {
      sessions: parseInt(row[0]?.value || 0),
      users: parseInt(row[1]?.value || 0),
      pageviews: parseInt(row[2]?.value || 0),
      avgSessionDuration: Math.round(parseFloat(row[3]?.value || 0)),
      bounceRate: Math.round(parseFloat(row[4]?.value || 0) * 100) / 100,
      conversions: parseInt(row[5]?.value || 0),
    };

    const result = {
      propertyId: propId,
      period: { start: formatDate(startDate), end: formatDate(endDate), days },
      totals,
      topSources: (sourcesData?.rows || []).map(r => ({
        channel: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        users: parseInt(r.metricValues[1].value),
        conversions: parseInt(r.metricValues[2].value),
      })),
      topPages: (pagesData?.rows || []).map(r => ({
        path: r.dimensionValues[0].value,
        pageviews: parseInt(r.metricValues[0].value),
        sessions: parseInt(r.metricValues[1].value),
        avgDuration: Math.round(parseFloat(r.metricValues[2].value)),
      })),
      dailyTrend: (trendData?.rows || []).map(r => ({
        date: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        users: parseInt(r.metricValues[1].value),
      })),
      fetched_at: new Date().toISOString(),
    };

    // Save to client record if clientId provided
    if (clientId) {
      await supabase
        .from('clients')
        .update({
          analytics_data: result,
          analytics_fetched_at: result.fetched_at,
        })
        .eq('id', clientId);
    }

    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error('[analytics] Route error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

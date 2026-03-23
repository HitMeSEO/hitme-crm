// /app/api/google/search-console/route.js
// Pulls Search Console data for a client website
// Returns: top queries, impressions, clicks, avg position, CTR
// Requires Google OAuth to be connected

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { siteUrl, clientId, days = 28 } = await request.json();

    if (!siteUrl) {
      return Response.json({ error: 'siteUrl is required (e.g. https://example.com)' }, { status: 400 });
    }

    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      return Response.json({ error: 'Google not connected. Visit /api/google/connect to authorize.' }, { status: 401 });
    }

    // --- Auto-detect the correct Search Console property URL ---
    // Sites can be registered as domain properties (sc-domain:), with/without www, http/https
    // We'll list all sites and find the best match for the client's website
    let resolvedSiteUrl = siteUrl;
    try {
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        const allSites = (sitesData.siteEntry || []).map(s => s.siteUrl);

        // Extract domain from client URL
        const urlObj = new URL(siteUrl);
        const domain = urlObj.hostname.replace(/^www\./, '');

        // Priority: 1) exact match, 2) domain property, 3) https with/without www, 4) http
        const exactMatch = allSites.find(s => s === siteUrl);
        const domainProp = allSites.find(s => s === `sc-domain:${domain}`);
        const httpsWww = allSites.find(s => s === `https://www.${domain}/`);
        const httpsNoWww = allSites.find(s => s === `https://${domain}/`);
        const httpWww = allSites.find(s => s === `http://www.${domain}/`);
        const httpNoWww = allSites.find(s => s === `http://${domain}/`);
        const fuzzyMatch = allSites.find(s => s.includes(domain));

        resolvedSiteUrl = exactMatch || domainProp || httpsWww || httpsNoWww || httpWww || httpNoWww || fuzzyMatch || siteUrl;

        if (resolvedSiteUrl !== siteUrl) {
          console.log(`[search-console] Resolved site URL: ${siteUrl} → ${resolvedSiteUrl}`);
        }
      }
    } catch (listErr) {
      console.warn('[search-console] Could not list sites for auto-detection:', listErr.message);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d) => d.toISOString().split('T')[0];

    // Query 1: Top queries (keywords driving traffic)
    const queriesRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedSiteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['query'],
          rowLimit: 25,
          dataState: 'all',
        }),
      }
    );

    if (!queriesRes.ok) {
      const err = await queriesRes.json();
      console.error('[search-console] Queries error:', err);
      return Response.json({
        error: `Search Console error: ${err.error?.message || queriesRes.status}`,
      }, { status: queriesRes.status });
    }

    const queriesData = await queriesRes.json();

    // Query 2: Top pages
    const pagesRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedSiteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['page'],
          rowLimit: 25,
          dataState: 'all',
        }),
      }
    );

    const pagesData = pagesRes.ok ? await pagesRes.json() : null;

    // Query 3: Daily trend (for sparkline/chart)
    const trendRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedSiteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['date'],
          dataState: 'all',
        }),
      }
    );

    const trendData = trendRes.ok ? await trendRes.json() : null;

    // Calculate totals from trend data
    let totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    if (trendData?.rows) {
      totals.clicks = trendData.rows.reduce((sum, r) => sum + r.clicks, 0);
      totals.impressions = trendData.rows.reduce((sum, r) => sum + r.impressions, 0);
      totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
      totals.position = trendData.rows.reduce((sum, r) => sum + r.position, 0) / (trendData.rows.length || 1);
    }

    const result = {
      siteUrl: resolvedSiteUrl,
      period: { start: formatDate(startDate), end: formatDate(endDate), days },
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: Math.round(totals.ctr * 1000) / 10, // percentage with 1 decimal
        avgPosition: Math.round(totals.position * 10) / 10,
      },
      topQueries: (queriesData.rows || []).map(r => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 1000) / 10,
        position: Math.round(r.position * 10) / 10,
      })),
      topPages: (pagesData?.rows || []).map(r => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 1000) / 10,
        position: Math.round(r.position * 10) / 10,
      })),
      dailyTrend: (trendData?.rows || []).map(r => ({
        date: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
      })),
      fetched_at: new Date().toISOString(),
    };

    // Save to client record if clientId provided
    if (clientId) {
      await supabase
        .from('clients')
        .update({
          search_console_data: result,
          search_console_fetched_at: result.fetched_at,
        })
        .eq('id', clientId);
    }

    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error('[search-console] Route error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

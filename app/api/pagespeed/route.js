// /app/api/pagespeed/route.js
// Runs Google PageSpeed Insights audit on a client website
// Returns Core Web Vitals scores + top issues
// No OAuth needed — uses GOOGLE_PLACES_API_KEY

import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { clientId, url } = await request.json();

    if (!url) {
      return Response.json({ error: 'url is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    // Run both mobile and desktop audits in parallel
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=desktop&category=performance&category=seo&category=accessibility&category=best-practices`),
    ]);

    if (!mobileRes.ok) {
      const err = await mobileRes.json();
      console.error('[pagespeed] Mobile audit failed:', err);
      return Response.json({ error: 'PageSpeed audit failed: ' + (err.error?.message || 'Unknown error') }, { status: 500 });
    }

    const mobileData = await mobileRes.json();
    const desktopData = desktopRes.ok ? await desktopRes.json() : null;

    // Extract scores
    function extractScores(data) {
      if (!data?.lighthouseResult?.categories) return null;
      const cats = data.lighthouseResult.categories;
      return {
        performance: Math.round((cats.performance?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
      };
    }

    // Extract Core Web Vitals
    function extractCoreWebVitals(data) {
      const metrics = data?.lighthouseResult?.audits;
      if (!metrics) return null;
      return {
        lcp: metrics['largest-contentful-paint']?.displayValue || null,
        fid: metrics['max-potential-fid']?.displayValue || null,
        cls: metrics['cumulative-layout-shift']?.displayValue || null,
        fcp: metrics['first-contentful-paint']?.displayValue || null,
        tbt: metrics['total-blocking-time']?.displayValue || null,
        si: metrics['speed-index']?.displayValue || null,
        tti: metrics['interactive']?.displayValue || null,
      };
    }

    // Extract top issues (failed audits)
    function extractIssues(data, limit = 10) {
      const audits = data?.lighthouseResult?.audits;
      if (!audits) return [];
      return Object.values(audits)
        .filter(a => a.score !== null && a.score < 0.9 && a.title)
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, limit)
        .map(a => ({
          title: a.title,
          description: a.description?.substring(0, 200),
          score: Math.round((a.score || 0) * 100),
          displayValue: a.displayValue || null,
        }));
    }

    const result = {
      url,
      audited_at: new Date().toISOString(),
      mobile: {
        scores: extractScores(mobileData),
        coreWebVitals: extractCoreWebVitals(mobileData),
        issues: extractIssues(mobileData),
      },
      desktop: desktopData ? {
        scores: extractScores(desktopData),
        coreWebVitals: extractCoreWebVitals(desktopData),
        issues: extractIssues(desktopData),
      } : null,
    };

    // Save to client record if clientId provided
    if (clientId) {
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          pagespeed_data: result,
          pagespeed_audited_at: result.audited_at,
        })
        .eq('id', clientId);

      if (updateErr) {
        console.error('[pagespeed] Failed to save to client:', updateErr);
      }
    }

    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error('[pagespeed] Route error:', err);
    return Response.json({ error: 'Internal server error: ' + err.message }, { status: 500 });
  }
}

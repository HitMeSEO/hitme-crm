import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

// Master Audit: scans content gaps, schema gaps, GBP post gaps, FAQ gaps
// GEO Radar runs separately (takes 2 min) and links via geo_radar_scan_id

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { client_id } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    // Fetch all data in parallel
    const [
      { data: client },
      { data: settings },
      { data: locations },
      { data: contentItems },
      { data: verticalKws },
      { data: latestRadar },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('client_settings').select('*').eq('client_id', client_id).maybeSingle(),
      supabase.from('locations').select('*').eq('client_id', client_id),
      supabase.from('content_queue').select('*').eq('client_id', client_id),
      supabase.from('vertical_keywords').select('keyword, keyword_type, search_volume, intent')
        .eq('keyword_type', 'question')
        .limit(100),
      supabase.from('geo_radar_scans').select('id, visibility_score, status')
        .eq('client_id', client_id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const services = settings?.business_services || [];
    const locs = locations || [];
    const content = contentItems || [];

    // ═══════════════════════════════════════════
    // 1. CONTENT GAP SCAN
    // ═══════════════════════════════════════════
    // Check CRM content_queue AND live website for existing pages
    const contentGaps = [];
    const existingInCRM = new Set(
      content
        .filter(c => c.content_type === 'service_location_page' && c.location_id)
        .map(c => `${c.location_id}`)
    );

    // Check client's live website for existing location pages
    const websiteUrl = (client.website || '').replace(/\/+$/, '');
    const livePages = new Set();

    if (websiteUrl) {
      // Build possible URL patterns for each location and check if they exist
      const checkPromises = locs
        .filter(l => !existingInCRM.has(l.id) && l.address_city)
        .slice(0, 30) // Cap to avoid timeout
        .map(async (loc) => {
          const citySlug = loc.address_city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
          const stateSlug = (loc.address_state || '').toLowerCase();
          // Try common URL patterns
          const patterns = [
            `${websiteUrl}/${citySlug}/`,
            `${websiteUrl}/${citySlug}-${stateSlug}/`,
            `${websiteUrl}/locations/${citySlug}/`,
            `${websiteUrl}/areas-we-serve/${citySlug}/`,
            `${websiteUrl}/${citySlug}-${stateSlug}-${(services[0] || '').toLowerCase().replace(/\s+/g, '-')}/`,
          ];
          for (const url of patterns) {
            try {
              const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
              if (res.ok) {
                livePages.add(loc.id);
                return; // Found it, stop checking patterns
              }
            } catch {
              // URL doesn't exist or timed out, try next pattern
            }
          }
        });

      await Promise.all(checkPromises);
    }

    // Locations without content in CRM AND without a live page on website
    const locsWithoutContent = locs.filter(l => !existingInCRM.has(l.id) && !livePages.has(l.id));
    const locsWithContent = locs.length - locsWithoutContent.length;

    // For each location without content, each service is a gap
    for (const loc of locsWithoutContent) {
      if (services.length > 0) {
        for (const svc of services) {
          contentGaps.push({
            location_id: loc.id,
            location_name: loc.location_name || `${loc.address_city}, ${loc.address_state}`,
            service: svc,
            type: 'service_location_page',
            priority: (!loc.location_type || loc.location_type === 'physical') ? 'high' : 'medium',
          });
        }
      } else {
        contentGaps.push({
          location_id: loc.id,
          location_name: loc.location_name || `${loc.address_city}, ${loc.address_state}`,
          service: 'general',
          type: 'service_location_page',
          priority: 'medium',
        });
      }
    }

    const contentCoverage = locs.length > 0
      ? Math.round((locsWithContent / locs.length) * 100)
      : 0;

    // ═══════════════════════════════════════════
    // 2. SCHEMA SCAN
    // ═══════════════════════════════════════════
    // Check which content items have schema_json set
    const pagesWithSchema = content.filter(c =>
      c.content_type === 'service_location_page' && c.schema_json
    ).length;
    const totalServicePages = content.filter(c =>
      c.content_type === 'service_location_page'
    ).length;
    const schemaCoverage = totalServicePages > 0
      ? Math.round((pagesWithSchema / totalServicePages) * 100)
      : 0;

    const schemaGaps = content
      .filter(c => c.content_type === 'service_location_page' && !c.schema_json)
      .map(c => ({
        content_id: c.id,
        title: c.title || c.title_tag,
        location_id: c.location_id,
      }));

    // ═══════════════════════════════════════════
    // 3. GBP POST SCAN
    // ═══════════════════════════════════════════
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Check recent GBP posts in content_queue
    const recentGbpPosts = content.filter(c =>
      (c.content_type === 'GBP Post' || c.content_type === 'gbp_post') &&
      new Date(c.created_at) > sevenDaysAgo
    );

    // Physical locations that haven't had a post recently
    // Treat null location_type as physical (pre-service-area locations)
    const physicalLocs = locs.filter(l => !l.location_type || l.location_type !== 'service_area');
    const activeLocs = physicalLocs.filter(l => {
      const lastPost = l.last_post_date ? new Date(l.last_post_date) : null;
      return !lastPost || lastPost < sevenDaysAgo;
    });

    const gbpActivity = physicalLocs.length > 0
      ? Math.round(((physicalLocs.length - activeLocs.length) / physicalLocs.length) * 100)
      : 0;

    const gbpGaps = activeLocs.map(l => ({
      location_id: l.id,
      location_name: l.location_name || `${l.address_city}, ${l.address_state}`,
      last_post: l.last_post_date || 'never',
    }));

    // ═══════════════════════════════════════════
    // 4. FAQ GAP SCAN
    // ═══════════════════════════════════════════
    // Questions from vertical_keywords that match this client's industry
    const industryType = settings?.industry_type;
    const relevantQuestions = (verticalKws || []).filter(k =>
      !industryType || k.keyword?.toLowerCase().includes(industryType?.replace('_', ' '))
    );

    // Check which questions are answered in existing content body_html
    const answeredQuestions = [];
    const unansweredQuestions = [];

    for (const q of relevantQuestions) {
      const questionLower = q.keyword.toLowerCase();
      const isAnswered = content.some(c =>
        c.body_html && c.body_html.toLowerCase().includes(questionLower.slice(0, 30))
      );
      if (isAnswered) {
        answeredQuestions.push(q.keyword);
      } else {
        unansweredQuestions.push({
          question: q.keyword,
          search_volume: q.search_volume,
          intent: q.intent,
        });
      }
    }

    const faqCoverage = relevantQuestions.length > 0
      ? Math.round((answeredQuestions.length / relevantQuestions.length) * 100)
      : 0;

    // ═══════════════════════════════════════════
    // 5. GBP-WEBSITE ALIGNMENT CHECK
    // ═══════════════════════════════════════════
    // Compares GBP data (categories, services, hours, description)
    // against what the website actually shows.
    // Mismatches hurt local rankings.
    const alignmentIssues = [];
    let alignmentScore = 100; // Start perfect, deduct for issues

    // Check if GBP data exists at all
    const hasGbpData = client.gbp_place_id || client.gbp_categories;

    if (!hasGbpData) {
      alignmentIssues.push({
        type: 'missing_gbp_data',
        severity: 'high',
        message: 'No GBP data connected — cannot verify alignment. Connect GBP in the GBP Health tab.',
      });
      alignmentScore = 0;
    } else {
      // Check: GBP categories vs client services
      const gbpCategories = (client.gbp_categories || []).map(c =>
        (typeof c === 'string' ? c : c.name || c.displayName || '').toLowerCase()
      );
      const clientServiceLower = services.map(s => s.toLowerCase());

      if (gbpCategories.length === 0) {
        alignmentIssues.push({
          type: 'no_gbp_categories',
          severity: 'medium',
          message: 'GBP categories not loaded. Re-fetch GBP data to check alignment.',
        });
        alignmentScore -= 15;
      } else {
        // Find services not reflected in GBP categories
        const unmatchedServices = clientServiceLower.filter(svc =>
          !gbpCategories.some(cat => cat.includes(svc) || svc.includes(cat))
        );
        if (unmatchedServices.length > 0) {
          alignmentIssues.push({
            type: 'services_not_in_gbp',
            severity: 'medium',
            message: `Services not reflected in GBP categories: ${unmatchedServices.join(', ')}`,
            details: { unmatched: unmatchedServices, gbp_categories: gbpCategories },
          });
          alignmentScore -= Math.min(20, unmatchedServices.length * 5);
        }
      }

      // Check: GBP description/editorial summary exists
      if (!client.gbp_editorial_summary) {
        alignmentIssues.push({
          type: 'no_gbp_description',
          severity: 'low',
          message: 'No GBP editorial summary. Add a business description in Google Business Profile.',
        });
        alignmentScore -= 10;
      }

      // Check: GBP hours exist
      if (!client.gbp_hours || (Array.isArray(client.gbp_hours) && client.gbp_hours.length === 0)) {
        alignmentIssues.push({
          type: 'no_gbp_hours',
          severity: 'medium',
          message: 'No business hours set in GBP. Hours help with "open now" searches.',
        });
        alignmentScore -= 10;
      }

      // Check: GBP post freshness (from gbp_last_post_date)
      if (client.gbp_last_post_date) {
        const lastPost = new Date(client.gbp_last_post_date);
        const daysSincePost = Math.floor((now - lastPost) / (1000 * 60 * 60 * 24));
        if (daysSincePost > 30) {
          alignmentIssues.push({
            type: 'stale_gbp_posts',
            severity: 'high',
            message: `Last GBP post was ${daysSincePost} days ago. Google rewards active profiles — post at least weekly.`,
          });
          alignmentScore -= 20;
        } else if (daysSincePost > 14) {
          alignmentIssues.push({
            type: 'aging_gbp_posts',
            severity: 'medium',
            message: `Last GBP post was ${daysSincePost} days ago. Keep up the pace — weekly is ideal.`,
          });
          alignmentScore -= 10;
        }
      } else {
        alignmentIssues.push({
          type: 'no_post_history',
          severity: 'medium',
          message: 'No GBP post history tracked. Update the Post Tracker in GBP Health tab.',
        });
        alignmentScore -= 15;
      }

      // Check: Website URL matches GBP
      if (client.website && client.gbp_maps_url) {
        // At minimum, GBP should exist and website should be set
        // We can't deep-check the GBP website field from here, but we flag if no website
        if (!client.website.startsWith('http')) {
          alignmentIssues.push({
            type: 'invalid_website_url',
            severity: 'medium',
            message: `Website URL "${client.website}" may not be valid. Ensure it matches the URL in your GBP profile.`,
          });
          alignmentScore -= 10;
        }
      }

      // Check: Review count health
      if (client.gbp_review_count && client.gbp_review_count < 10) {
        alignmentIssues.push({
          type: 'low_review_count',
          severity: 'medium',
          message: `Only ${client.gbp_review_count} GBP reviews. Competitors with 50+ reviews rank higher in the Local Pack.`,
        });
        alignmentScore -= 10;
      }
    }

    // Clamp score
    alignmentScore = Math.max(0, Math.min(100, alignmentScore));

    const gbpAlignmentCoverage = alignmentScore;

    // ═══════════════════════════════════════════
    // CALCULATE OVERALL SCORE
    // ═══════════════════════════════════════════
    const geoRadarScore = latestRadar?.visibility_score || 0;

    // Weighted composite: content 25%, AI visibility 25%, schema 15%, GBP activity 10%, FAQ 10%, GBP alignment 15%
    const aiReadinessScore = Math.round(
      contentCoverage * 0.25 +
      geoRadarScore * 0.25 +
      schemaCoverage * 0.15 +
      gbpActivity * 0.10 +
      faqCoverage * 0.10 +
      gbpAlignmentCoverage * 0.15
    );

    // ═══════════════════════════════════════════
    // SAVE AUDIT
    // ═══════════════════════════════════════════
    const auditData = {
      client_id,
      audit_type: 'full',
      status: 'complete',
      ai_readiness_score: aiReadinessScore,
      content_gap_results: {
        coverage_pct: contentCoverage,
        total_locations: locs.length,
        locations_with_content: locsWithContent,
        in_crm: existingInCRM.size,
        live_on_website: livePages.size,
        gaps: contentGaps.slice(0, 100),
        total_gaps: contentGaps.length,
      },
      schema_scan_results: {
        coverage_pct: schemaCoverage,
        pages_with_schema: pagesWithSchema,
        total_pages: totalServicePages,
        gaps: schemaGaps,
      },
      gbp_post_results: {
        activity_pct: gbpActivity,
        recent_posts: recentGbpPosts.length,
        stale_locations: gbpGaps.length,
        gaps: gbpGaps,
      },
      faq_gap_results: {
        coverage_pct: faqCoverage,
        answered: answeredQuestions.length,
        total_questions: relevantQuestions.length,
        unanswered: unansweredQuestions.slice(0, 30),
      },
      gbp_alignment_results: {
        alignment_pct: gbpAlignmentCoverage,
        has_gbp_data: !!hasGbpData,
        issues_count: alignmentIssues.length,
        issues: alignmentIssues,
      },
      geo_radar_scan_id: latestRadar?.id || null,
    };

    const { data: audit, error: auditErr } = await supabase
      .from('client_audits')
      .insert(auditData)
      .select()
      .single();

    if (auditErr) {
      console.error('Audit save error:', auditErr);
      return NextResponse.json({ error: auditErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      audit_id: audit.id,
      ai_readiness_score: aiReadinessScore,
      content: { coverage: contentCoverage, gaps: contentGaps.length },
      schema: { coverage: schemaCoverage, gaps: schemaGaps.length },
      gbp: { activity: gbpActivity, stale: gbpGaps.length },
      faq: { coverage: faqCoverage, unanswered: unansweredQuestions.length },
      gbp_alignment: { score: gbpAlignmentCoverage, issues: alignmentIssues.length },
      geo_radar: { score: geoRadarScore, has_scan: !!latestRadar },
    });

  } catch (err) {
    console.error('Audit error:', err);
    return NextResponse.json({ error: err.message || 'Audit failed' }, { status: 500 });
  }
}

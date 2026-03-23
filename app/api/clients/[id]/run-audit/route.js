import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert SEO analyst for local service businesses. 
Always respond with valid JSON only. No markdown, no explanations outside the JSON.
Be specific, actionable, and data-driven. Use real neighborhood names, local landmarks, 
and industry-specific terminology.`;

const STEPS = [
  {
    num: 1,
    field: 'step1_crawlability',
    focus: 'Crawlability: Analyze robots.txt directives, sitemap structure and URL count, site architecture, potential orphan pages, and crawl budget allocation. Use the provided robots.txt and sitemap data.',
  },
  {
    num: 2,
    field: 'step2_technical',
    focus: 'Technical SEO: Core Web Vitals (LCP, CLS, TBT), HTTPS security, mobile optimization, URL structure and canonicalization, page speed scores. Reference the provided PageSpeed Insights data.',
  },
  {
    num: 3,
    field: 'step3_onpage',
    focus: 'On-Page SEO: Title tag optimization, meta descriptions, H1 tag usage, heading hierarchy structure, image alt text coverage, internal linking strategy.',
  },
  {
    num: 4,
    field: 'step4_content',
    focus: 'Content Quality: E-E-A-T signals (experience, expertise, authoritativeness, trustworthiness), content depth vs competitor standards, thin content pages, FAQ and People Also Ask opportunities.',
  },
  {
    num: 5,
    field: 'step5_keywords',
    focus: 'Keyword Strategy: High-intent local service keywords, buyer-intent phrase opportunities, ranking gaps vs the provided competitors, keyword cannibalization risks across pages.',
  },
  {
    num: 6,
    field: 'step6_local_seo',
    focus: 'Local SEO: GBP profile optimization, NAP consistency across directories, citation building opportunities, review acquisition strategy, LocalBusiness/Service schema, service area landing pages.',
  },
  {
    num: 7,
    field: 'step7_competitors',
    focus: 'Competitive Analysis: Content and page types the competitors rank for that this business lacks, topical authority gaps, backlink profile opportunities, differentiating service pages to build.',
  },
  {
    num: 8,
    field: 'step8_ai_visibility',
    focus: 'AI Search Visibility (GEO): How well this business appears in ChatGPT, Perplexity, and Gemini results. Schema markup gaps, authoritative mention opportunities, conversational query optimization, structured data for AI retrieval.',
  },
  {
    num: 9,
    field: 'step9_quick_wins',
    focus: 'Quick Wins: The top 10 highest-impact actions completable in under 2 hours each. Must be extremely specific, ordered by impact-to-effort ratio, with exact instructions for each action.',
  },
  {
    num: 10,
    field: 'step10_roadmap',
    focus: '90-Day Strategic Roadmap: Week 1-2 technical foundation fixes, Week 3-4 on-page optimization sprint, Month 2 content creation and local citation campaign, Month 3 authority building and review acquisition. Be specific with deliverables and expected outcomes.',
  },
];

async function preFetchSiteData(website) {
  const data = {};
  const baseUrl = website.startsWith('http') ? website : `https://${website}`;

  await Promise.allSettled([
    fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(baseUrl)}&strategy=mobile`,
      { signal: AbortSignal.timeout(15000) }
    ).then(async (res) => {
      if (!res.ok) return;
      const json = await res.json();
      const lhr = json.lighthouseResult;
      data.pagespeed_mobile = {
        score: lhr?.categories?.performance?.score,
        fcp: lhr?.audits?.['first-contentful-paint']?.displayValue,
        lcp: lhr?.audits?.['largest-contentful-paint']?.displayValue,
        cls: lhr?.audits?.['cumulative-layout-shift']?.displayValue,
        tbt: lhr?.audits?.['total-blocking-time']?.displayValue,
        speed_index: lhr?.audits?.['speed-index']?.displayValue,
        tti: lhr?.audits?.['interactive']?.displayValue,
      };
    }).catch((e) => { data.pagespeed_mobile_error = e.message; }),

    fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(baseUrl)}&strategy=desktop`,
      { signal: AbortSignal.timeout(15000) }
    ).then(async (res) => {
      if (!res.ok) return;
      const json = await res.json();
      const lhr = json.lighthouseResult;
      data.pagespeed_desktop = {
        score: lhr?.categories?.performance?.score,
        fcp: lhr?.audits?.['first-contentful-paint']?.displayValue,
        lcp: lhr?.audits?.['largest-contentful-paint']?.displayValue,
        cls: lhr?.audits?.['cumulative-layout-shift']?.displayValue,
        tbt: lhr?.audits?.['total-blocking-time']?.displayValue,
      };
    }).catch((e) => { data.pagespeed_desktop_error = e.message; }),

    fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(8000) })
      .then(async (res) => {
        if (res.ok) data.robots_txt = (await res.text()).substring(0, 3000);
        else data.robots_txt = null;
      })
      .catch((e) => { data.robots_txt_error = e.message; }),

    fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(8000) })
      .then(async (res) => {
        if (res.ok) {
          const text = await res.text();
          const urlCount = (text.match(/<loc>/g) || []).length;
          data.sitemap = { available: true, url_count: urlCount, preview: text.substring(0, 2000) };
        } else {
          data.sitemap = { available: false };
        }
      })
      .catch((e) => { data.sitemap_error = e.message; }),
  ]);

  try {
    const httpUrl = baseUrl.replace(/^https/, 'http');
    const res = await fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    data.https_redirect = res.status >= 300 && res.status < 400;
  } catch {
    data.https_redirect = null;
  }

  data.fetched_at = new Date().toISOString();
  return data;
}

function buildContext(client, location, siteData) {
  const psiMobile = siteData?.pagespeed_mobile;
  const psiDesktop = siteData?.pagespeed_desktop;
  const scoreStr = (s) => (s != null ? `${Math.round(s * 100)}/100` : 'N/A');

  return `Business: ${client.company_name}
Website: ${client.website || 'Not provided'}
Industry: ${client.primary_category || 'Local service business'}
Location: ${location ? `${location.address_city || ''}${location.address_city && location.address_state ? ', ' : ''}${location.address_state || ''}` : (client.address_city ? `${client.address_city}, ${client.address_state || ''}` : 'Not provided')}
Primary Services: ${client.primary_services || 'Not provided'}
Target Keywords: ${client.target_keywords || 'Not provided'}
Competitors: ${client.competitors || 'Not provided'}

Site Data:
- PageSpeed Mobile: ${scoreStr(psiMobile?.score)} | LCP: ${psiMobile?.lcp || 'N/A'} | CLS: ${psiMobile?.cls || 'N/A'} | TBT: ${psiMobile?.tbt || 'N/A'}
- PageSpeed Desktop: ${scoreStr(psiDesktop?.score)} | LCP: ${psiDesktop?.lcp || 'N/A'} | CLS: ${psiDesktop?.cls || 'N/A'}
- Robots.txt: ${siteData?.robots_txt ? `Available:\n${siteData.robots_txt.substring(0, 800)}` : (siteData?.robots_txt_error ? `Error: ${siteData.robots_txt_error}` : 'Not found')}
- Sitemap.xml: ${siteData?.sitemap?.available ? `Available (${siteData.sitemap.url_count} URLs)` : (siteData?.sitemap_error ? `Error: ${siteData.sitemap_error}` : 'Not found')}
- HTTPS Redirect: ${siteData?.https_redirect === true ? 'Yes' : siteData?.https_redirect === false ? 'No' : 'Unknown'}`;
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  const url = new URL(request.url);
  const stepNum = parseInt(url.searchParams.get('step') || '1', 10);

  console.log(`[run-audit] POST called | params id="${id}" | step=${stepNum} | url=${url.pathname}${url.search}`);

  if (isNaN(stepNum) || stepNum < 1 || stepNum > 10) {
    return NextResponse.json({ error: 'Invalid step. Must be 1–10.' }, { status: 400 });
  }

  if (!id) {
    console.error('[run-audit] ERROR: id is missing from params');
    return NextResponse.json({ error: 'Client ID missing from URL' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const supabase = await createClient();

  // Fetch client (no join — avoids .single() failing when client has multiple locations)
  console.log(`[run-audit] Querying clients table with id="${id}"`);
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  console.log(`[run-audit] Client query: client=${client ? client.company_name : 'NULL'} | error=${clientError ? `${clientError.code}: ${clientError.message}` : 'none'}`);

  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message || 'Client not found' }, { status: 404 });
  }

  // Fetch locations separately
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('client_id', id);

  console.log(`[run-audit] Locations fetched: ${locations?.length ?? 0}`);

  let siteData = client.site_data_cache || null;

  // Step 1: reset audit state and pre-fetch site data
  if (stepNum === 1) {
    // Save a snapshot of current audit scores before resetting (for before/after comparison)
    const previousSnapshot = {};
    let hasExistingAudit = false;
    for (const step of STEPS) {
      const stepData = client[step.field];
      if (stepData?.score != null) {
        previousSnapshot[step.field] = { score: stepData.score, summary: stepData.summary };
        hasExistingAudit = true;
      }
    }
    if (client.audit_completed_at) {
      previousSnapshot.audit_completed_at = client.audit_completed_at;
    }

    const resetPayload = {
      audit_status: 'running',
      audit_progress: 0,
      audit_error: null,
      audit_started_at: new Date().toISOString(),
      audit_completed_at: null,
      site_data_cache: null,
      step1_crawlability: null,
      step2_technical: null,
      step3_onpage: null,
      step4_content: null,
      step5_keywords: null,
      step6_local_seo: null,
      step7_competitors: null,
      step8_ai_visibility: null,
      step9_quick_wins: null,
      step10_roadmap: null,
      // Save previous scores for before/after comparison
      ...(hasExistingAudit ? { previous_audit_snapshot: previousSnapshot } : {}),
    };

    const { error: resetError } = await supabase.from('clients').update(resetPayload).eq('id', id);
    if (resetError) {
      return NextResponse.json({ error: `DB reset failed: ${resetError.message}` }, { status: 500 });
    }

    siteData = client.website ? await preFetchSiteData(client.website) : { note: 'No website provided' };

    await supabase.from('clients').update({ site_data_cache: siteData }).eq('id', id);
  }

  // Build context and run the Claude step
  const step = STEPS.find(s => s.num === stepNum);
  const location = locations?.[0] || null;
  const context = buildContext(client, location, siteData);

  const prompt = `${context}

AUDIT TASK — ${step.focus}

Return ONLY a valid JSON object with this exact structure (no markdown, no preamble):
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentences summarizing the key findings specific to this business>",
  "items": [
    {
      "priority": "<Critical|High|Medium|Low>",
      "effort": "<Quick|Medium|Heavy>",
      "title": "<short action title>",
      "detail": "<specific, actionable detail mentioning exact page names, keyword phrases, or tools>"
    }
  ]
}

Provide 5-8 items. Be extremely specific to ${client.company_name} in ${location?.address_city || locations?.[0]?.address_city || client.address_city || 'their market'}.`;

  let result;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0]?.text?.trim() || '';
    const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    // Write error state to DB and return error
    await supabase.from('clients').update({
      audit_status: 'error',
      audit_error: `Step ${stepNum} failed: ${err?.message || 'Unknown error'}`,
    }).eq('id', id);

    return NextResponse.json({
      error: `Step ${stepNum} failed: ${err?.message || 'Unknown error'}`,
      step: stepNum,
    }, { status: 500 });
  }

  // Save result to DB
  const isLast = stepNum === 10;
  const updatePayload = {
    [step.field]: result,
    audit_progress: stepNum * 10,
    ...(isLast ? {
      audit_status: 'complete',
      audit_completed_at: new Date().toISOString(),
    } : {}),
  };

  const { error: saveError } = await supabase.from('clients').update(updatePayload).eq('id', id);
  if (saveError) {
    return NextResponse.json({ error: `DB save failed: ${saveError.message}`, step: stepNum }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    step: stepNum,
    field: step.field,
    result,
    progress: stepNum * 10,
    complete: isLast,
  });
}

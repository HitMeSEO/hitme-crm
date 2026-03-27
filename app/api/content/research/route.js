// /app/api/content/research/route.js
// Level 1: Keyword Brief Generator
// Analyzes top-ranking pages for a service + city combo
// Uses stored Ahrefs vertical keywords + Claude web search
//
// NO Google scraping. All research via Claude's web search tool (legitimate API)
// + stored vertical_keywords from Ahrefs exports.

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

// ============================================================
// STEP 1: Gather context from Supabase
// ============================================================
async function getContext(clientId, locationId) {
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError) console.error('[research] client query error:', clientError.code, clientError.message);

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single();

  if (locationError) console.error('[research] location query error:', locationError.code, locationError.message);

  const { data: settings } = await supabase
    .from('client_settings')
    .select('*')
    .eq('client_id', clientId)
    .single();

  return { client, location, settings };
}

// ============================================================
// STEP 2: Pull relevant keywords from vertical_keywords table
// Matches the client's industry AND their specific services
// ============================================================
async function getVerticalKeywords(supabase, industryType, clientServices) {
  if (!industryType) {
    return { serviceKeywords: [], topKeywords: [] };
  }

  const { data: allKeywords } = await supabase
    .from('vertical_keywords')
    .select('keyword, search_volume, keyword_difficulty, keyword_type, serp_features, intent')
    .eq('industry', industryType)
    .order('search_volume', { ascending: false })
    .limit(200);

  if (!allKeywords || allKeywords.length === 0) {
    return { serviceKeywords: [], topKeywords: [] };
  }

  // Map client services to keyword_type categories
  const serviceMap = {
    'junk removal': ['junk_removal_core', 'near_me', 'hauling'],
    'junk hauling': ['junk_removal_core', 'near_me', 'hauling'],
    'demolition': ['demolition'],
    'furniture removal': ['furniture_removal'],
    'appliance removal': ['appliance_removal'],
    'debris removal': ['debris_construction'],
    'construction cleanup': ['debris_construction'],
    'estate cleanout': ['estate_cleanout'],
    'hoarder cleanout': ['estate_cleanout'],
    'hot tub removal': ['specialty_removal'],
    'commercial': ['commercial', 'commercial_waste'],
    'dumpster rental': ['dumpster_rental_core', 'roll_off_dumpster'],
    'roll off': ['roll_off_dumpster'],
    'septic': ['septic_service'],
    'septic pumping': ['septic_service'],
    'septic repair': ['septic_service'],
    'grease trap': ['septic_service'],
    'bulk trash': ['bulk_trash'],
  };

  const matchedTypes = new Set();
  const normalizedServices = (clientServices || []).map(s => s.toLowerCase().trim());

  for (const service of normalizedServices) {
    for (const [key, types] of Object.entries(serviceMap)) {
      if (service.includes(key) || key.includes(service)) {
        types.forEach(t => matchedTypes.add(t));
      }
    }
  }

  // Always include pricing and questions
  matchedTypes.add('pricing');
  matchedTypes.add('question');

  const serviceKeywords = allKeywords.filter(
    k => matchedTypes.has(k.keyword_type) || matchedTypes.size === 0
  );

  const topKeywords = allKeywords.slice(0, 50);

  return { serviceKeywords: serviceKeywords.slice(0, 100), topKeywords };
}

// ============================================================
// STEP 3: Build city-specific search queries
// Uses the TOP keyword for each service the client offers
// VARIES format: city front/back, with/without state
// Google returns different results for each pattern
// ============================================================
function buildSearchQueries(serviceKeywords, businessServices, city, state, industryType, companyName) {
  const typeGroups = {};
  for (const kw of serviceKeywords) {
    if (!typeGroups[kw.keyword_type]) {
      typeGroups[kw.keyword_type] = kw;
    }
  }

  // Collect root service terms from vertical keywords (deduplicated)
  const serviceRoots = [];
  const seenRoots = new Set();

  for (const [type, kw] of Object.entries(typeGroups)) {
    if (type === 'pricing' || type === 'question') continue;

    let root = kw.keyword
      .toLowerCase()
      .replace(/near me/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (seenRoots.has(root)) continue;
    seenRoots.add(root);
    serviceRoots.push(root);
  }

  // Add the broad industry term if not already covered
  const broadTerms = {
    'junk_hauling': 'junk removal',
    'dumpster_rental': 'dumpster rental',
    'septic_service': 'septic service',
  };
  const broadTerm = broadTerms[industryType] || (industryType ? industryType.replace(/_/g, ' ') : null);
  if (broadTerm && !seenRoots.has(broadTerm)) {
    serviceRoots.unshift(broadTerm);
  }

  // If no vertical keyword roots, fall back to business_services strings directly
  if (serviceRoots.length === 0 && businessServices && businessServices.length > 0) {
    for (const svc of businessServices.slice(0, 4)) {
      const root = svc.toLowerCase().trim();
      if (!seenRoots.has(root)) {
        seenRoots.add(root);
        serviceRoots.push(root);
      }
    }
  }

  // Build queries with VARIED city/state patterns
  // Google returns different results for each format
  const patterns = [
    (root, c, s) => `${root} ${c} ${s}`,         // "junk removal Pittsburgh PA"
    (root, c, s) => `${c} ${root}`,               // "Pittsburgh junk removal"
    (root, c, s) => `${root} in ${c}`,            // "junk removal in Pittsburgh"
    (root, c, s) => `${root} ${c}`,               // "junk removal Pittsburgh"
    (root, c, s) => `best ${root} ${c}`,          // "best junk removal Pittsburgh"
    (root, c, s) => `${c} ${s} ${root} services`, // "Pittsburgh PA junk removal services"
  ];

  const queries = [];

  if (serviceRoots.length > 0) {
    // For the primary service, use multiple patterns
    const primary = serviceRoots[0];
    queries.push(patterns[0](primary, city, state));
    queries.push(patterns[1](primary, city, state));
    queries.push(patterns[2](primary, city, state));

    // For secondary services, use one pattern each (rotate patterns)
    for (let i = 1; i < serviceRoots.length && queries.length < 6; i++) {
      const patternIdx = i % patterns.length;
      queries.push(patterns[patternIdx](serviceRoots[i], city, state));
    }
  } else {
    // No service data at all — use company name + city so Claude has something to search
    queries.push(`${companyName} ${city}`);
    queries.push(`${companyName} ${city} ${state}`);
    queries.push(`services near ${city} ${state}`);
  }

  // Dedupe and cap at 6
  return [...new Set(queries)].slice(0, 6);
}

// ============================================================
// STEP 4: Claude Research with Web Search
// Geo-aware: tells Claude to analyze as if searching FROM the city
// Service-aware: uses client's actual services and our keyword data
// ============================================================
async function claudeResearch(
  client,
  location,
  settings,
  businessServices,
  serviceKeywords,
  topKeywords,
  searchQueries
) {
  const city = location.address_city || client.address_city;
  const state = location.address_state || client.address_state;

  const serviceKwList = serviceKeywords
    .slice(0, 30)
    .map(k => `- ${k.keyword} (${k.search_volume}/mo, KD:${k.keyword_difficulty}${k.serp_features?.includes('local_pack') ? ', Local Pack' : ''})`)
    .join('\n');

  const questionKws = serviceKeywords
    .filter(k => k.intent === 'question' || k.keyword.startsWith('how') || k.keyword.startsWith('what'))
    .slice(0, 10)
    .map(k => `- ${k.keyword} (${k.search_volume}/mo)`)
    .join('\n');

  const pricingKws = serviceKeywords
    .filter(k => k.keyword_type === 'pricing' || k.keyword.includes('cost') || k.keyword.includes('price'))
    .slice(0, 10)
    .map(k => `- ${k.keyword} (${k.search_volume}/mo)`)
    .join('\n');

  const hasServices = businessServices && businessServices.length > 0;
  const servicesLine = hasServices
    ? businessServices.join(', ')
    : `Unknown — visit ${client.website || 'the business website'} to determine what services this business offers before beginning research`;

  const prompt = `You are an SEO research analyst preparing a keyword brief for a local service business. Your research will power content generation AND competitive intelligence.

CLIENT: ${client.company_name}
SERVICES: ${servicesLine}
TARGET CITY: ${city}, ${state}
INDUSTRY: ${settings?.industry_type || 'Unknown — infer from the business website and search results'}

GEO INSTRUCTION: Analyze results as if you are a person physically in ${city}, ${state} searching on their phone. Focus on LOCAL competitors in the ${city} metro area and the Google Maps Local Pack. National brands may appear but prioritize local businesses.

SEARCH THESE QUERIES (one at a time):
${searchQueries.map(q => `- "${q}"`).join('\n')}

For each search, analyze the top 5-10 organic results AND Local Pack results.

HIGH-VOLUME KEYWORDS FOR THIS INDUSTRY (from our Ahrefs research):
${serviceKwList || 'No pre-researched keyword data available for this industry. Rely entirely on your live search analysis.'}

QUESTIONS PEOPLE ASK:
${questionKws || 'None loaded — extract question patterns from live search results.'}

PRICING KEYWORDS:
${pricingKws || 'None loaded — extract pricing terms from live search results.'}

EXTRACT FROM THE TOP-RANKING LOCAL PAGES:

1. H-TAG STRUCTURE: Exact H1 and H2 tags from top 3 local competitors
2. SERVICES COVERED: Specific services listed on their city pages
3. LOCAL DETAILS: Neighborhoods, landmarks, zip codes, county, local regulations — ONLY what you actually find, never fabricate
4. QUESTIONS ANSWERED: FAQ sections or questions on their pages
5. RELATED TERMS: Terms appearing repeatedly across multiple pages
6. WORD COUNT: Approximate length of top-ranking pages
7. TRUST SIGNALS: Years in business, review counts, certifications
8. CONTENT GAPS: What top pages are MISSING that we can include
9. AI OVERVIEW DATA: If Google shows an AI Overview (SGE) snippet for any query, capture the EXACT questions it answers and the sources it cites. These are high-priority content targets.
10. COMPETITOR BRANDS: For each local competitor, capture their brand name, URL, GBP review count/rating if visible, and the specific services they promote on their pages. We use this to build comparison content.
11. GEOGRAPHIC OPPORTUNITIES: Identify nearby cities, suburbs, and neighborhoods that top competitors are targeting on their pages but our client is NOT. These are expansion opportunities.

Return JSON in this EXACT format:
{
  "primary_keyword": "the #1 keyword to target",
  "secondary_keywords": ["5-10 secondary targets"],
  "required_entities": ["related concepts Google expects for this topic"],
  "recommended_h_tags": {
    "h1": "Recommended H1",
    "h2s": ["H2 1", "H2 2", "H2 3", "H2 4", "H2 5"]
  },
  "target_word_count": 1200,
  "local_details": {
    "neighborhoods": ["real neighborhoods found"],
    "landmarks": ["real landmarks found"],
    "zip_codes": ["zip codes found"],
    "county": "county name",
    "local_regulations": ["permits or rules mentioned"]
  },
  "questions_to_answer": ["5-8 FAQ questions"],
  "competitor_analysis": [
    {
      "url": "competitor URL",
      "title": "page title",
      "estimated_word_count": 1000,
      "strengths": "what they do well",
      "gaps": "our opportunity"
    }
  ],
  "content_angle": "How our page differentiates",
  "pricing_keywords": ["pricing terms to address"],
  "services_to_feature": ["services to highlight based on data"],
  "local_pack_competitors": ["businesses appearing in Maps 3-pack"],
  "ai_overview_questions": ["questions answered by Google AI Overview if present — empty array if no AI Overview shown"],
  "ai_overview_sources": ["URLs cited in AI Overview if present"],
  "competitor_brands": [
    {
      "name": "competitor business name",
      "url": "their website URL",
      "services_promoted": ["services they highlight"],
      "review_rating": 4.5,
      "review_count": 123,
      "differentiator": "what they emphasize (speed, price, years, etc.)"
    }
  ],
  "geographic_opportunities": {
    "nearby_cities_targeted_by_competitors": ["cities/towns competitors target that our client does not"],
    "neighborhoods_mentioned": ["specific neighborhoods referenced across competitor pages"],
    "service_area_gaps": ["areas where no competitor has strong content"]
  }
}

RULES:
- ONLY include REAL data from actual search results
- Do NOT invent neighborhoods, landmarks, or local facts
- Note which businesses appear in the Local Pack
- Focus on LOCAL competitors over national brands
- For competitor_brands, include at LEAST the top 3 local competitors you find
- For ai_overview_questions, only include if Google actually shows an AI Overview — do not fabricate
- For geographic_opportunities, compare what competitors target vs what our client's existing pages cover`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // No per-call abort — let Anthropic finish naturally
  // Only check total deadline BETWEEN rounds to force wrap-up
  const TOTAL_DEADLINE = Date.now() + 270000; // 270s total budget (leave 30s buffer before Vercel's 300s)

  console.log('[research] Starting Anthropic call, queries:', searchQueries.length);
  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      },
    ],
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  console.log('[research] Round 0 done in', Date.now() - startTime, 'ms, stop_reason:', response.stop_reason);

  // Handle multi-turn tool use — Claude searches multiple times
  let finalResponse = response;
  let messages = [
    { role: 'user', content: prompt },
    { role: 'assistant', content: response.content },
  ];

  let rounds = 0;
  const maxRounds = 4;

  while (finalResponse.stop_reason === 'tool_use' && rounds < maxRounds) {
    // Check total time budget BETWEEN rounds
    if (Date.now() > TOTAL_DEADLINE) {
      console.warn('[research] Approaching timeout after', rounds, 'rounds,', Date.now() - startTime, 'ms. Forcing final answer.');
      messages.push({ role: 'user', content: [{ type: 'text', text: 'TIME LIMIT REACHED. Stop searching immediately and return the JSON brief with whatever data you have gathered so far.' }] });
      finalResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages,
      });
      messages.push({ role: 'assistant', content: finalResponse.content });
      break;
    }

    rounds++;

    const toolUseBlocks = finalResponse.content.filter(b => b.type === 'tool_use');
    const toolResults = toolUseBlocks.map(block => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content: 'Search completed. Continue analysis. Return the JSON brief when all searches are done.',
    }));

    messages.push({ role: 'user', content: toolResults });

    finalResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
      messages,
    });

    console.log('[research] Round', rounds, 'done in', Date.now() - startTime, 'ms total, stop_reason:', finalResponse.stop_reason);
    messages.push({ role: 'assistant', content: finalResponse.content });
  }

  console.log('[research] Completed in', rounds, 'rounds,', Date.now() - startTime, 'ms total');

  // Extract JSON from final text
  const textBlocks = finalResponse.content.filter(b => b.type === 'text');
  const fullText = textBlocks.map(b => b.text).join('\n');

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON brief in response. Raw: ' + fullText.substring(0, 500));
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    let cleaned = jsonMatch[0]
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x1F]+/g, ' ');
    return JSON.parse(cleaned);
  }
}

// ============================================================
// MAIN ROUTE HANDLER
// ============================================================
export async function POST(request) {
  try {
    const { clientId, locationId } = await request.json();

    if (!clientId || !locationId) {
      return Response.json(
        { error: 'clientId and locationId are required' },
        { status: 400 }
      );
    }

    const { client, location, settings } = await getContext(clientId, locationId);

    if (!client || !location) {
      return Response.json(
        { error: 'Client or location not found' },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const industryType = settings?.industry_type || null;

    // Get our stored Ahrefs keywords for this industry + client services
    const businessServices = settings?.business_services || [];
    const { serviceKeywords, topKeywords } = await getVerticalKeywords(
      supabase,
      industryType,
      businessServices
    );

    // Build city-specific search queries from our keyword data
    const city = location.address_city || client.address_city;
    const state = location.address_state || client.address_state;
    const searchQueries = buildSearchQueries(serviceKeywords, businessServices, city, state, industryType, client.company_name);

    // Mark as running
    await supabase
      .from('locations')
      .update({ research_status: 'running' })
      .eq('id', locationId);

    // Run Claude research with web search
    let keywordBrief;
    try {
      keywordBrief = await claudeResearch(
        client,
        location,
        settings,
        businessServices,
        serviceKeywords,
        topKeywords,
        searchQueries
      );
    } catch (err) {
      console.error('Research failed:', err);
      await supabase
        .from('locations')
        .update({ research_status: 'error' })
        .eq('id', locationId);
      return Response.json(
        { error: 'Research failed: ' + err.message },
        { status: 500 }
      );
    }

    // Enrich brief with our Ahrefs data
    const fullBrief = {
      ...keywordBrief,
      ahrefs_keywords: serviceKeywords.slice(0, 30).map(k => ({
        keyword: k.keyword,
        volume: k.search_volume,
        kd: k.keyword_difficulty,
        local_pack: k.serp_features?.includes('local_pack') || false,
      })),
      researched_at: new Date().toISOString(),
      industry: industryType,
      search_queries_used: searchQueries,
      city,
      state,
    };

    // Save to location
    await supabase
      .from('locations')
      .update({
        keyword_brief: fullBrief,
        research_status: 'complete',
        researched_at: new Date().toISOString(),
      })
      .eq('id', locationId);

    return Response.json({
      success: true,
      brief: fullBrief,
      keywords_used: serviceKeywords.length,
      searches_run: searchQueries.length,
    });
  } catch (err) {
    console.error('Research route error:', err);
    return Response.json(
      { error: 'Internal server error: ' + err.message },
      { status: 500 }
    );
  }
}

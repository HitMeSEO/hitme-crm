// lib/content-engine.js
// Shared utilities for content generation, quality scoring, and uniqueness detection

// ============================================================
// WRITING RULES (shared across all content types)
// ============================================================
export const WRITING_RULES = `
=== WRITING RULES (NON-NEGOTIABLE) ===
1. NEVER repeat the same credential, stat, or selling point more than once in the entire page. If you mention a specific number or fact in one section, do not mention it again anywhere.
2. Vary paragraph lengths — mix 2-line, 3-line, and 4-line paragraphs. Never have more than 3 paragraphs in a row that are the same length.
3. Vary sentence structure — mix short punchy sentences (5-8 words) with longer ones. Never start two consecutive sentences the same way.
4. No em dashes (—) anywhere in the content.
5. No one-sentence paragraphs anywhere in the body.
6. Do NOT use these AI-pattern phrases (ban list): "skilled and aggressive", "fight for your rights", "don't face this alone", "time is critical", "comprehensive defense strategy", "tailored to your specific", "unique combination of", "when it comes to", "in today's", "navigating the complexities"
7. After the first paragraph, the content should EDUCATE and INFORM — not pitch. The client name should appear naturally 3-4 times total across the whole page, not in every section.
8. FAQ answers: 2-3 sentences MAX. Short and direct. Do not repeat information already covered in the body content.
9. Write like a local expert talking to a neighbor. Use contractions. Be direct. Do not sound like a marketing brochure.
10. Each H2 section must use a DIFFERENT writing style — one might open with a short real-world example, another uses a list, another is conversational. Do NOT make every section follow the same explain-then-pitch pattern.

=== ANTI-AI DETECTION RULES ===
- Vary vocabulary — do not reuse the same adjective within 500 words of its first use.
- Use concrete specifics over vague claims. Write "23 years in business" not "decades of experience." Write specific street names, courthouse details, neighborhood names, local regulations — things only a local would know.
- Every claim must answer "why should the reader care?" — cut anything that doesn't.
- Write the way the business owner would talk, not the way a corporate brochure reads.

=== SELF-EDIT PASS (do this before returning) ===
After writing the full draft, run these five checks internally and fix any issues found:
1. Clarity sweep: Is every sentence immediately understandable on first read?
2. Voice sweep: Does it sound consistently human throughout, not AI-generated?
3. So-what sweep: Does every claim answer "why should the reader care?"
4. Specificity sweep: Replace any vague language ("many years", "great service") with concrete details.
5. Repetition check: Find and remove any point, fact, or credential mentioned more than once.

Return the FINAL EDITED version, not the first draft.`;

// ============================================================
// CONTEXT LOADING
// ============================================================
export async function getClientContext(supabase, clientId, locationId) {
  const [
    { data: client, error: clientError },
    { data: location, error: locationError },
    { data: settings },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('locations').select('*').eq('id', locationId).single(),
    supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle(),
  ]);

  if (clientError) console.error('[content-engine] client error:', clientError.message);
  if (locationError) console.error('[content-engine] location error:', locationError.message);

  return { client, location, settings };
}

// ============================================================
// VERTICAL KEYWORDS (extracted from research/route.js)
// ============================================================
export async function getVerticalKeywords(supabase, industryType, clientServices) {
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
    'tree service': ['tree_service_core'],
    'tree removal': ['tree_removal'],
    'stump grinding': ['stump_grinding'],
    'tree trimming': ['tree_trimming'],
    'roofing': ['roofing_core'],
    'roof repair': ['roof_repair'],
    'roof replacement': ['roof_replacement'],
    'hvac': ['hvac_core'],
    'ac repair': ['ac_repair'],
    'heating': ['heating'],
    'fencing': ['fencing_core'],
    'fence installation': ['fence_installation'],
    'paving': ['paving_core'],
    'asphalt': ['asphalt'],
    'moving': ['moving_core'],
    'local moving': ['local_moving'],
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

  matchedTypes.add('pricing');
  matchedTypes.add('question');

  const serviceKeywords = allKeywords.filter(
    k => matchedTypes.has(k.keyword_type) || matchedTypes.size === 0
  );

  const topKeywords = allKeywords.slice(0, 50);

  return { serviceKeywords: serviceKeywords.slice(0, 100), topKeywords };
}

// ============================================================
// PROMPT BUILDER: SERVICE LOCATION PAGE
// ============================================================
export function buildServicePagePrompt(client, location, settings, brief, targetService, variationConfig) {
  const city = location.address_city || client.address_city || '';
  const state = location.address_state || client.address_state || '';
  const phone = client.phone || '';
  const website = client.website || '';
  const mainKeyword = targetService || brief.primary_keyword || settings?.industry_type || 'services';

  const localDetails = brief.local_details || {};
  const localLines = [
    localDetails.county && `County: ${localDetails.county}`,
    localDetails.neighborhoods?.length && `Neighborhoods: ${localDetails.neighborhoods.join(', ')}`,
    localDetails.landmarks?.length && `Landmarks: ${localDetails.landmarks.join(', ')}`,
    localDetails.zip_codes?.length && `ZIP Codes: ${localDetails.zip_codes.join(', ')}`,
    localDetails.local_regulations?.length && `Local regulations: ${localDetails.local_regulations.join('; ')}`,
  ].filter(Boolean).join('\n');

  const competitorContext = (brief.competitor_analysis || [])
    .slice(0, 3)
    .map(c => `- ${c.title || c.url}: strengths: ${c.strengths || 'n/a'} | gap: ${c.gaps || 'n/a'}`)
    .join('\n');

  const questionsList = (brief.questions_to_answer || []).map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  const secondaryKws = (brief.secondary_keywords || []).join(', ');
  const requiredEntities = (brief.required_entities || []).join(', ');

  // Build service H3 list from CRM services (client_settings.business_services)
  const services = settings?.business_services || [];
  let serviceH3Block = '';
  if (services.length > 0) {
    const serviceLines = services.map((svc, i) => {
      const isOdd = i % 2 === 0; // 0-indexed, so 1st/3rd/5th are even indices
      const heading = isOdd ? `${svc} ${city}` : `${city} ${svc}`;
      return `  H3 ${i + 1}: ${heading}`;
    }).join('\n');
    serviceH3Block = `\nSERVICE H3 HEADINGS (pulled from CRM — use these EXACTLY):\n${serviceLines}`;
  }

  // Variation block for bulk generation
  const variationBlock = variationConfig ? buildVariationBlock(variationConfig) : '';

  return `You are an expert SEO content writer for local service businesses.

Write a complete service/location page. Return ONLY a valid JSON object — no markdown, no preamble, nothing outside the JSON.

=== CLIENT ===
Company: ${client.company_name}
Website: ${website}
Phone: ${phone}
City: ${city}, ${state}
Target Service: ${mainKeyword}
Industry: ${settings?.industry_type || 'local services'}
${settings?.trust_signals ? `Trust signals: ${settings.trust_signals}` : ''}
${settings?.brand_voice_notes ? `Brand voice: ${settings.brand_voice_notes}` : ''}
${variationBlock}
=== KEYWORD BRIEF ===
Primary Keyword: ${mainKeyword} ${city}
Secondary Keywords: ${secondaryKws}
Required Entities: ${requiredEntities}
Target Word Count: ${brief.target_word_count || 1200}
Content Angle: ${brief.content_angle || ''}

=== LOCAL DETAILS (use these throughout the content) ===
${localLines || 'None available — infer from city/state'}

=== COMPETITOR CONTEXT (do NOT copy, use for gap analysis) ===
${competitorContext || 'None available'}

=== PAGE HIERARCHY (MANDATORY — follow this EXACT structure) ===

META TITLE: "${city}, ${state} ${mainKeyword} – ${client.company_name}" (max 60 chars)

H1: "${city}, ${state} ${mainKeyword}"
  The H1 is city-first. This is the primary geo+keyword signal.

H2: "${mainKeyword} in ${city}, ${state}" (INVERSE of H1 — keyword comes first)
  The H2 flips the H1. If H1 is "Charlotte, NC Roofing" then H2 is "Roofing Services in Charlotte, NC"

INTRO (2 paragraphs under the H2, BEFORE any H3 sections):
  Paragraph 1: About the SUBJECT MATTER, not the company. If it's roofing, talk about roofing — the pain points a reader searching for this service is experiencing. What goes wrong, what they're worried about, what they need. Professional, informational, no fluff. Touch the reader's situation directly.
  Paragraph 2: Present ${client.company_name} as the solution to those pain points. Link the company name: <a href="${website}">${client.company_name}</a>. Mention trust signals (bonded, insured, years in business, etc.) naturally. This is the ONLY paragraph that sells — everything else educates.

H3 SERVICE SECTIONS (one per service from the CRM):${serviceH3Block || `
  Pull from the client's service list. Alternate geo placement:
  * Odd sections (1st, 3rd, 5th): H3 = "[Service] [City]"
  * Even sections (2nd, 4th, 6th): H3 = "[City] [Service]"`}
  Each H3 section has exactly 2 paragraphs (max 4 lines each):
  - Paragraph 1: Educate the reader about this specific service. What it involves, when it's needed, what to expect. Borderline informational — explain the service properly.
  - Paragraph 2: Subtly connect back to the company's capability for this service. Mention a specific detail (equipment, process, certification) that builds credibility. Do NOT repeat trust signals from the intro.

FAQ SECTION: Comes AFTER all H3 service sections, BEFORE "Why Choose"
  * Use <div class="h2-style">${mainKeyword} FAQs</div> as the header
  * Use <h4>Question?</h4> for each question
  * Use <p>Answer</p> for each answer (2-3 sentences max)
  * Include 3-5 FAQs:
${questionsList || '  Write 3-5 relevant FAQs for this service in this city'}

WHY CHOOSE section: Final section
  * H2: "Why Choose ${client.company_name}"
  * 2-3 paragraphs building trust, referencing the community

=== WRITING TONE ===
- Professional, no fluff, borderline informational
- Explain the service properly to the reader — educate them
- Subtly sell the service through expertise, not hype
- Write like a knowledgeable local professional, not a marketing brochure
- The content should make the reader feel informed and confident, not sold to
- After the intro, the company name should appear naturally 3-4 more times total, not in every section

=== SEO RULES ===
- Meta description: max 160 chars, include a CTA like "Call today" or "Get a free quote", no pipes (|)
- Weave in secondary keywords and local details (neighborhoods, landmarks, county) in the first half
- Target exactly ${brief.target_word_count || 1200} words in body_html
- No DIY advice or tips for doing it yourself
- Output valid HTML using only: p, h2, h3, h4, div, ul, li, strong, em, a tags
- URL slug: lowercase, hyphens only, no "the", no special characters, 3-6 words
${WRITING_RULES}

Return this exact JSON structure:
{
  "title_tag": "...",
  "meta_description": "...",
  "h1": "...",
  "url_slug": "...",
  "body_html": "..."
}`;
}

// ============================================================
// VARIATION BLOCK (for bulk generation uniqueness)
// ============================================================
const OPENING_STYLES = [
  'Lead with a specific local problem or pain point that residents of this city face. Be concrete — mention a real scenario.',
  'Lead with a reference to a specific neighborhood, landmark, or area characteristic. Make the reader feel like you know their city.',
  'Lead with a seasonal or timely angle — what time of year makes this service most relevant in this area?',
  'Lead with a brief customer-story angle — describe a common situation a customer might be in when they need this service.',
];

export function buildVariationBlock({ variationIndex, totalPages, previousSnippets, contentRestrictions }) {
  const openingStyle = OPENING_STYLES[variationIndex % OPENING_STYLES.length];

  let block = `
=== VARIATION INSTRUCTIONS (THIS PAGE IS ${variationIndex + 1} OF ${totalPages}) ===
OPENING STYLE: ${openingStyle}
SERVICE SECTION ORDER: Start with service section #${(variationIndex % 5) + 1} from the H2 list, then cycle through the rest. Do NOT start with the same service as other pages.
FAQ EMPHASIS: Focus your FAQs on question set starting from question #${(variationIndex % 3) + 1} in the list. Add 1 question specific to THIS city that wouldn't apply to other cities.
LOCAL DETAIL EMPHASIS: ${variationIndex % 2 === 0 ? 'Emphasize neighborhoods and zip codes in your local references.' : 'Emphasize landmarks and county references in your local details.'}
`;

  if (previousSnippets && previousSnippets.length > 0) {
    block += `
=== ANTI-DUPLICATION (CRITICAL) ===
These pages already exist for this client. Your page MUST use different opening sentences, different examples, different local details, and a different structure order:
${previousSnippets.map((s, i) => `Page ${i + 1}: "${s}"`).join('\n')}
Do NOT reuse any of these openings or examples. Write something genuinely different.
`;
  }

  if (contentRestrictions) {
    block += `
=== CONTENT RESTRICTIONS (NEVER VIOLATE) ===
${contentRestrictions}
`;
  }

  return block;
}

// ============================================================
// QUALITY SCORING
// ============================================================
export function calculateWordCount(html) {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(w => w.length > 0).length;
}

export function calculateKeywordCoverage(html, brief) {
  if (!html || !brief) return { primary: 0, secondary_hit: [], secondary_miss: [] };

  const text = html.toLowerCase().replace(/<[^>]+>/g, ' ');
  const primaryKw = (brief.primary_keyword || '').toLowerCase();

  // Count primary keyword occurrences
  let primaryCount = 0;
  if (primaryKw) {
    const regex = new RegExp(primaryKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    primaryCount = (text.match(regex) || []).length;
  }

  // Check secondary keywords
  const secondaryHit = [];
  const secondaryMiss = [];
  for (const kw of (brief.secondary_keywords || [])) {
    const kwLower = kw.toLowerCase();
    if (text.includes(kwLower)) {
      secondaryHit.push(kw);
    } else {
      secondaryMiss.push(kw);
    }
  }

  return { primary: primaryCount, secondary_hit: secondaryHit, secondary_miss: secondaryMiss };
}

// 5-gram uniqueness scoring (adapted from Pam's HTML tool)
export function calculateUniquenessScore(html, siblingHtmlArray) {
  if (!html || !siblingHtmlArray || siblingHtmlArray.length === 0) return 100;

  const getNgrams = (text, n) => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const ngrams = new Set();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  };

  const text = html.replace(/<[^>]+>/g, ' ');
  const myNgrams = getNgrams(text, 5);

  if (myNgrams.size === 0) return 100;

  // Compare against all siblings, take worst (highest overlap) score
  let worstOverlap = 0;

  for (const siblingHtml of siblingHtmlArray) {
    const sibText = siblingHtml.replace(/<[^>]+>/g, ' ');
    const sibNgrams = getNgrams(sibText, 5);

    let common = 0;
    for (const ng of myNgrams) {
      if (sibNgrams.has(ng)) common++;
    }

    const smaller = Math.min(myNgrams.size, sibNgrams.size);
    const overlapPct = smaller === 0 ? 0 : (common / smaller) * 100;
    if (overlapPct > worstOverlap) worstOverlap = overlapPct;
  }

  // Score is inverse of overlap: 0% overlap = 100 score, 100% overlap = 0 score
  return Math.round(100 - worstOverlap);
}

// ============================================================
// SCHEMA GENERATION (extracted from generate/route.js)
// ============================================================
export function buildSchemaJson(client, location, settings, bodyHtml) {
  const city = location.address_city || client.address_city || '';
  const state = location.address_state || client.address_state || '';

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${client.website || ''}#${city.toLowerCase().replace(/\s+/g, '-')}`,
    name: client.company_name,
    url: client.website || '',
    telephone: client.phone || '',
    address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: state },
    areaServed: { '@type': 'City', name: city },
  };
  if (client.gbp_rating && client.gbp_review_count) {
    localBusiness.aggregateRating = { '@type': 'AggregateRating', ratingValue: client.gbp_rating, reviewCount: client.gbp_review_count };
  }
  if (client.gbp_maps_url) localBusiness.sameAs = [client.gbp_maps_url];
  const svcList = settings?.business_services || [];
  if (svcList.length > 0) {
    localBusiness.hasOfferCatalog = {
      '@type': 'OfferCatalog', name: 'Services',
      itemListElement: svcList.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })),
    };
  }

  // Extract FAQ from body_html
  let faqSchema = null;
  const faqRegex = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
  const faqItems = [];
  let faqMatch;
  while ((faqMatch = faqRegex.exec(bodyHtml)) !== null) {
    faqItems.push({ '@type': 'Question', name: faqMatch[1].trim(), acceptedAnswer: { '@type': 'Answer', text: faqMatch[2].replace(/<[^>]+>/g, '').trim() } });
  }
  if (faqItems.length > 0) {
    faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems };
  }

  return { localBusiness, faq: faqSchema };
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

// Directory registry
const CORE_DIRECTORIES = [
  { key: 'google', label: 'Google Business Profile', category: 'core', claimUrl: 'https://business.google.com/create' },
  { key: 'yelp', label: 'Yelp', category: 'core', claimUrl: 'https://business.yelp.com/' },
  { key: 'bbb', label: 'Better Business Bureau', category: 'core', claimUrl: 'https://www.bbb.org/get-listed' },
  { key: 'apple_maps', label: 'Apple Maps', category: 'core', claimUrl: 'https://mapsconnect.apple.com/' },
  { key: 'facebook', label: 'Facebook', category: 'core', claimUrl: 'https://www.facebook.com/pages/create/' },
  { key: 'bing_places', label: 'Bing Places', category: 'core', claimUrl: 'https://www.bingplaces.com/' },
  { key: 'yellowpages', label: 'YellowPages', category: 'core', claimUrl: 'https://adsolutions.yp.com/free-listing' },
  { key: 'foursquare', label: 'Foursquare', category: 'core', claimUrl: 'https://business.foursquare.com/claim' },
  { key: 'mapquest', label: 'MapQuest', category: 'core', claimUrl: 'https://www.mapquest.com/my-business' },
  { key: 'hotfrog', label: 'Hotfrog', category: 'core', claimUrl: 'https://www.hotfrog.com/add-your-business' },
  { key: 'manta', label: 'Manta', category: 'core', claimUrl: 'https://www.manta.com/claim' },
  { key: 'superpages', label: 'Superpages', category: 'core', claimUrl: 'https://adsolutions.yp.com/free-listing' },
  { key: 'nextdoor', label: 'Nextdoor', category: 'core', claimUrl: 'https://business.nextdoor.com/claim' },
  { key: 'thumbtack', label: 'Thumbtack', category: 'core', claimUrl: 'https://www.thumbtack.com/pro/' },
];

// Home services keyword list (shared across many directories)
const HOME_SVC = ['home services', 'plumbing', 'hvac', 'electrical', 'roofing', 'landscaping', 'construction', 'contractor', 'handyman', 'cleaning', 'tree service', 'tree removal', 'tree care', 'lawn', 'pest control', 'painting', 'fencing', 'moving', 'junk removal', 'junk hauling', 'hauling', 'dumpster', 'dumpster rental', 'demolition', 'paving', 'asphalt', 'concrete', 'sealcoating', 'pressure washing', 'power washing', 'gutter', 'siding', 'window', 'garage door', 'flooring', 'remodeling', 'renovation'];

const INDUSTRY_DIRECTORIES = [
  // === HOME SERVICES (your core clients) ===
  { key: 'angi', label: 'Angi', category: 'industry', claimUrl: 'https://www.angi.com/pro/', industries: HOME_SVC },
  { key: 'homeadvisor', label: 'HomeAdvisor', category: 'industry', claimUrl: 'https://pro.homeadvisor.com/', industries: HOME_SVC },
  { key: 'houzz', label: 'Houzz', category: 'industry', claimUrl: 'https://www.houzz.com/professionals', industries: [...HOME_SVC, 'interior design', 'architecture'] },
  { key: 'porch', label: 'Porch', category: 'industry', claimUrl: 'https://pro.porch.com/signup', industries: HOME_SVC },
  { key: 'bark', label: 'Bark', category: 'industry', claimUrl: 'https://www.bark.com/en/us/pro-signup/', industries: HOME_SVC },
  { key: 'taskrabbit', label: 'TaskRabbit', category: 'industry', claimUrl: 'https://www.taskrabbit.com/become-a-tasker', industries: ['handyman', 'moving', 'cleaning', 'junk removal', 'junk hauling', 'hauling', 'home services', 'furniture assembly'] },
  { key: 'networx', label: 'Networx', category: 'industry', claimUrl: 'https://www.networx.com/contractors', industries: HOME_SVC },
  { key: 'buildzoom', label: 'BuildZoom', category: 'industry', claimUrl: 'https://www.buildzoom.com/contractor/claim', industries: ['construction', 'contractor', 'remodeling', 'renovation', 'roofing', 'fencing', 'paving', 'concrete', 'demolition'] },
  { key: 'homeservices_com', label: 'HomeServices.com', category: 'industry', claimUrl: 'https://www.homeservices.com/', industries: HOME_SVC },

  // === DUMPSTER / JUNK / HAULING / MOVING ===
  { key: 'hometown_dumpster', label: 'Hometown Dumpster Rental', category: 'industry', claimUrl: 'https://www.hometowndumpsterrental.com/haulers', industries: ['dumpster', 'dumpster rental', 'junk removal', 'junk hauling', 'hauling', 'demolition'] },
  { key: 'dumpsters_com', label: 'Dumpsters.com', category: 'industry', claimUrl: 'https://www.dumpsters.com/partners', industries: ['dumpster', 'dumpster rental', 'junk removal', 'demolition'] },
  { key: 'junk_king', label: 'Junk King (franchise check)', category: 'industry', claimUrl: 'https://www.junk-king.com/', industries: ['junk removal', 'junk hauling', 'hauling'] },
  { key: 'moving_com', label: 'Moving.com', category: 'industry', claimUrl: 'https://www.moving.com/movers/list-your-company/', industries: ['moving', 'moving company', 'hauling', 'junk removal'] },
  { key: 'uhaul_marketplace', label: 'U-Haul Moving Help', category: 'industry', claimUrl: 'https://www.movinghelp.com/become-a-mover', industries: ['moving', 'moving company', 'hauling'] },
  { key: 'hire_a_helper', label: 'HireAHelper', category: 'industry', claimUrl: 'https://www.hireahelper.com/moving-companies/signup/', industries: ['moving', 'moving company', 'hauling', 'junk removal'] },
  { key: 'unpakt', label: 'Unpakt', category: 'industry', claimUrl: 'https://www.unpakt.com/movers/signup', industries: ['moving', 'moving company'] },
  { key: 'movingauthority', label: 'Moving Authority (FMCSA)', category: 'industry', claimUrl: 'https://www.movingauthority.com/', industries: ['moving', 'moving company'] },

  // === ROOFING / PAVING / FENCING / HVAC ===
  { key: 'gaf_roofer', label: 'GAF Roofer Directory', category: 'industry', claimUrl: 'https://www.gaf.com/en-us/for-professionals', industries: ['roofing'] },
  { key: 'owens_corning', label: 'Owens Corning Contractor', category: 'industry', claimUrl: 'https://www.owenscorning.com/en-us/roofing/contractors', industries: ['roofing'] },
  { key: 'certainteed', label: 'CertainTeed Contractor', category: 'industry', claimUrl: 'https://www.certainteed.com/find-a-pro/', industries: ['roofing', 'siding', 'fencing'] },
  { key: 'nrca', label: 'NRCA Member Directory', category: 'industry', claimUrl: 'https://www.nrca.net/membership', industries: ['roofing'] },
  { key: 'hvac_com', label: 'HVAC.com', category: 'industry', claimUrl: 'https://www.hvac.com/contractors/', industries: ['hvac', 'heating', 'cooling', 'air conditioning'] },
  { key: 'carrier', label: 'Carrier Dealer Locator', category: 'industry', claimUrl: 'https://www.carrier.com/residential/en/us/for-dealers/', industries: ['hvac', 'heating', 'cooling', 'air conditioning'] },
  { key: 'trane', label: 'Trane Dealer Locator', category: 'industry', claimUrl: 'https://www.trane.com/residential/en/for-dealers/', industries: ['hvac', 'heating', 'cooling'] },
  { key: 'lennox', label: 'Lennox Dealer Locator', category: 'industry', claimUrl: 'https://www.lennox.com/dealers/become-a-dealer', industries: ['hvac', 'heating', 'cooling'] },
  { key: 'expertise_com', label: 'Expertise.com', category: 'industry', claimUrl: 'https://www.expertise.com/claim', industries: HOME_SVC },
  { key: 'concrete_network', label: 'ConcreteNetwork.com', category: 'industry', claimUrl: 'https://www.concretenetwork.com/contractors/', industries: ['concrete', 'paving', 'asphalt', 'sealcoating', 'driveway'] },

  // === GENERAL SERVICE DIRECTORIES ===
  { key: 'bni', label: 'BNI Member Directory', category: 'industry', claimUrl: 'https://www.bni.com/find-a-chapter', industries: HOME_SVC },
  { key: 'alignable', label: 'Alignable', category: 'industry', claimUrl: 'https://www.alignable.com/biz/signup', industries: HOME_SVC },
  { key: 'local_com', label: 'Local.com', category: 'industry', claimUrl: 'https://www.local.com/business/claim', industries: HOME_SVC },
  { key: 'chamberofcommerce', label: 'ChamberOfCommerce.com', category: 'industry', claimUrl: 'https://www.chamberofcommerce.com/add-business', industries: HOME_SVC },
  { key: 'merchantcircle', label: 'MerchantCircle', category: 'industry', claimUrl: 'https://www.merchantcircle.com/signup', industries: HOME_SVC },
  { key: 'brownbook', label: 'Brownbook', category: 'industry', claimUrl: 'https://www.brownbook.net/business/add/', industries: HOME_SVC },
  { key: 'cylex', label: 'Cylex', category: 'industry', claimUrl: 'https://www.cylex.us.com/add-company.html', industries: HOME_SVC },
  { key: 'ezlocal', label: 'EZlocal', category: 'industry', claimUrl: 'https://www.ezlocal.com/claim', industries: HOME_SVC },
  { key: 'showmelocal', label: 'ShowMeLocal', category: 'industry', claimUrl: 'https://www.showmelocal.com/AddBusiness.aspx', industries: HOME_SVC },

  // === DATA AGGREGATORS (feed dozens of smaller directories) ===
  { key: 'data_axle', label: 'Data Axle (Infogroup)', category: 'industry', claimUrl: 'https://www.data-axle.com/business-listings/', industries: HOME_SVC },
  { key: 'neustar_localeze', label: 'Neustar Localeze', category: 'industry', claimUrl: 'https://www.neustarlocaleze.biz/directory/add-business/', industries: HOME_SVC },
  { key: 'factual', label: 'Factual (Foursquare Data)', category: 'industry', claimUrl: 'https://location.foursquare.com/products/data-enrichment/', industries: HOME_SVC },

  // === MEDICAL ===
  { key: 'healthgrades', label: 'Healthgrades', category: 'industry', claimUrl: 'https://update.healthgrades.com/', industries: ['medical', 'healthcare', 'dental', 'dentist', 'doctor', 'physician', 'clinic', 'hospital', 'optometry', 'chiropractic'] },
  { key: 'zocdoc', label: 'Zocdoc', category: 'industry', claimUrl: 'https://www.zocdoc.com/join', industries: ['medical', 'healthcare', 'dental', 'dentist', 'doctor', 'physician', 'clinic', 'therapy'] },

  // === LEGAL ===
  { key: 'avvo', label: 'Avvo', category: 'industry', claimUrl: 'https://www.avvo.com/claim-your-profile', industries: ['legal', 'lawyer', 'attorney', 'law firm', 'law'] },
  { key: 'findlaw', label: 'FindLaw', category: 'industry', claimUrl: 'https://www.findlaw.com/lawyer/claim-profile.html', industries: ['legal', 'lawyer', 'attorney', 'law firm', 'law'] },

  // === FOOD / HOSPITALITY ===
  { key: 'tripadvisor', label: 'TripAdvisor', category: 'industry', claimUrl: 'https://www.tripadvisor.com/Owners', industries: ['restaurant', 'food', 'hospitality', 'hotel', 'travel', 'tourism', 'bar', 'cafe'] },
  { key: 'opentable', label: 'OpenTable', category: 'industry', claimUrl: 'https://restaurant.opentable.com/get-started/', industries: ['restaurant', 'food', 'dining', 'bar', 'cafe'] },

  // === AUTOMOTIVE ===
  { key: 'carfax', label: 'Carfax', category: 'industry', claimUrl: 'https://www.carfaxforDealers.com/', industries: ['automotive', 'auto repair', 'car dealer', 'mechanic', 'auto body'] },

  // === REAL ESTATE ===
  { key: 'zillow', label: 'Zillow', category: 'industry', industries: ['real estate', 'realtor', 'property management', 'mortgage'] },
];

function getDirectories(client) {
  const dirs = [...CORE_DIRECTORIES];

  // Build a search string from industry + services
  const parts = [client.industry_type || ''];
  if (Array.isArray(client.business_services)) {
    parts.push(...client.business_services.map(s => s.label || s.name || String(s)));
  }
  const searchText = parts.join(' ').toLowerCase();

  if (!searchText.trim()) return dirs;

  for (const d of INDUSTRY_DIRECTORIES) {
    if (d.industries.some(i => searchText.includes(i) || i.split(' ').every(w => searchText.includes(w)))) {
      dirs.push(d);
    }
  }
  return dirs;
}

const SYSTEM_PROMPT = `You are a local SEO citation expert analyzing NAP (Name, Address, Phone) consistency across business directories.

You will be given a business's correct NAP and a list of directories. Use the web_search tool to check EACH directory for the business listing. Search for the business name + directory name (e.g., "Beckett Siteworx BBB" or "Beckett Siteworx Yelp").

Return ONLY valid JSON. No markdown, no backticks, no explanation.

Return this structure:
{
  "citations": [
    {
      "directory": "<directory key>",
      "status": "found_correct" | "found_inconsistent" | "not_found",
      "name_match": true | false | null,
      "address_match": true | false | null,
      "phone_match": true | false | null,
      "url_match": true | false | null,
      "found_name": "<name found or null>",
      "found_address": "<address found or null>",
      "found_phone": "<phone found or null>",
      "found_url": "<url found or null>",
      "listing_url": "<actual URL of the listing if found, or null>",
      "notes": "<brief note>"
    }
  ]
}

Rules:
- "found_correct": Business IS listed with matching NAP (you found their actual listing page)
- "found_inconsistent": Business IS listed but NAP has discrepancies (old address, wrong phone, abbreviations, different business name spelling, etc.)
- "not_found": Business is NOT listed — you searched and confirmed no listing exists
- IMPORTANT: If a business has a listing on a directory, the status MUST be "found_correct" or "found_inconsistent", NEVER "not_found". Only use "not_found" when you are confident no listing exists.
- For "listing_url", provide the ACTUAL URL of the listing page if you find one (e.g., the direct BBB profile URL, the Yelp business page URL). This is critical — Pam needs the real link, not a generic claim URL.
- Be thorough: search each directory individually. Do not guess.`;

// GET — fetch latest audit for a client
export async function GET(request) {
  const supabase = await createClient();
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { data: audit } = await supabase
    .from('citation_audits')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) return NextResponse.json(null);

  const { data: citations } = await supabase
    .from('citations')
    .select('*')
    .eq('audit_id', audit.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ ...audit, citations: citations || [] });
}

// POST — run citation audit (multi-step)
export async function POST(request) {
  const supabase = await createClient();
  const body = await request.json();
  const { clientId, step, auditId } = body;

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  // Get client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const directories = getDirectories(client);
  const batchSize = 5;
  const totalSteps = Math.ceil(directories.length / batchSize);

  // Step 0: create audit
  if (step === 0) {
    const { data: audit, error } = await supabase
      .from('citation_audits')
      .insert({ client_id: clientId, status: 'running' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ auditId: audit.id, totalSteps, totalDirectories: directories.length });
  }

  if (!auditId) return NextResponse.json({ error: 'auditId required' }, { status: 400 });

  // Run batch
  const batchStart = (step - 1) * batchSize;
  const batch = directories.slice(batchStart, batchStart + batchSize);

  const fullAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(', ');
  const context = `Business NAP (correct info):
- Name: ${client.company_name}
- Address: ${fullAddress || 'not provided'}
- Phone: ${client.phone || 'not provided'}
- Website: ${client.website || 'not provided'}
- Industry: ${client.industry_type || 'not provided'}`;

  const dirList = batch.map(d => `- ${d.key} (${d.label}) [${d.category}]`).join('\n');

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build search queries for Claude to use
    const searchInstructions = batch.map(d =>
      `Search for: "${client.company_name} ${d.label}" to find their listing on ${d.label}. If not found, also try "${client.company_name} ${client.city || ''} ${d.label}".`
    ).join('\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search', name: 'web_search' }],
      messages: [{ role: 'user', content: `${context}\n\nCheck these directories:\n${dirList}\n\n${searchInstructions}\n\nSearch each directory, then return JSON with one entry per directory. Include the actual listing URL if found.` }],
    });

    // Extract text from response (may have multiple rounds with web_search)
    // If stop_reason is 'tool_use', we need to continue the conversation
    let messages = [{ role: 'user', content: `${context}\n\nCheck these directories:\n${dirList}\n\n${searchInstructions}\n\nSearch each directory, then return JSON with one entry per directory. Include the actual listing URL if found.` }];
    let currentMsg = msg;
    let maxRounds = 12; // Up to 12 search rounds

    while (currentMsg.stop_reason === 'tool_use' && maxRounds > 0) {
      maxRounds--;
      // Add assistant response and tool results
      messages.push({ role: 'assistant', content: currentMsg.content });
      const toolUseBlocks = currentMsg.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUseBlocks.map(b => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: '', // web_search results are auto-handled by the API
      }));
      messages.push({ role: 'user', content: toolResults });

      currentMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search', name: 'web_search' }],
        messages,
      });
    }

    let text = currentMsg.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    // Find the JSON in the text (might have explanation text around it)
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(text);

    // Insert citations
    for (const c of parsed.citations) {
      const dirDef = batch.find(d => d.key === c.directory);
      if (!dirDef) continue;

      await supabase.from('citations').insert({
        audit_id: auditId,
        client_id: clientId,
        directory: c.directory,
        directory_label: dirDef.label,
        category: dirDef.category,
        status: c.status,
        name_match: c.name_match,
        address_match: c.address_match,
        phone_match: c.phone_match,
        url_match: c.url_match,
        found_name: c.found_name,
        found_address: c.found_address,
        found_phone: c.found_phone,
        found_url: c.found_url,
        listing_url: c.listing_url,
        claim_url: dirDef.claimUrl || null,
        notes: c.notes,
      });
    }

    const done = step === totalSteps;

    // If done, calculate totals
    if (done) {
      const { data: allCitations } = await supabase
        .from('citations')
        .select('status')
        .eq('audit_id', auditId);

      const total = allCitations?.length || 0;
      const correct = allCitations?.filter(c => c.status === 'found_correct').length || 0;
      const inconsistent = allCitations?.filter(c => c.status === 'found_inconsistent').length || 0;
      const missing = allCitations?.filter(c => c.status === 'not_found').length || 0;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;

      await supabase.from('citation_audits').update({
        status: 'complete',
        total_found: correct + inconsistent,
        total_correct: correct,
        total_inconsistent: inconsistent,
        total_missing: missing,
        health_score: score,
      }).eq('id', auditId);
    }

    return NextResponse.json({ step, done });
  } catch (err) {
    console.error('Citation audit step failed:', err);
    await supabase.from('citation_audits').update({ status: 'error' }).eq('id', auditId);
    return NextResponse.json({ error: 'Step failed' }, { status: 500 });
  }
}

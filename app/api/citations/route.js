import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// Directory registry
const CORE_DIRECTORIES = [
  { key: 'google', label: 'Google Business Profile', category: 'core' },
  { key: 'yelp', label: 'Yelp', category: 'core' },
  { key: 'bbb', label: 'Better Business Bureau', category: 'core' },
  { key: 'apple_maps', label: 'Apple Maps', category: 'core' },
  { key: 'facebook', label: 'Facebook', category: 'core' },
  { key: 'bing_places', label: 'Bing Places', category: 'core' },
  { key: 'yellowpages', label: 'YellowPages', category: 'core' },
  { key: 'foursquare', label: 'Foursquare', category: 'core' },
  { key: 'mapquest', label: 'MapQuest', category: 'core' },
  { key: 'hotfrog', label: 'Hotfrog', category: 'core' },
  { key: 'manta', label: 'Manta', category: 'core' },
  { key: 'superpages', label: 'Superpages', category: 'core' },
  { key: 'nextdoor', label: 'Nextdoor', category: 'core' },
  { key: 'thumbtack', label: 'Thumbtack', category: 'core' },
];

// Home services keyword list (shared across many directories)
const HOME_SVC = ['home services', 'plumbing', 'hvac', 'electrical', 'roofing', 'landscaping', 'construction', 'contractor', 'handyman', 'cleaning', 'tree service', 'tree removal', 'tree care', 'lawn', 'pest control', 'painting', 'fencing', 'moving', 'junk removal', 'junk hauling', 'hauling', 'dumpster', 'dumpster rental', 'demolition', 'paving', 'asphalt', 'concrete', 'sealcoating', 'pressure washing', 'power washing', 'gutter', 'siding', 'window', 'garage door', 'flooring', 'remodeling', 'renovation'];

const INDUSTRY_DIRECTORIES = [
  // === HOME SERVICES (your core clients) ===
  { key: 'angi', label: 'Angi', category: 'industry', industries: HOME_SVC },
  { key: 'homeadvisor', label: 'HomeAdvisor', category: 'industry', industries: HOME_SVC },
  { key: 'houzz', label: 'Houzz', category: 'industry', industries: [...HOME_SVC, 'interior design', 'architecture'] },
  { key: 'porch', label: 'Porch', category: 'industry', industries: HOME_SVC },
  { key: 'bark', label: 'Bark', category: 'industry', industries: HOME_SVC },
  { key: 'taskrabbit', label: 'TaskRabbit', category: 'industry', industries: ['handyman', 'moving', 'cleaning', 'junk removal', 'junk hauling', 'hauling', 'home services', 'furniture assembly'] },
  { key: 'networx', label: 'Networx', category: 'industry', industries: HOME_SVC },
  { key: 'buildzoom', label: 'BuildZoom', category: 'industry', industries: ['construction', 'contractor', 'remodeling', 'renovation', 'roofing', 'fencing', 'paving', 'concrete', 'demolition'] },
  { key: 'homeservices_com', label: 'HomeServices.com', category: 'industry', industries: HOME_SVC },

  // === DUMPSTER / JUNK / HAULING / MOVING ===
  { key: 'hometown_dumpster', label: 'Hometown Dumpster Rental', category: 'industry', industries: ['dumpster', 'dumpster rental', 'junk removal', 'junk hauling', 'hauling', 'demolition'] },
  { key: 'dumpsters_com', label: 'Dumpsters.com', category: 'industry', industries: ['dumpster', 'dumpster rental', 'junk removal', 'demolition'] },
  { key: 'junk_king', label: 'Junk King (franchise check)', category: 'industry', industries: ['junk removal', 'junk hauling', 'hauling'] },
  { key: 'moving_com', label: 'Moving.com', category: 'industry', industries: ['moving', 'moving company', 'hauling', 'junk removal'] },
  { key: 'uhaul_marketplace', label: 'U-Haul Moving Help', category: 'industry', industries: ['moving', 'moving company', 'hauling'] },
  { key: 'hire_a_helper', label: 'HireAHelper', category: 'industry', industries: ['moving', 'moving company', 'hauling', 'junk removal'] },
  { key: 'unpakt', label: 'Unpakt', category: 'industry', industries: ['moving', 'moving company'] },
  { key: 'movingauthority', label: 'Moving Authority (FMCSA)', category: 'industry', industries: ['moving', 'moving company'] },

  // === ROOFING / PAVING / FENCING / HVAC ===
  { key: 'gaf_roofer', label: 'GAF Roofer Directory', category: 'industry', industries: ['roofing'] },
  { key: 'owens_corning', label: 'Owens Corning Contractor', category: 'industry', industries: ['roofing'] },
  { key: 'certainteed', label: 'CertainTeed Contractor', category: 'industry', industries: ['roofing', 'siding', 'fencing'] },
  { key: 'nrca', label: 'NRCA Member Directory', category: 'industry', industries: ['roofing'] },
  { key: 'hvac_com', label: 'HVAC.com', category: 'industry', industries: ['hvac', 'heating', 'cooling', 'air conditioning'] },
  { key: 'carrier', label: 'Carrier Dealer Locator', category: 'industry', industries: ['hvac', 'heating', 'cooling', 'air conditioning'] },
  { key: 'trane', label: 'Trane Dealer Locator', category: 'industry', industries: ['hvac', 'heating', 'cooling'] },
  { key: 'lennox', label: 'Lennox Dealer Locator', category: 'industry', industries: ['hvac', 'heating', 'cooling'] },
  { key: 'expertise_com', label: 'Expertise.com', category: 'industry', industries: HOME_SVC },
  { key: 'concrete_network', label: 'ConcreteNetwork.com', category: 'industry', industries: ['concrete', 'paving', 'asphalt', 'sealcoating', 'driveway'] },

  // === GENERAL SERVICE DIRECTORIES ===
  { key: 'bni', label: 'BNI Member Directory', category: 'industry', industries: HOME_SVC },
  { key: 'alignable', label: 'Alignable', category: 'industry', industries: HOME_SVC },
  { key: 'local_com', label: 'Local.com', category: 'industry', industries: HOME_SVC },
  { key: 'chamberofcommerce', label: 'ChamberOfCommerce.com', category: 'industry', industries: HOME_SVC },
  { key: 'merchantcircle', label: 'MerchantCircle', category: 'industry', industries: HOME_SVC },
  { key: 'brownbook', label: 'Brownbook', category: 'industry', industries: HOME_SVC },
  { key: 'cylex', label: 'Cylex', category: 'industry', industries: HOME_SVC },
  { key: 'ezlocal', label: 'EZlocal', category: 'industry', industries: HOME_SVC },
  { key: 'showmelocal', label: 'ShowMeLocal', category: 'industry', industries: HOME_SVC },

  // === DATA AGGREGATORS (feed dozens of smaller directories) ===
  { key: 'data_axle', label: 'Data Axle (Infogroup)', category: 'industry', industries: HOME_SVC },
  { key: 'neustar_localeze', label: 'Neustar Localeze', category: 'industry', industries: HOME_SVC },
  { key: 'factual', label: 'Factual (Foursquare Data)', category: 'industry', industries: HOME_SVC },

  // === MEDICAL (kept for flexibility) ===
  { key: 'healthgrades', label: 'Healthgrades', category: 'industry', industries: ['medical', 'healthcare', 'dental', 'dentist', 'doctor', 'physician', 'clinic', 'hospital', 'optometry', 'chiropractic'] },
  { key: 'zocdoc', label: 'Zocdoc', category: 'industry', industries: ['medical', 'healthcare', 'dental', 'dentist', 'doctor', 'physician', 'clinic', 'therapy'] },

  // === LEGAL ===
  { key: 'avvo', label: 'Avvo', category: 'industry', industries: ['legal', 'lawyer', 'attorney', 'law firm', 'law'] },
  { key: 'findlaw', label: 'FindLaw', category: 'industry', industries: ['legal', 'lawyer', 'attorney', 'law firm', 'law'] },

  // === FOOD / HOSPITALITY ===
  { key: 'tripadvisor', label: 'TripAdvisor', category: 'industry', industries: ['restaurant', 'food', 'hospitality', 'hotel', 'travel', 'tourism', 'bar', 'cafe'] },
  { key: 'opentable', label: 'OpenTable', category: 'industry', industries: ['restaurant', 'food', 'dining', 'bar', 'cafe'] },

  // === AUTOMOTIVE ===
  { key: 'carfax', label: 'Carfax', category: 'industry', industries: ['automotive', 'auto repair', 'car dealer', 'mechanic', 'auto body'] },

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

You will be given a business's correct NAP and a list of directories. Based on your knowledge of the business and its web presence, assess whether they are likely listed on each directory and whether NAP is consistent.

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
      "listing_url": "<likely listing URL or null>",
      "notes": "<brief note>"
    }
  ]
}

Rules:
- "found_correct": Business likely listed with matching NAP
- "found_inconsistent": Listed but NAP has discrepancies (old address, wrong phone, abbreviations, etc.)
- "not_found": Business likely NOT listed
- Be realistic — newer/smaller businesses may not be on all directories`;

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
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${context}\n\nCheck these directories:\n${dirList}\n\nReturn JSON with one entry per directory.` }],
    });

    let text = msg.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

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

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

// Query templates — varied to simulate different AI search patterns
const QUERY_TEMPLATES = [
  'Who is the best {service} in {city}?',
  'Top rated {service} companies in {city} {state}',
  'I need {service} in {city}. Who should I call?',
  'Best {service} near {city} {state} with good reviews',
  'Recommend a {service} company in {city}',
];

function buildQueries(client, services, city, state) {
  const queries = [];
  const serviceList = services && services.length > 0
    ? services
    : [client.company_name.toLowerCase().includes('junk') ? 'junk removal' :
       client.company_name.toLowerCase().includes('tree') ? 'tree service' :
       client.company_name.toLowerCase().includes('fence') ? 'fencing' :
       client.company_name.toLowerCase().includes('septic') ? 'septic service' :
       'local service'];

  for (const service of serviceList.slice(0, 3)) {
    for (const template of QUERY_TEMPLATES) {
      queries.push({
        query: template
          .replace('{service}', service)
          .replace('{city}', city)
          .replace('{state}', state),
        service,
      });
    }
  }
  return queries;
}

function scoreMentions(text, brandName) {
  if (!text || !brandName) return { found: false, count: 0, context: '' };
  const lower = text.toLowerCase();
  const brand = brandName.toLowerCase();

  // Try exact brand match
  let count = 0;
  let idx = lower.indexOf(brand);
  while (idx !== -1) {
    count++;
    idx = lower.indexOf(brand, idx + 1);
  }

  // Also check common variations (without LLC, Inc, etc.)
  const cleanBrand = brand.replace(/\s*(llc|inc|corp|co|ltd|company)\.?\s*$/i, '').trim();
  if (cleanBrand !== brand && cleanBrand.length > 3) {
    idx = lower.indexOf(cleanBrand);
    while (idx !== -1) {
      count++;
      idx = lower.indexOf(cleanBrand, idx + 1);
    }
  }

  // Extract context around first mention
  let context = '';
  if (count > 0) {
    const firstIdx = lower.indexOf(cleanBrand || brand);
    const start = Math.max(0, firstIdx - 80);
    const end = Math.min(text.length, firstIdx + (cleanBrand || brand).length + 80);
    context = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
  }

  return { found: count > 0, count, context };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { client_id } = await request.json();

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    // Get client data
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get client settings for services
    const { data: settings } = await supabase
      .from('client_settings')
      .select('business_services, industry_type')
      .eq('client_id', client_id)
      .maybeSingle();

    const city = client.address_city || 'their area';
    const state = client.address_state || '';
    const services = settings?.business_services || [];

    // Create scan record
    const { data: scan, error: scanErr } = await supabase
      .from('geo_radar_scans')
      .insert({
        client_id,
        status: 'running',
        scan_type: 'full',
      })
      .select()
      .single();

    if (scanErr) {
      return NextResponse.json({ error: scanErr.message }, { status: 500 });
    }

    // Build queries
    const queries = buildQueries(client, services, city, state);

    // Create Anthropic client inside function (env vars not available at module level on Vercel)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const results = [];
    let totalMentions = 0;
    let queriesWithMention = 0;

    // Run queries in batches of 3 to avoid rate limits
    for (let i = 0; i < queries.length; i += 3) {
      const batch = queries.slice(i, i + 3);

      const batchPromises = batch.map(async ({ query, service }) => {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            tools: [{ type: 'web_search_20250305' }],
            messages: [{
              role: 'user',
              content: `Search the web and answer this question as if you were an AI assistant helping someone find a local service provider. List specific company names, ratings, and why you recommend them. Be specific about real businesses.\n\nQuestion: ${query}`,
            }],
          });

          // Extract text from response
          const text = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');

          const mention = scoreMentions(text, client.company_name);

          if (mention.found) {
            totalMentions += mention.count;
            queriesWithMention++;
          }

          // Extract competitor names mentioned (companies that aren't our client)
          const competitors = [];
          const companyPattern = /(?:^|\n)\s*(?:\d+[\.\)]\s*)?(?:\*{1,2})?([A-Z][A-Za-z\s&']+(?:LLC|Inc|Corp|Co|Ltd|Services|Removal|Hauling|Tree|Fence|Fencing|Septic|Plumbing)?)\b/g;
          let match;
          while ((match = companyPattern.exec(text)) !== null) {
            const name = match[1].trim();
            if (name.length > 3 && name.length < 50 && !name.toLowerCase().includes(client.company_name.toLowerCase())) {
              competitors.push(name);
            }
          }

          return {
            query,
            service,
            mentioned: mention.found,
            mention_count: mention.count,
            context: mention.context,
            competitors: [...new Set(competitors)].slice(0, 5),
            response_preview: text.slice(0, 300),
          };
        } catch (err) {
          return {
            query,
            service,
            mentioned: false,
            mention_count: 0,
            context: '',
            competitors: [],
            response_preview: `Error: ${err.message}`,
            error: true,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Calculate visibility score (0-100)
    const totalQueries = results.filter(r => !r.error).length;
    const visibilityScore = totalQueries > 0
      ? Math.round((queriesWithMention / totalQueries) * 100)
      : 0;

    // Generate summary
    let summary = '';
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are an SEO analyst. Summarize this AI search visibility scan in 3-4 sentences for a business owner.

Client: ${client.company_name} in ${city}, ${state}
Service: ${services.join(', ') || 'general services'}
Queries run: ${totalQueries}
Times mentioned: ${queriesWithMention} out of ${totalQueries} queries
Visibility score: ${visibilityScore}%

Top competitors appearing: ${[...new Set(results.flatMap(r => r.competitors))].slice(0, 8).join(', ') || 'None identified'}

Be direct. If score is low, say what needs to improve. If high, say what's working. No fluff.`,
        }],
      });
      summary = summaryResponse.content[0]?.text || '';
    } catch {
      summary = `Scanned ${totalQueries} AI search queries. ${client.company_name} appeared in ${queriesWithMention} responses (${visibilityScore}% visibility).`;
    }

    // Update scan record
    await supabase.from('geo_radar_scans').update({
      status: 'complete',
      queries_run: totalQueries,
      mentions_found: queriesWithMention,
      visibility_score: visibilityScore,
      results,
      summary,
      scanned_at: new Date().toISOString(),
    }).eq('id', scan.id);

    return NextResponse.json({
      success: true,
      scan_id: scan.id,
      visibility_score: visibilityScore,
      queries_run: totalQueries,
      mentions_found: queriesWithMention,
      summary,
    });

  } catch (err) {
    console.error('GEO Radar error:', err);
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 });
  }
}

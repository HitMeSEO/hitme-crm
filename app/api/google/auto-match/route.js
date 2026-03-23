// /app/api/google/auto-match/route.js
// Auto-matches GA4 property IDs to clients based on website domain
// Also returns Search Console match status for each client
// GET: dry run (shows matches without saving)
// POST: saves GA4 property IDs to client records

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function GET(request) {
  return handleMatch(request, false);
}

export async function POST(request) {
  return handleMatch(request, true);
}

// DELETE: clear ga4_property_id for specific clients (pass ?clients=Name1,Name2)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientNames = searchParams.get('clients')?.split(',').map(s => s.trim()) || [];
    if (!clientNames.length) {
      return Response.json({ error: 'Pass ?clients=Name1,Name2' }, { status: 400 });
    }
    const supabase = await createClient();
    const cleared = [];
    for (const name of clientNames) {
      const { data, error } = await supabase
        .from('clients')
        .update({ ga4_property_id: null })
        .ilike('company_name', `%${name}%`)
        .select('id, company_name');
      if (data?.length) cleared.push(...data);
    }
    return Response.json({ cleared });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function handleMatch(request, save) {
  try {
    const supabase = await createClient();
    const accessToken = await getAccessToken(supabase);

    if (!accessToken) {
      return Response.json({ error: 'Google not connected' }, { status: 401 });
    }

    // 1. Get all clients
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, company_name, website, ga4_property_id')
      .order('company_name');

    if (clientsErr) throw clientsErr;

    // 2. Get Search Console sites
    const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const sitesData = sitesRes.ok ? await sitesRes.json() : { siteEntry: [] };
    const scSites = (sitesData.siteEntry || []).map(s => ({
      url: s.siteUrl,
      permission: s.permissionLevel,
    }));

    // 3. Get GA4 properties
    const accountsRes = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accounts',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    let allProperties = [];
    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      for (const account of (accountsData.accounts || [])) {
        const propsRes = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${account.name}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (propsRes.ok) {
          const propsData = await propsRes.json();
          for (const p of (propsData.properties || [])) {
            allProperties.push({
              propertyId: p.name.replace('properties/', ''),
              displayName: p.displayName,
              account: account.displayName,
              websiteUrl: p.propertyType === 'PROPERTY_TYPE_ORDINARY' ? '' : '',
            });
          }
        }
      }
    }

    // 4. Match each client
    const results = [];
    const updates = [];

    for (const client of clients) {
      if (!client.website) {
        results.push({
          client: client.company_name,
          website: null,
          searchConsole: null,
          ga4: null,
          ga4Current: client.ga4_property_id,
          action: 'no_website',
        });
        continue;
      }

      let domain;
      try {
        const urlObj = new URL(client.website);
        domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        results.push({
          client: client.company_name,
          website: client.website,
          searchConsole: null,
          ga4: null,
          ga4Current: client.ga4_property_id,
          action: 'invalid_url',
        });
        continue;
      }

      // Match Search Console
      const scMatch = scSites.find(s => {
        const scUrl = s.url.toLowerCase();
        return scUrl === `sc-domain:${domain}` ||
          scUrl.includes(domain);
      });

      // Match GA4 - check displayName for domain match
      const ga4Match = allProperties.find(p => {
        const name = p.displayName.toLowerCase();
        const acct = p.account.toLowerCase();
        return name.includes(domain) || acct.includes(domain) ||
          name.includes(domain.split('.')[0]) && name.includes('ga4');
      });

      // Fuzzy GA4 match: try company name fragments (require 2+ word matches)
      let ga4FuzzyMatch = null;
      if (!ga4Match) {
        const companyWords = client.company_name.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3 && !['the', 'and', 'inc', 'llc', 'corp', 'fake', 'account', 'added', 'locations', 'test'].includes(w));

        if (companyWords.length >= 2) {
          ga4FuzzyMatch = allProperties.find(p => {
            const name = p.displayName.toLowerCase();
            const acct = p.account.toLowerCase();
            const matchCount = companyWords.filter(w => name.includes(w) || acct.includes(w)).length;
            return matchCount >= 2;
          });
        }
      }

      const bestGa4 = ga4Match || ga4FuzzyMatch;
      const alreadySet = client.ga4_property_id;
      const needsUpdate = bestGa4 && !alreadySet;

      if (needsUpdate && save) {
        updates.push({
          id: client.id,
          ga4_property_id: bestGa4.propertyId,
        });
      }

      results.push({
        client: client.company_name,
        website: client.website,
        domain,
        searchConsole: scMatch ? { url: scMatch.url, permission: scMatch.permission } : null,
        ga4: bestGa4 ? {
          propertyId: bestGa4.propertyId,
          displayName: bestGa4.displayName,
          matchType: ga4Match ? 'domain' : 'fuzzy',
        } : null,
        ga4Current: alreadySet || null,
        action: !bestGa4 ? 'no_match' : alreadySet ? 'already_set' : save ? 'updated' : 'will_update',
      });
    }

    // 5. Save updates if POST
    if (save && updates.length > 0) {
      for (const upd of updates) {
        await supabase
          .from('clients')
          .update({ ga4_property_id: upd.ga4_property_id })
          .eq('id', upd.id);
      }
    }

    const summary = {
      totalClients: clients.length,
      withWebsite: results.filter(r => r.action !== 'no_website' && r.action !== 'invalid_url').length,
      searchConsoleMatched: results.filter(r => r.searchConsole).length,
      ga4Matched: results.filter(r => r.ga4).length,
      ga4Updated: updates.length,
      ga4AlreadySet: results.filter(r => r.action === 'already_set').length,
      ga4NoMatch: results.filter(r => r.action === 'no_match').length,
    };

    return Response.json({ summary, results, saved: save });
  } catch (err) {
    console.error('[auto-match] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

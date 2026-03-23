// /app/api/google/analytics-properties/route.js
// Lists all GA4 properties the connected Google account has access to
// Uses the GA4 Admin API to enumerate accounts and properties

import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-auth';

export async function GET() {
  try {
    const supabase = await createClient();
    const accessToken = await getAccessToken(supabase);

    if (!accessToken) {
      return Response.json({ error: 'Google not connected' }, { status: 401 });
    }

    // First list all accounts
    const accountsRes = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accounts',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!accountsRes.ok) {
      const err = await accountsRes.json();
      return Response.json({
        error: err.error?.message || 'Failed to list accounts',
        status: accountsRes.status,
        hint: 'The Google Analytics Admin API may need to be enabled in Google Cloud Console'
      }, { status: accountsRes.status });
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];

    // For each account, list properties
    const allProperties = [];
    for (const account of accounts) {
      const propsRes = await fetch(
        `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${account.name}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (propsRes.ok) {
        const propsData = await propsRes.json();
        const props = (propsData.properties || []).map(p => ({
          propertyId: p.name.replace('properties/', ''),
          displayName: p.displayName,
          websiteUrl: p.industryCategory || '',
          account: account.displayName,
          createTime: p.createTime,
        }));
        allProperties.push(...props);
      }
    }

    return Response.json({
      accounts: accounts.map(a => ({ name: a.name, displayName: a.displayName })),
      properties: allProperties
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

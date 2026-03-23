import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function detectIndustry(services = '') {
  const s = services.toLowerCase();
  if (/roof|shingle|gutter|siding/.test(s)) return 'Roofing';
  if (/fence|fencing/.test(s)) return 'Fencing';
  if (/plumb|drain|pipe|sewer/.test(s)) return 'Plumbing';
  if (/electric|wiring|panel/.test(s)) return 'Electrical';
  if (/landscape|lawn|mow|tree|mulch/.test(s)) return 'Landscaping';
  if (/junk|haul|remov|cleanout/.test(s)) return 'Junk Removal';
  if (/paint|coat/.test(s)) return 'Painting';
  if (/hvac|heat|cool|air condition/.test(s)) return 'HVAC';
  if (/pest|extermina/.test(s)) return 'Pest Control';
  if (/clean|maid|janitor/.test(s)) return 'Cleaning';
  if (/dumpster|roll.?off/.test(s)) return 'Dumpster Rental';
  return null;
}

function parseServices(raw = '') {
  return raw.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
}

function parseTargetCities(raw = '') {
  return raw.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
}

export async function POST(request, { params }) {
  const { token } = await params;

  // Cookie-based client — runs as anon role when no session present.
  // The SQL in scripts/onboarding-rls-fix.sql grants anon the permissions needed.
  const supabase = await createClient();

  const { data: formRow, error: formErr } = await supabase
    .from('onboarding_forms')
    .select('*')
    .eq('token', token)
    .single();

  if (formErr || !formRow) {
    console.log(JSON.stringify({ event: 'onboard_form_not_found', token, error: formErr?.message }));
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  const d = formRow.form_data || {};
  const clientId = formRow.client_id;
  const errors = [];

  // --- a. Update client record ---
  const clientUpdate = {};
  if (d.business_name) clientUpdate.company_name = d.business_name;
  if (d.phone)         clientUpdate.phone = d.phone;
  if (d.email)         clientUpdate.email = d.email;
  if (d.website)       clientUpdate.website = d.website;
  if (d.address)       clientUpdate.address_street = d.address;
  if (d.city)          clientUpdate.address_city = d.city;
  if (d.state)         clientUpdate.address_state = d.state;
  if (d.zip)           clientUpdate.address_zip = d.zip;

  if (Object.keys(clientUpdate).length > 0) {
    const { error } = await supabase.from('clients').update(clientUpdate).eq('id', clientId);
    if (error) {
      errors.push(`client update: ${error.message}`);
      console.log(JSON.stringify({ event: 'onboard_client_update_error', error: error.message, code: error.code }));
    }
  }

  // --- b. Upsert client_settings ---
  const services = parseServices(d.top_services);
  const industryType = detectIndustry(d.top_services);
  const competitors = [
    d.competitor_1 ? { name: d.competitor_1, url: d.competitor_1_url || '' } : null,
    d.competitor_2 ? { name: d.competitor_2, url: d.competitor_2_url || '' } : null,
    d.competitor_3 ? { name: d.competitor_3, url: d.competitor_3_url || '' } : null,
  ].filter(Boolean);

  const settingsPayload = {
    client_id: clientId,
    business_services: services,
    competitors,
    target_areas: d.target_areas || '',
    ideal_customer: d.ideal_customer || '',
    lead_definition: d.lead_definition || '',
  };
  if (industryType) settingsPayload.industry_type = industryType;

  const { data: existingSettings } = await supabase
    .from('client_settings').select('id').eq('client_id', clientId).maybeSingle();

  if (existingSettings) {
    const { error } = await supabase.from('client_settings').update(settingsPayload).eq('client_id', clientId);
    if (error) errors.push(`client_settings update: ${error.message}`);
  } else {
    const { error } = await supabase.from('client_settings').insert(settingsPayload);
    if (error) errors.push(`client_settings insert: ${error.message}`);
  }

  // --- c. Create location records for target cities (via SECURITY DEFINER to bypass RLS) ---
  const targetCities = parseTargetCities(d.target_areas);
  for (const city of targetCities.slice(0, 20)) {
    const parts = city.split(/\s+/);
    const maybeState = parts.length >= 2 && parts[parts.length - 1].length === 2
      ? parts.pop() : null;
    const cityName = maybeState ? parts.join(' ') : city;
    const stateVal = maybeState || d.state || '';
    const locationName = stateVal ? `${cityName}, ${stateVal}` : cityName;

    const { error } = await supabase.rpc('create_onboarding_location', {
      p_client_id: clientId,
      p_location_name: locationName,
      p_city: cityName,
      p_state: stateVal,
    });
    if (error) errors.push(`location rpc (${city}): ${error.message}`);
  }

  // --- d. Create task via SECURITY DEFINER function (bypasses RLS) ---
  const { data: clientRow } = await supabase
    .from('clients').select('company_name').eq('id', clientId).maybeSingle();
  const companyName = clientRow?.company_name || d.business_name || 'Client';

  const taskTitle = `Review onboarding form — ${companyName}`;
  const taskDescription = `Onboarding form submitted. Review answers and schedule kickoff call.\n\nServices: ${d.top_services || 'N/A'}\nTarget areas: ${d.target_areas || 'N/A'}\nIdeal customer: ${d.ideal_customer || 'N/A'}`;

  console.log(JSON.stringify({ event: 'onboard_task_rpc_attempt', clientId, companyName }));

  const { data: taskId, error: taskError } = await supabase.rpc('create_onboarding_task', {
    p_client_id: clientId,
    p_title: taskTitle,
    p_description: taskDescription,
  });

  console.log(JSON.stringify({
    event: 'onboard_task_rpc_result',
    success: !taskError,
    taskId: taskId || null,
    error: taskError ? { message: taskError.message, code: taskError.code, hint: taskError.hint } : null,
  }));

  if (taskError) errors.push(`task insert: ${taskError.message}`);

  // --- e. Mark form submitted ---
  await supabase.from('onboarding_forms').update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }).eq('token', token);

  console.log(JSON.stringify({
    event: 'onboard_submit_complete',
    token, clientId, companyName,
    errors: errors.length ? errors : null,
  }));

  return NextResponse.json({ success: true, warnings: errors.length ? errors : undefined });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AUDIT_FIELDS = 'audit_status, audit_progress, audit_error, audit_started_at, audit_completed_at, site_data_cache, previous_audit_snapshot, step1_crawlability, step2_technical, step3_onpage, step4_content, step5_keywords, step6_local_seo, step7_competitors, step8_ai_visibility, step9_quick_wins, step10_roadmap';

export async function GET(request, { params }) {
  const { id } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .select(AUDIT_FIELDS)
    .eq('id', id)
    .single();

  if (error) {
    // PGRST116 = no rows; treat as pending (columns may not exist yet or client not found)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ audit_status: null, audit_progress: 0 });
    }
    // Column-missing errors from Supabase (42703) — DB migration not yet run
    if (error.code === '42703' || error.message?.includes('does not exist')) {
      return NextResponse.json({ audit_status: null, audit_progress: 0, _missing_columns: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

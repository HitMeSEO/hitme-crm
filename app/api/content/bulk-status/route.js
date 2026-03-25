// /app/api/content/bulk-status/route.js
// Polling endpoint for bulk generation job progress

import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return Response.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: job, error } = await supabase
      .from('bulk_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json(job);

  } catch (err) {
    console.error('[bulk-status] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

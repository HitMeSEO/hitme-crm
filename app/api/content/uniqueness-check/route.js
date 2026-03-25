// /app/api/content/uniqueness-check/route.js
// Post-generation cross-page uniqueness analysis
// Runs 5-gram overlap detection across all service location pages for a client

import { createClient } from '@/lib/supabase/server';
import { calculateUniquenessScore } from '@/lib/content-engine';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { clientId } = await request.json();

    if (!clientId) {
      return Response.json({ error: 'clientId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Load all service location pages for this client
    const { data: pages, error } = await supabase
      .from('content_queue')
      .select('id, body_html, location_id, title')
      .eq('client_id', clientId)
      .eq('content_type', 'service_location_page')
      .not('body_html', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[uniqueness-check] query error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!pages || pages.length < 2) {
      return Response.json({ scores: {}, flagged: [], message: 'Need at least 2 pages to compare' });
    }

    const scores = {};
    const flagged = [];

    for (const page of pages) {
      const siblings = pages
        .filter(p => p.id !== page.id)
        .map(p => p.body_html);

      const score = calculateUniquenessScore(page.body_html, siblings);
      scores[page.id] = score;

      // Update the content_queue row
      await supabase
        .from('content_queue')
        .update({ uniqueness_score: score })
        .eq('id', page.id);

      if (score < 70) {
        flagged.push({ id: page.id, title: page.title, score });
      }
    }

    return Response.json({ scores, flagged, totalChecked: pages.length });

  } catch (err) {
    console.error('[uniqueness-check] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

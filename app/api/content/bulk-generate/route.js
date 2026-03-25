// /app/api/content/bulk-generate/route.js
// Batch generates service location pages for multiple locations
// Processes up to 10 locations per request (fits in 300s Vercel limit)

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildMapEmbedForContent } from '@/lib/map-embed';
import {
  getClientContext,
  buildServicePagePrompt,
  buildSchemaJson,
  calculateWordCount,
  calculateKeywordCoverage,
} from '@/lib/content-engine';

export const maxDuration = 300;

export async function POST(request) {
  try {
    const { clientId, locationIds, jobId } = await request.json();

    if (!clientId || !locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return Response.json({ error: 'clientId and locationIds array required' }, { status: 400 });
    }

    if (locationIds.length > 10) {
      return Response.json({ error: 'Maximum 10 locations per batch' }, { status: 400 });
    }

    const supabase = await createClient();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Load client + settings once
    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
    const { data: settings } = await supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle();

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Load all locations for this batch
    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .in('id', locationIds);

    if (!locations || locations.length === 0) {
      return Response.json({ error: 'No locations found' }, { status: 404 });
    }

    // Load previously generated sibling pages for anti-duplication
    const { data: existingContent } = await supabase
      .from('content_queue')
      .select('body_html, location_id')
      .eq('client_id', clientId)
      .eq('content_type', 'service_location_page')
      .not('body_html', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    const previousSnippets = (existingContent || [])
      .map(c => {
        if (!c.body_html) return null;
        const text = c.body_html.replace(/<[^>]+>/g, ' ').trim();
        return text.substring(0, 200);
      })
      .filter(Boolean)
      .slice(0, 3);

    // Determine variation starting index
    const existingCount = (existingContent || []).length;

    const completed = [];
    const failed = [];
    const scores = {};

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const variationIndex = existingCount + i;

      try {
        // Skip locations without keyword briefs
        if (loc.research_status !== 'complete' || !loc.keyword_brief) {
          failed.push({ id: loc.id, name: loc.location_name, error: 'No keyword brief — research first' });
          continue;
        }

        const brief = loc.keyword_brief;
        const targetService = brief.primary_keyword;

        // Build prompt with variation
        const prompt = buildServicePagePrompt(client, loc, settings, brief, null, {
          variationIndex,
          totalPages: existingCount + locations.length,
          previousSnippets,
          contentRestrictions: settings?.content_restrictions || null,
        });

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 12000,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawText = message.content[0]?.text?.trim() || '';
        const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

        let generated;
        try {
          generated = JSON.parse(cleaned);
        } catch (parseErr) {
          console.error(`[bulk-generate] JSON parse failed for ${loc.location_name}:`, rawText.substring(0, 300));
          failed.push({ id: loc.id, name: loc.location_name, error: 'Invalid JSON from Claude' });
          continue;
        }

        const { title_tag, meta_description, h1, url_slug, body_html: rawBodyHtml } = generated;

        if (!title_tag || !rawBodyHtml) {
          failed.push({ id: loc.id, name: loc.location_name, error: 'Missing required fields' });
          continue;
        }

        // Append map embed
        const mapEmbed = buildMapEmbedForContent(client, loc, 'service_location_page');
        const body_html = mapEmbed ? rawBodyHtml + '\n' + mapEmbed : rawBodyHtml;

        // Quality scoring
        const wordCount = calculateWordCount(body_html);
        const keywordCoverage = calculateKeywordCoverage(body_html, brief);

        // Schema
        const schemaJson = buildSchemaJson(client, loc, settings, body_html);

        // Insert into content_queue
        const { data: contentItem, error: insertError } = await supabase
          .from('content_queue')
          .insert({
            client_id: clientId,
            location_id: loc.id,
            title: h1 || title_tag,
            content_type: 'service_location_page',
            status: 'Not Started',
            title_tag,
            meta_description: meta_description || null,
            url_slug: url_slug || null,
            h1: h1 || null,
            body_html,
            schema_json: schemaJson,
            word_count: wordCount,
            keyword_coverage: keywordCoverage,
            bulk_job_id: jobId || null,
            notes: `Bulk generated. Variation #${variationIndex + 1}. Keyword: ${targetService}`,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[bulk-generate] insert error for ${loc.location_name}:`, insertError.message);
          failed.push({ id: loc.id, name: loc.location_name, error: insertError.message });
          continue;
        }

        // Update location content_status
        await supabase
          .from('locations')
          .update({ content_status: 'draft' })
          .eq('id', loc.id);

        // Add snippet to previousSnippets for next iterations
        const newSnippet = body_html.replace(/<[^>]+>/g, ' ').trim().substring(0, 200);
        previousSnippets.unshift(newSnippet);
        if (previousSnippets.length > 3) previousSnippets.pop();

        completed.push(loc.id);
        scores[loc.id] = { wordCount, keywordCoverage, contentId: contentItem.id };

        // Update job progress
        if (jobId) {
          await supabase
            .from('bulk_generation_jobs')
            .update({
              completed_count: completed.length,
              failed_count: failed.length,
              updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        }

      } catch (err) {
        console.error(`[bulk-generate] error for ${loc.location_name}:`, err.message);
        failed.push({ id: loc.id, name: loc.location_name, error: err.message });
      }
    }

    // Final job update
    if (jobId) {
      const allDone = completed.length + failed.length === locations.length;
      await supabase
        .from('bulk_generation_jobs')
        .update({
          completed_count: completed.length,
          failed_count: failed.length,
          error_log: failed,
          status: allDone ? 'completed' : 'running',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    return Response.json({ completed, failed, scores });

  } catch (err) {
    console.error('[bulk-generate] fatal error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

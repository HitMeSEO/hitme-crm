import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const maxDuration = 120;

// Fix My Visibility: batch-triggers research + generation for content gaps
// Also generates schema for existing pages that don't have it
// Also generates GBP posts for stale locations

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { client_id, audit_id, fix_types } = await request.json();
    // fix_types: ['content_gaps', 'schema_gaps', 'gbp_posts'] — or empty for all

    if (!client_id) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }

    // Get the latest audit results
    let audit;
    if (audit_id) {
      const { data } = await supabase.from('client_audits').select('*').eq('id', audit_id).single();
      audit = data;
    } else {
      const { data } = await supabase
        .from('client_audits')
        .select('*')
        .eq('client_id', client_id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      audit = data;
    }

    if (!audit) {
      return NextResponse.json({ error: 'No audit found. Run a full audit first.' }, { status: 400 });
    }

    const types = fix_types && fix_types.length > 0 ? fix_types : ['content_gaps', 'schema_gaps', 'gbp_posts'];
    const results = { content_queued: 0, schema_generated: 0, gbp_posts_queued: 0 };

    // ═══════════════════════════════════════════
    // FIX CONTENT GAPS: Queue research for each location without content
    // ═══════════════════════════════════════════
    if (types.includes('content_gaps') && audit.content_gap_results?.gaps) {
      const gaps = audit.content_gap_results.gaps;

      // Get unique location IDs that need content
      const locationIds = [...new Set(gaps.map(g => g.location_id))];

      for (const locId of locationIds.slice(0, 20)) { // Cap at 20 to avoid timeout
        // Check if research already exists
        const { data: loc } = await supabase
          .from('locations')
          .select('id, research_status, keyword_brief')
          .eq('id', locId)
          .single();

        if (!loc) continue;

        // If no research yet, mark it as needing research
        // (The actual research + generation will be triggered from the UI per-location)
        if (loc.research_status !== 'complete') {
          // Create a task for this location
          const gap = gaps.find(g => g.location_id === locId);
          const { data: existingTask } = await supabase
            .from('tasks')
            .select('id')
            .eq('client_id', client_id)
            .ilike('title', `%${gap?.location_name || locId}%research%`)
            .maybeSingle();

          if (!existingTask) {
            await supabase.from('tasks').insert({
              client_id,
              title: `Research + Generate: ${gap?.location_name || 'Location'}`,
              description: `Content gap found by AI Visibility audit. Run Research then Generate Content on the Locations tab for this location.`,
              status: 'Not Started',
              priority: gap?.priority === 'high' ? 'High' : 'Medium',
            });
          }
          results.content_queued++;
        }
      }
    }

    // ═══════════════════════════════════════════
    // FIX SCHEMA GAPS: Generate schema for existing pages (inline, no internal fetch)
    // ═══════════════════════════════════════════
    if (types.includes('schema_gaps') && audit.schema_scan_results?.gaps?.length > 0) {
      try {
        const { data: schemaClient } = await supabase.from('clients').select('*').eq('id', client_id).single();
        const { data: schemaSettings } = await supabase.from('client_settings').select('*').eq('client_id', client_id).maybeSingle();
        const gapIds = audit.schema_scan_results.gaps.map(g => g.content_id).filter(Boolean);
        if (gapIds.length > 0) {
          const { data: gapItems } = await supabase.from('content_queue').select('*').in('id', gapIds);
          const locIds = [...new Set((gapItems || []).filter(i => i.location_id).map(i => i.location_id))];
          const { data: locs } = await supabase.from('locations').select('*').in('id', locIds.length > 0 ? locIds : ['none']);
          const locMap = {};
          (locs || []).forEach(l => { locMap[l.id] = l; });
          const svcs = schemaSettings?.business_services || [];

          for (const item of (gapItems || [])) {
            const loc = locMap[item.location_id] || {};
            const city = loc.address_city || schemaClient?.address_city || '';
            const state = loc.address_state || schemaClient?.address_state || '';
            const localBiz = {
              '@context': 'https://schema.org', '@type': 'LocalBusiness',
              name: schemaClient?.company_name || '', url: schemaClient?.website || '',
              telephone: schemaClient?.phone || '',
              address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: state },
              areaServed: { '@type': 'City', name: city },
            };
            if (schemaClient?.gbp_rating) localBiz.aggregateRating = { '@type': 'AggregateRating', ratingValue: schemaClient.gbp_rating, reviewCount: schemaClient.gbp_review_count };
            if (schemaClient?.gbp_maps_url) localBiz.sameAs = [schemaClient.gbp_maps_url];
            if (svcs.length > 0) localBiz.hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Services', itemListElement: svcs.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })) };

            let faqSchema = null;
            if (item.body_html) {
              const faqRegex = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
              const faqItems = [];
              let m;
              while ((m = faqRegex.exec(item.body_html)) !== null) {
                faqItems.push({ '@type': 'Question', name: m[1].trim(), acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/<[^>]+>/g, '').trim() } });
              }
              if (faqItems.length > 0) faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems };
            }

            await supabase.from('content_queue').update({ schema_json: { localBusiness: localBiz, faq: faqSchema } }).eq('id', item.id);
            results.schema_generated++;
          }
        }
      } catch (e) {
        console.error('Schema fix error:', e);
      }
    }

    // ═══════════════════════════════════════════
    // FIX GBP GAPS: Create GBP post tasks for stale locations
    // ═══════════════════════════════════════════
    if (types.includes('gbp_posts') && audit.gbp_post_results?.gaps) {
      const gbpGaps = audit.gbp_post_results.gaps;

      for (const gap of gbpGaps.slice(0, 10)) {
        const { data: existingTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('client_id', client_id)
          .ilike('title', `%${gap.location_name}%GBP%`)
          .maybeSingle();

        if (!existingTask) {
          await supabase.from('tasks').insert({
            client_id,
            title: `Write GBP Post: ${gap.location_name}`,
            description: `Last post: ${gap.last_post || 'never'}. Use Locations tab → Generate Content → GBP Post.`,
            status: 'Not Started',
            priority: 'Medium',
          });
          results.gbp_posts_queued++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Queued ${results.content_queued} content tasks, generated ${results.schema_generated} schemas, queued ${results.gbp_posts_queued} GBP post tasks.`,
    });

  } catch (err) {
    console.error('Fix error:', err);
    return NextResponse.json({ error: err.message || 'Fix failed' }, { status: 500 });
  }
}

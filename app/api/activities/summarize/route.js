import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const anthropic = new Anthropic();

export async function POST(req) {
  try {
    const { client_id } = await req.json();
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

    // Fetch client name
    const { data: client } = await supabase
      .from('clients')
      .select('company_name')
      .eq('id', client_id)
      .single();

    // Fetch recent activities (last 50)
    const { data: activities } = await supabase
      .from('activities')
      .select('activity_type, content, created_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!activities || activities.length === 0) {
      return NextResponse.json({ error: 'No activities to summarize' }, { status: 400 });
    }

    const activitiesText = activities.map(a =>
      `[${a.activity_type}] ${new Date(a.created_at).toLocaleDateString()}: ${a.content}`
    ).join('\n\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are summarizing the activity notes for a client called "${client?.company_name || 'Unknown'}". Here are the notes (most recent first):

${activitiesText}

Please provide a clear, concise summary of:
1. Key takeaways and current status
2. Important action items or follow-ups mentioned
3. Any patterns or recurring themes

Keep it to 3-5 short paragraphs. Be specific — reference dates and details. Write in a professional but conversational tone, as if briefing a teammate who just joined the account.`,
      }],
    });

    const summary = msg.content[0]?.text || 'Unable to generate summary.';
    return NextResponse.json({ summary });
  } catch (e) {
    console.error('Activity summarize error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

# Hit Me CRM — Skills & Tactical Playbook

> **Purpose:** Quick-reference how-to patterns for any AI agent (Cursor, Cowork, Claude Code) working on this project. Read this at the start of every session alongside CLAUDE.md and tasks/lessons.md.

---

## Supabase: Authenticated vs Public Routes

### Authenticated API routes (user is logged in)
```js
// Use the cookie-based client — RLS works automatically
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  const supabase = await createClient();
  const { data } = await supabase.from('tasks').select('*');
  // Works — user session is in cookies, RLS sees the authenticated role
}
```

### Public API routes (no login — onboarding form, public pages)
```js
// The cookie-based client has NO session — runs as anon role
// CANNOT write to RLS-protected tables directly
// CANNOT bypass RLS with sb_secret_ key (it's NOT a JWT)

// CORRECT PATTERN: Use a Postgres function with SECURITY DEFINER
const { error } = await supabase.rpc('create_onboarding_task', {
  p_client_id: clientId,
  p_client_name: clientName,
});
```

### Creating a SECURITY DEFINER function
```sql
CREATE OR REPLACE FUNCTION public.create_onboarding_task(p_client_id UUID, p_client_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as table owner, bypasses RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO tasks (client_id, title, priority, status)
  VALUES (p_client_id, 'Review onboarding form — ' || p_client_name, 'High', 'Not Started');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_onboarding_task TO anon;
GRANT EXECUTE ON FUNCTION public.create_onboarding_task TO authenticated;
```

### Key rule: sb_secret_ vs eyJ keys
- `sb_secret_...` = Supabase Management API key. Does NOT bypass RLS. Treated like anon.
- `eyJ...` = JWT service_role key. DOES bypass RLS. This is what `@supabase/supabase-js` needs.
- Our project uses `sb_secret_` format — so we CANNOT bypass RLS via client-side key. Use SECURITY DEFINER instead.

---

## Supabase: Query Patterns

### Never use .single() with joins
```js
// BAD — breaks on multi-location clients (returns multiple rows)
const { data } = await supabase
  .from('clients')
  .select('*, locations(*)')
  .eq('id', clientId)
  .single();

// GOOD — separate queries
const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
const { data: locations } = await supabase.from('locations').select('*').eq('client_id', clientId);
```

### Use .maybeSingle() for optional records
```js
// For tables where a row may or may not exist (client_settings, onboarding_forms)
const { data: settings } = await supabase
  .from('client_settings')
  .select('*')
  .eq('client_id', clientId)
  .maybeSingle();  // returns null instead of erroring when no row exists
```

### Upsert pattern for settings
```js
await supabase
  .from('client_settings')
  .upsert(payload, { onConflict: 'client_id' });
```

---

## Google Places API

### Text Search request
```js
const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.primaryTypeDisplayName,places.regularOpeningHours,places.googleMapsUri,places.editorialSummary',
  },
  body: JSON.stringify({
    textQuery: 'Business Name City State',
    maxResultCount: 5,
    includePureServiceAreaBusinesses: true,  // CRITICAL for SABs
  }),
});
```

### Invalid fields (cause 400 or empty results)
- `places.reviews` — NOT valid for Text Search
- `places.serviceArea` — NOT valid for Text Search
- `pageSize` — use `maxResultCount` instead

---

## Anthropic Claude API

### Correct usage in API routes
```js
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request) {
  // Create client INSIDE the function — env vars not available at module level on Vercel
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',  // ONLY valid model name
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
}
```

### Invalid model names (will error)
- `claude-sonnet-4-20250514` — wrong
- `claude-3-5-sonnet-20241022` — wrong
- `claude-opus-4-5` — wrong

### For routes that take a while (research, content generation)
```js
export const maxDuration = 120;  // Vercel Pro allows up to 120s
```

---

## Vercel Deployment

### Build + deploy
```bash
cd ~/Desktop/hitme-crm-app && npm run build && npx vercel --prod --yes
```

### Check logs after deploy
```bash
cd ~/Desktop/hitme-crm-app && npx vercel logs https://hitme-crm-app.vercel.app --no-follow -n 100 --scope tim-maroses-projects
```

### Debugging Vercel errors
- Server errors show a **digest code** in the browser — this tells you nothing
- Always check `vercel logs` for the actual stack trace
- Common issues: missing env vars, module-level Anthropic client, wrong model name
- `waitUntil()` background tasks fail silently on Vercel — use sequential calls instead

---

## WordPress REST API

### Publishing a page
```js
const authHeader = 'Basic ' + Buffer.from('username:application_password').toString('base64');

// Create new page
const res = await fetch(`${wpUrl}/wp-json/wp/v2/pages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  },
  body: JSON.stringify({
    title: 'Page Title',
    content: '<p>HTML content</p>',
    status: 'publish',
    slug: 'page-slug',
    excerpt: 'Meta description goes here',
  }),
});

// Update existing page
const res = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${postId}`, {
  method: 'PUT',
  // same headers and body
});
```

### Key details
- Use `/wp-json/wp/v2/pages` for pages, `/wp-json/wp/v2/posts` for blog posts
- Auth format: `username:xxxx xxxx xxxx xxxx` (Application Password from WordPress Users panel)
- Base64 encode the auth string for the Authorization header
- Credentials stored in `client_settings.wordpress_url` and `client_settings.wordpress_api_key`

---

## Content Pipeline

### Status flow
```
Research → Generate → Edit in CRM → Frase 90+ → Send for Approval → Client Approves → Push to WordPress
```

### Database columns involved
- `locations.research_status`: not_started → running → complete
- `locations.keyword_brief`: JSONB with research data
- `locations.content_status`: no_page → draft → published
- `content_queue.status`: Not Started → In Progress → Review → Approved → Published
- `content_queue.client_approval`: not_sent → pending → approved → changes_requested
- `content_queue.wordpress_post_id`: set after WP push
- `content_queue.published_url`: set after WP push

---

## Dark/Light Mode

Every new component must work in both themes. Use CSS variables:
```js
// GOOD
style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}

// BAD — hardcoded colors break in the other theme
style={{ background: '#1a1a2e', color: '#ffffff' }}
```

Key variables: `--bg-card`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border`, `--accent`, `--danger`

---

## Database Constraints

### Client status values (lowercase only)
```
lead, prospect, client, churned, lost
```
Display labels are capitalized in the UI via `STATUS_LABELS` but values stored in DB are always lowercase.

### Task status values
```
Not Started, In Progress, Pending Client Approval, Done, Blocked
```

### Task priority values
```
High, Medium, Low
```

---

## File Structure Quick Reference

```
hitme-crm-app/
├── app/
│   ├── api/
│   │   ├── clients/[id]/audit/         # Shelved audit routes
│   │   ├── clients/[id]/run-audit/     # Shelved
│   │   ├── content/generate/           # Claude content generation
│   │   ├── content/publish/            # WordPress push
│   │   ├── content/research/           # Keyword research
│   │   ├── onboard/[token]/submit/     # Public onboarding form submit
│   │   └── places/search|lookup/       # Google Places API
│   ├── clients/
│   │   ├── ClientsContent.js           # Client list + add client modal
│   │   └── [id]/page.js               # Client detail (3700+ lines, all 10 tabs)
│   ├── onboard/[token]/page.js         # Public onboarding form
│   └── tasks/page.js                   # Global tasks page
├── components/
│   ├── AppShell.js                     # Layout wrapper with sidebar
│   ├── Sidebar.js
│   └── StatCard.js
├── lib/
│   ├── constants.js                    # All status/color/type constants
│   └── supabase/
│       ├── client.js                   # Browser client
│       └── server.js                   # Server client (cookie-based)
├── scripts/                            # SQL migration scripts
├── tasks/
│   ├── lessons.md                      # What went wrong and why
│   ├── skills.md                       # THIS FILE — tactical how-tos
│   └── todo.md                         # Unfinished items
└── CLAUDE.md                           # Project rules (read first every session)
```

---

*Last updated: March 18, 2026*

# Hit Me CRM — Lessons Learned

## Architecture
- Unified CRM at hitme-crm-app.vercel.app — replacing the old hitme-platform.vercel.app
- GitHub: HitMeSEO/hitme-crm, Supabase: pcrkgltlzmplsocvmieq
- Three admin users: Tim (tim@hitmeseo.com), Pam, Kevin
- Phase 2B is complete — Phase 3 is porting GEO Radar + audit features from the old platform

## Porting from Old Platform
- Old platform (hitme-platform.vercel.app, Supabase bdsbpuwzxzptsmebjglj) has features to port: GEO Radar, audit report PDFs, auto-task from audits, monitoring dashboard, auto-refresh cron
- When porting, rebuild clean in the new codebase — don't copy-paste old code without reviewing. The old platform had bugs
- SEO Clients and Clients were separate entities in the old platform — they are merged in the new CRM. One client record, SEO audit lives as a tab

## Client Content Rules (AAA Tree Service)
- NEVER publish content (GBP posts, WordPress pages, blog posts) without unique AI-generated images — no stock photos, no image-free posts
- Add internal linking logic as pages are built — link to best/priority pages
- Social media posting is an optional paid add-on — don't include it by default

## Deploy
- Deploy: `cd ~/Desktop/hitme-crm-app && npx vercel --prod`
- Git pushes to main auto-deploy via Vercel (connected to HitMeSEO/hitme-platform and HitMeSEO/hitme-crm repos)
- Always verify after deploy — load dashboard, clients, tasks

## UI / UX
- Dark/light mode toggle is built — respect it in all new components
- Client detail page has 8 tabs — don't add more without good reason, keep it clean
- Activity log exists — log meaningful actions, not every click

## Supabase
- Legacy anon key starts with `eyJ` — don't rotate without updating all env vars
- RLS policies are in place — test new features with a non-admin user to verify access
- Same env var `\n` risk as other projects — verify after setting

## GEO Radar (Phase 3)
- AI search visibility audit: checks how business appears in ChatGPT, Perplexity, Gemini
- Pricing: $500–5K one-time audit, $500/mo monitoring
- This is the upsell bridge: $249 CRM → $1,500/mo SEO services
- Pam runs the onboarding audit for every new client in week 1

## Google Places API
- Service-area businesses (SABs) require `includePureServiceAreaBusinesses: true` in the Text Search request body. Without this, Google returns empty results for any business without a physical address (fencing, plumbing, tree service, junk hauling, etc). This is critical — most of our clients are SABs.
- Do NOT add `places.reviews` or `places.serviceArea` to the Text Search field mask — they are invalid for that endpoint and cause empty results or 400 errors.
- Valid field mask for Text Search: `id, displayName, formattedAddress, nationalPhoneNumber, websiteUri, rating, userRatingCount, types, primaryTypeDisplayName, regularOpeningHours, googleMapsUri, editorialSummary`

## Onboarding Form / Public API Routes
- Public API routes (no user session) run as the anon role. The cookie-based `createClient()` from `@/lib/supabase/server` has no cookies, so it can't bypass RLS — even if you pass a `SUPABASE_SERVICE_ROLE_KEY` via a separate `createClient(url, key)` call, Supabase's new `sb_secret_...` key format is NOT a valid service_role JWT and will not bypass RLS. Only `eyJ...` JWT keys work with `@supabase/supabase-js` for RLS bypass.
- **Fix for public API writes**: Use a Postgres function with `SECURITY DEFINER` + `GRANT EXECUTE TO anon`. Call it via `supabase.rpc()`. This bypasses RLS entirely and works with the anon key. See `scripts/onboarding-rls-fix.sql`.
- **Must read CLAUDE.md + tasks/lessons.md + tasks/todo.md at the start of every session.** Skipping this causes repeated mistakes (service role key issue, .single() with joins, etc.).

## General
- "Clients" was renamed from "Prospects" in an earlier iteration — be consistent with current naming
- The Edit button on client detail was broken once — always test CRUD operations after deploying UI changes
- Server-side errors show digest codes — check Vercel logs for the actual error, the digest alone tells you nothing

## 2026-03-18 Cowork Session: Approval Flow + WordPress Push
- [2026-03-18] Cowork: When giving Tim SQL to run in Supabase, paste the actual SQL statements — don't reference a file path. Tim will paste what you give him literally.
- [2026-03-18] Cowork: Be explicit with instructions — say "copy this, paste it there, click Run" not "run the contents of file X"
- [2026-03-18] Cowork: Next.js build times out in Cowork sandbox — must build locally with `cd ~/Desktop/hitme-crm-app && npm run build`
- [2026-03-18] Cowork: WP REST API uses Basic Auth with Application Passwords — format is `username:xxxx xxxx xxxx xxxx`, base64 encoded
- [2026-03-18] Cowork: WP publishes to /wp-json/wp/v2/pages (pages) not /posts. Use PUT to update existing (by wordpress_post_id), POST to create new
- [2026-03-18] Cowork: client_approval column values: not_sent, pending, approved, changes_requested
- [2026-03-18] Cowork: When telling Tim to paste SQL, ALWAYS specify "go to Supabase SQL Editor" and "paste this block." Never reference a file path — he will paste whatever you give him literally.
- [2026-03-18] Cowork: Schema markup auto-generates on content generation AND injects into body_html on WordPress push. Stored in content_queue.schema_json as JSONB.
- [2026-03-18] Cowork: FAQ format in body_html must be <h3>Question?</h3><p>Answer</p> for schema regex extraction to work.
- [2026-03-18] Cowork: AI Readiness Score weights: content 30%, AI visibility 30%, schema 15%, GBP 15%, FAQ 10%

## 2026-03-19 Cowork Session: Pam's Bug Fixes
- [2026-03-19] Cowork: Added Snoozed + Archived task statuses to constants, filter logic, and filter buttons
- [2026-03-19] Cowork: Reordered GenerateModal — Generate Options (page type, service, link URL) now comes BEFORE the Keyword Brief section
- [2026-03-19] Cowork: Updated service page prompt to enforce Pam's location page hierarchy: META TITLE → H1 → H2 flip-flop → H3 alternating city/service → FAQ → Why Choose
- [2026-03-19] Cowork: Added service_website_build to SERVICE_KEYS in constants.js + added column to Supabase clients table
- [2026-03-19] Cowork: ContactsTab fully rewritten with add/edit/delete/set-primary CRUD
- [2026-03-19] Cowork: OverviewTab now shows Open Tasks + Recent Content sections with View All → links
- [2026-03-19] Cowork: Global tasks page (/tasks) now links to ?tab=tasks instead of just /clients/[id]
- [2026-03-19] Cowork: CRITICAL — Tim has said MULTIPLE TIMES to always break copy/paste instructions into individual separate actions/lines. NEVER combine SQL + build + deploy into one code block. Each command gets its own block.

## 2026-03-20 Cowork Session: File Split for Efficiency
- [2026-03-20] Cowork: Split page.js (3,947 lines) into 13 separate files. page.js is now ~790 lines (shell only). Each tab is its own file.
- [2026-03-20] Cowork: This dramatically reduces context usage — future changes only need to read the 200-400 line file being changed, not the whole monolith.
- [2026-03-20] Cowork: Updated CLAUDE.md with full file map under "Client Detail Page — File Map" section.
- [2026-03-20] Cowork: shared.js contains Empty and PlaceholderTab components shared across tabs.
- [2026-03-20] Cowork: Fixed deploy path in CLAUDE.md — was ~/Projects/hitme-crm, corrected to ~/Desktop/hitme-crm-app.
- [2026-03-20] Cowork: Client detail page has 10 tabs (not 8 or 9) — Onboarding tab was added previously.
- [2026-03-20] Cowork: Task save "not working" was a UX issue — save DID work but task disappeared from current filter. Fixed with auto-filter-switch + green toast message.
- [2026-03-20] Cowork: Removed "Blocked" from TASK_STATUSES in constants.js. Kept color entry for backward compat.
- [2026-03-20] Cowork: ContentTab now has expandable edit panels for non-service-page items (title, type, status, notes, body_html).
- [2026-03-20] Cowork: Research route (`/api/content/research/route.js`) timeout issue — Anthropic web search calls can take 60-90s per round. Don't use per-call AbortController. Use total deadline checked between rounds, with graceful wrap-up message to Claude.
- [2026-03-20] Cowork: Bumped research route maxDuration from 120 to 300 (Vercel Pro max). Internal deadline bumped to 270s. Client-side fetch timeout bumped to 295s. This is the DEPLOYED state as of end-of-session.
- [2026-03-20] Cowork: Per-call AbortController on Anthropic SDK causes "Request was aborted" errors — the SDK abort kills the request even when Vercel still has time. Removed entirely; rely on total deadline check between rounds only.
- [2026-03-20] Cowork: Fort Mill, SC still timed out at 120s maxDuration. Needs Kevin to retest now that maxDuration is 300s. Code is deployed but untested.
- [2026-03-20] Cowork: Vercel Pro plan ($20/mo) — all usage within included allowances, $0 overage. Not a cost concern.
- [2026-03-20] Cowork: Anthropic API billing (console.anthropic.com) is SEPARATE from the $200/mo Claude subscription. CRM research calls hit the API bill, not the subscription.
- [2026-03-20] Cowork: Kevin's "Failed to fetch" was the Vercel function timing out. Fort Mill, SC specifically triggers longer Anthropic web search calls that exceed the function timeout.

## 2026-03-22 Cowork Session: Timeout Fix + CLAUDE.md Refresh
- [2026-03-22] Cowork: CLAUDE.md now has full API route table (12 routes), Google Cloud API inventory (32 APIs), and external keys section.
- [2026-03-22] Cowork: Google Cloud reference doc at ~/Downloads/HitMeSEO_API_Reference.docx (from Google Drive folder) lists all 32 enabled APIs organized by category. Key ones for CRM: Places API (active), GBP APIs (pending approval), Search Console, GA4, PageSpeed Insights, Indexing API.
- [2026-03-22] Cowork: HIT-ME-SEO-CRM-MASTER.md and HIT-ME-SEO-CONTENT-ENGINE.md on Desktop are the master reference docs. Content engine doc has entity framework, 4 page templates (A-D), writing rules, and linking rules.
- [2026-03-22] Cowork: maxDuration=300 fix for research route is saved in code but NOT YET BUILT/DEPLOYED. Tim needs to run build + deploy before Kevin retests.

## 2026-03-23 Cowork Session: Google API Integration (Search Console, GA4, Auto-Match)
- [2026-03-23] Cowork: CRM OAuth is connected to pmadara@hitmeseo.com (the webmaster account that owns client Search Console + GA4 properties).
- [2026-03-23] Cowork: Google Cloud project is `hitme-platform` (project number 254502334444). Two projects exist — `hitme-platform` (Tim has access) vs `hit-me-seo` (different project, no access).
- [2026-03-23] Cowork: OAuth consent screen is in "Testing" mode — restricted to test users: hitmeseo@gmail.com, pmadara@hitmeseo.com, timmarose@gmail.com.
- [2026-03-23] Cowork: Three Google accounts involved: timmarose@gmail.com, pmadara@hitmeseo.com (webmaster), hitmeseo@gmail.com.
- [2026-03-23] Cowork: Search Console property URL formats vary: `sc-domain:example.com`, `https://www.example.com/`, `https://example.com/`, etc. Auto-detection logic in search-console route resolves the correct format by listing all sites and matching by domain priority.
- [2026-03-23] Cowork: GA4 Admin API (`analyticsadmin.googleapis.com`) is SEPARATE from GA4 Data API (`analyticsdata.googleapis.com`). Admin API needed to list properties — had to enable it separately in Google Cloud Console.
- [2026-03-23] Cowork: Search Console confirmed working via Wolfgang Hauling (200 clicks, 10K+ impressions). GA4 confirmed working via Dominics Paving (property 252720119, returned zeros — likely old/inactive property).
- [2026-03-23] Cowork: Auto-match fuzzy logic with single-word matching caused bad matches (e.g., "service" in "AAA Tree Service" matched "tchvacservices"). Fixed by requiring 2+ word matches for fuzzy.
- [2026-03-23] Cowork: 7 clients got correct GA4 property IDs auto-populated. 15 clients matched in Search Console. Dominics Paving already had its property ID from a prior session.
- [2026-03-23] Cowork: Improved Search Console + GA4 UI cards: period selectors (7d/28d/90d), Queries/Pages tabs, Channels/Pages tabs, property URL/ID in footers, better error messages.
- [2026-03-23] Cowork: Dark/light mode toggle is still in sidebar footer (bottom-left, Sun/Moon icon). It works but is subtle — Pam had trouble finding it. Consider making it more prominent.
- [2026-03-23] Cowork: Next.js builds time out in Cowork sandbox — Tim must always build locally via `npx vercel --prod --yes`.

## 2026-03-23 Cowork Session 3: Autosave Fix, Form Upload, SEO Audit Tab Wiring
- [2026-03-23] Cowork: SEO Audit tab was built but never wired into page.js — import + tab entry + render were all missing. CLAUDE.md said it was "SHELVED" but the component was ready. Fixed by adding the import and tab entry.
- [2026-03-23] Cowork: Client detail page now has 11 tabs (not 10): Overview, Tasks, Content, Notes, Services, Locations, Contacts, GBP Health, SEO Audit, Wiki, Onboarding.
- [2026-03-23] Cowork: Onboarding form autosave was dangerously weak — showed "Saved" even on failure, no save on tab close, no periodic backup, no retry. Beckett Siteworx client lost data because of this. Fixed with 5-layer save: debounced (800ms) + periodic (15s) + beforeunload (fetch keepalive) + visibilitychange + retry with backoff (2s/4s/6s).
- [2026-03-23] Cowork: `sendBeacon` cannot set custom headers — Supabase REST API needs `apikey` + `Authorization` headers + PATCH method. Replaced with `fetch({ keepalive: true })` which supports all of that.
- [2026-03-23] Cowork: Onboarding form upload feature uses Claude Vision (Sonnet) to extract form fields from photos, PDFs, or Word docs. PDFs use `type: 'document'` in Claude API (not `type: 'image'`). Word docs (.docx) use mammoth.js client-side text extraction.
- [2026-03-23] Cowork: Kevin's wishlist scored 9/17 features built (53%). All core SEO reporting, content, and audit features are live. Remaining: Ahrefs integration, social media posting, Google Ads integration, and Phase 2 items.
- [2026-03-23] Cowork: Created a one-sheeter PDF (Hit_Me_SEO_CRM_Guide.pdf) for Pam/Kevin showing all features + Kevin's wishlist status tracker.
- [2026-03-23] Cowork: Beckett Siteworx onboarding form showed "in_progress" but empty form_data — client opened the link (triggering status change to in_progress) but never typed anything. They used a separate physical discovery form instead.
- [2026-03-23] Cowork: Don't repeat instructions Tim has already confirmed completing. He ran SQL migrations before deploying — don't tell him to run them again.
- [2026-03-23] Cowork: Chrome extension (Claude in Chrome) disconnects frequently during Cowork sessions. Use Control Chrome MCP as fallback, or just describe where to navigate.
- [2026-03-23] Cowork: Client image management is next priority — Pam wants to pull images from client document folders, track usage (website vs GBP), and prevent reuse. This is a future build item.

## 2026-03-25 Claude Code Session: Citation Health + /last30days Research
- [2026-03-25] Claude Code: TWO REPOS EXIST — `HitMeSEO/hitme-crm` is PRODUCTION (Supabase direct, JS, no Prisma). `HitMeSEO/hitme-platform` is OLD/deprecated (Prisma, TypeScript). Built entire citation feature in WRONG repo first, had to rebuild. ALWAYS work in hitme-crm.
- [2026-03-25] Claude Code: hitme-crm deploys via git push to main (Vercel auto-deploys from GitHub). hitme-platform deploys via `npx vercel --prod` to a DIFFERENT Vercel project. Production URL is hitme-crm-app.vercel.app.
- [2026-03-25] Claude Code: Local build fails without Supabase env vars (`supabaseUrl is required`). Build works on Vercel because env vars are set there. For local builds, need .env.local with real NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
- [2026-03-25] Claude Code: SQL migrations must be pasted directly into Supabase SQL Editor — don't reference file paths. Tim pastes what you give him literally.
- [2026-03-25] Claude Code: /last30days skill installed at ~/.claude/skills/last30days. API keys in ~/.config/last30days/.env (AUTH_TOKEN, CT0 for X/Twitter, SCRAPECREATORS_API_KEY for Reddit). Research saves to ~/Documents/Last30Days/.
- [2026-03-25] Claude Code: Client detail page now has 13 tabs (Citations added between SEO Audit and Wiki).
- [2026-03-25] Claude Code: Citation audit uses Claude AI assessment (not live web scraping) — same pattern as SEO audit. Practical and fast, but results are estimations.
- [2026-03-25] Claude Code: Client industry matching for directories now checks `business_services` JSONB array + `industry_type` string. Important because many clients have services that don't match their top-level industry.
- [2026-03-25] Claude Code: Tracking workflow uses direct Supabase client-side updates (no API route needed for simple status changes). createClient() from @/lib/supabase/client works for authenticated users.
- [2026-03-25] Claude Code: Tim's clients are primarily: home services, dumpster rental, junk hauling, moving, paving, roofing, fencing, HVAC. Directory list was expanded from 12 to 40+ to cover these industries.

## 2026-03-23 Cowork Session 4: Images Tab + Google Drive Integration
- [2026-03-23] Cowork: Built Images tab — full gallery UI with usage tracking (website, gbp, social, blog), filter bar, stats bar, mark-as-used/clear-usage actions, open-in-Drive links.
- [2026-03-23] Cowork: Images API route (`/api/clients/[id]/images`) uses Google Drive API to list image files from a client's `image_folder` URL. Merges with `image_assets` Supabase table for usage tracking.
- [2026-03-23] Cowork: `image_assets` table tracks which images have been used where — columns: client_id, drive_file_id, file_name, used_on, used_for, content_id, used_date. Unique constraint on (client_id, drive_file_id).
- [2026-03-23] Cowork: Added `drive.readonly` scope to Google OAuth in `lib/google-auth.js`. Tim already re-authorized Google in the prior session — no need to re-auth again.
- [2026-03-23] Cowork: Client detail page now has 12 tabs: Overview, Tasks, Content, Notes, Services, Locations, Contacts, GBP Health, Images, SEO Audit, Wiki, Onboarding.
- [2026-03-23] Cowork: Some clients use Dropbox for image folders, not Google Drive. Added detection — if URL contains `dropbox.com`, shows "Dropbox integration coming soon" message instead of a confusing parse error.
- [2026-03-23] Cowork: Image Folder field already exists in client edit form (under Folder Links). Clients need a Google Drive folder URL there for the Images tab to work.
- [2026-03-23] Cowork: Don't ask Tim to re-authorize Google if he already did it. Check with him first instead of assuming it hasn't been done.

## 2026-03-25 Bulk Location Content Engine
- [LESSON] Pam's standalone Location Page Generator was cleaning-service only with manual copy-paste workflow. Building bulk generation INTO the CRM eliminates the manual process and works for all industries.
- [LESSON] The activities/summarize route had a build-time error because it created Supabase client at module level (outside handler). Always create API clients inside the handler function.
- [LESSON] For bulk operations exceeding Vercel's 300s timeout, use client-side orchestration with chunked API calls. Process 8-10 locations per request for generation, 3-4 for research.
- [LESSON] The variation system (opening style rotation, service order shuffle, FAQ rotation, previous-page anti-duplication snippets) is critical for uniqueness across 20+ location pages.
- [LESSON] 5-gram overlap detection (from Pam's tool) is a solid uniqueness metric. Score of 100 = no overlap, <70 = flagged for review.

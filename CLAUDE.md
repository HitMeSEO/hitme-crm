# Hit Me SEO CRM — Claude Code Configuration

## Project Overview
Hit Me SEO CRM (hitme-crm-app.vercel.app) — internal CRM for Hit Me SEO agency. 3 users: Tim (admin), Pam (admin), Kevin (operator — no financial data).
- **GitHub:** HitMeSEO/hitme-crm
- **Supabase:** pcrkgltlzmplsocvmieq (direct SQL queries, NOT Prisma)
- **Vercel:** Pro plan, team tim-maroses-projects
- **Deploy:** `cd ~/Desktop/hitme-crm-app && npx vercel --prod --yes`
- **Logs:** `npx vercel logs https://hitme-crm-app.vercel.app --no-follow -n 100 --scope tim-maroses-projects`

## CRITICAL RULES
1. **NO PRISMA** — This project uses direct Supabase client queries. Never add Prisma.
2. **Test before deploying** — `npm run build` must pass with zero errors before `vercel --prod`.
3. **Verify after deploying** — Load the site, click through clients, check the feature you changed.
4. **Never use .single() with joins** — Supabase .single() fails when a join returns multiple rows. Always fetch related data (locations, contacts) in a separate query.
5. **RLS is enabled** — All API routes must use the authenticated Supabase client from `@/lib/supabase/server`, NOT `createClient(url, anonKey)`. Unauthenticated clients return 0 rows.
6. **Dark/light mode** — Every new component must work in both themes. Use CSS variables.
7. **Keep it simple** — Tim has ADHD. Less is more. Don't add features that weren't asked for.
8. **Google Places API** — Key is in GOOGLE_PLACES_API_KEY env var. Valid field mask for Text Search: id, displayName, formattedAddress, nationalPhoneNumber, websiteUri, rating, userRatingCount, types, primaryTypeDisplayName, regularOpeningHours, googleMapsUri, editorialSummary. Do NOT use: reviews, serviceArea (invalid for Text Search).
9. **Anthropic API** — Key is in ANTHROPIC_API_KEY env var. Valid model: `claude-sonnet-4-5-20250929`. Not `claude-sonnet-4-20250514`, not `claude-3-5-sonnet-20241022`, not `claude-opus-4-5`. Billed separately at console.anthropic.com — NOT covered by $200/mo Claude subscription.
10. **Research route timeout** — maxDuration=300 (Vercel Pro max). Internal deadline 270s with graceful wrap-up. Do NOT use per-call AbortController on Anthropic SDK — it causes "Request was aborted" errors.

## Workflow
1. Plan before building (3+ step tasks)
2. Build it
3. `npm run build` — fix all errors
4. Test locally if possible
5. Deploy: `npx vercel --prod --yes`
6. Verify live: open the site, test the feature
7. Report back what was done

## Architecture
- Next.js App Router (no `src/` directory — `app/` is at root)
- Supabase (PostgreSQL with RLS)
- Tailwind CSS + custom dark/light theme
- Client detail page has 11 tabs: Overview, Tasks, Content, Notes, Wiki, Services, Locations, Contacts, GBP Health, SEO Audit, Onboarding
- 19 active clients, 102 locations migrated from Pam's CRM

## API Routes (app/api/)
| Route | Method | What it does | maxDuration | Uses Anthropic? |
|-------|--------|-------------|-------------|-----------------|
| `/api/content/research` | POST | Keyword brief generator — Claude web search analyzes top-ranking pages for service+city combo, returns JSON brief | 300s | Yes (Sonnet + web_search, multi-round) |
| `/api/content/generate` | POST | Generates content from keyword brief — service_location_page, blog_post, gbp_post | 120s | Yes (Sonnet) |
| `/api/content/publish` | POST | Pushes content to WordPress via WP REST API (Basic Auth + Application Passwords) | default | No |
| `/api/content/schema` | POST | Generates schema markup (LocalBusiness, Service, FAQ) for content items, single or bulk | default | No |
| `/api/geo-radar/scan` | POST | AI search visibility scanner — queries ChatGPT/Perplexity/Gemini style prompts via Claude web search | 120s | Yes (Sonnet + web_search) |
| `/api/places/search` | POST | Google Places API Text Search — simple query, returns business results | default | No |
| `/api/places/lookup` | POST | Google Places API lookup by place ID — detailed business data | default | No |
| `/api/audit` | POST | Master SEO audit — scans content/schema/GBP/FAQ gaps, calculates AI readiness score | default | No |
| `/api/audit/fix` | POST | Audit fix suggestions | default | Yes |
| `/api/clients/[id]/audit` | GET | Fetch audit data for a client (incl. previous_audit_snapshot for before/after) | default | No |
| `/api/clients/[id]/run-audit` | POST | 10-step AI audit with Claude analysis, PageSpeed, robots.txt, sitemap pre-fetch | 60s | Yes |
| `/api/content/generate-gbp-batch` | POST | Batch GBP post generation with service × neighborhood rotation, scheduling | 300s | Yes |
| `/api/email/send-approval` | POST | Send content approval email to client via Resend API | default | No |
| `/api/google/analytics` | GET | GA4 data — sessions, users, pageviews, channels, pages for a client | default | No |
| `/api/google/analytics-properties` | GET | List all GA4 properties from connected account | default | No |
| `/api/google/auto-match` | GET/POST/DELETE | Auto-match GA4 properties + Search Console sites to clients | default | No |
| `/api/google/connect` | GET | Start Google OAuth2 flow | default | No |
| `/api/google/callback` | GET | Handle Google OAuth2 callback, store tokens | default | No |
| `/api/google/search-console` | GET | Search Console data — clicks, impressions, queries, pages for a client | default | No |
| `/api/google/search-console-sites` | GET | List all Search Console sites from connected account | default | No |
| `/api/google/indexing` | POST | Submit URLs to Google Indexing API | default | No |
| `/api/onboard/[token]/submit` | POST | Public onboarding form submission (uses SECURITY DEFINER Postgres function to bypass RLS) | default | No |

## External APIs & Keys (in .env.local AND Vercel)
- **ANTHROPIC_API_KEY** — Billed separately at console.anthropic.com (NOT covered by $200/mo Claude subscription)
- **GOOGLE_PLACES_API_KEY** — Maps Platform API Key from timmarose@gmail.com, hitme-platform Google Cloud project (restricted to 32 APIs)
- **WordPress** — WP REST API with Basic Auth + Application Passwords per client site
- **GBP API** — PENDING approval from Google. Once approved: real categories, service areas, direct posting, review management

## Google Cloud Project: hitme-platform (32 Enabled APIs)
Reference doc: `~/Downloads/HitMeSEO_API_Reference.docx` (March 21, 2026)

**GBP APIs (PENDING approval):** My Business Account Management, My Business Business Information, Business Profile Performance, My Business Notifications, My Business Q&A, My Business Verifications
**Google Ads:** Google Ads API, Display & Video 360 API
**Analytics & Reporting:** GA4 Data API, GA4 Admin API, Search Console API, PageSpeed Insights API, Looker Studio API, Analytics Hub API
**Maps & Location (ACTIVE in CRM):** Maps JavaScript API, Places API, Geocoding API, Street View Static API
**Data/BigQuery:** BigQuery API + Connection/Data Policy/Data Transfer/Migration/Reservation/Storage APIs, Cloud Datastore, Cloud SQL, Cloud Storage (+ JSON API), Dataform API, Dataplex API
**Verification & Indexing:** Site Verification API, Web Search Indexing API
**Productivity:** Gmail API, Google Drive API, Google Sheets API, Google Calendar API
**Infrastructure:** Cloud APIs, Service Management, Service Usage, Cloud Logging, Cloud Monitoring, Cloud Trace

## Client Detail Page — File Map (app/clients/[id]/)
The client detail page was split into separate files on 2026-03-20 for efficiency.
- **page.js** (~790 lines) — Shell: state, data loading, header, edit modal, tab bar, tab routing
- **OverviewTab.js** — Company info, GBP summary, primary contact, services, open tasks, recent content
- **TasksTab.js** — Full CRUD for tasks with filters (open/done/snoozed/archived), comments, team assignment
- **ContentTab.js** — Content queue CRUD + ServicePageEditor for editing service location pages
- **NotesTab.js** — Activity/notes log with add form
- **LocationsTab.js** — Locations list, research, content generation, AddServiceAreaModal, GenerateModal, KeywordBriefModal
- **ContactsTab.js** — Contact CRUD with add/edit/delete/set-primary
- **WikiTab.js** — Wiki links organized by section (WIKI_LINK_TYPES constant included)
- **ServicesTab.js** — Service toggle switches
- **OnboardingTab.js** — Onboarding form display
- **GbpHealthTab.js** — GBP health dashboard (was already separate)
- **FolderLinksRow.js** — Quick-access document links row (Drive, Images, Content, Dropbox)
- **shared.js** — Small shared components (Empty, PlaceholderTab)
- **SeoAuditTab.js** — 10-step AI SEO audit with before/after comparison deltas on re-scan

## Database
- Supabase project: pcrkgltlzmplsocvmieq
- Schema created via raw SQL in Supabase SQL Editor (not Prisma migrations)
- Key tables: clients, locations, contacts, tasks, content_queue, activities, documents, wiki_links, looker_links, team_members, profiles, assignments, geo_radar_scans
- Client GBP columns: gbp_place_id, gbp_rating, gbp_review_count, gbp_categories, gbp_hours, gbp_maps_url, gbp_reviews, gbp_editorial_summary, gbp_service_areas, gbp_action_checklist, gbp_health_notes, gbp_last_post_date, gbp_post_frequency
- Audit columns: audit_status, audit_progress, step1-step10, site_data_cache, previous_audit_snapshot (JSONB for before/after)
- Content queue columns include: scheduled_date (DATE for GBP scheduling)

## Common Mistakes to Avoid
- Using Prisma (we don't use it)
- Using .single() with location joins (breaks on multi-location clients)
- Using unauthenticated Supabase client (RLS blocks all reads)
- Adding `places.reviews` or `places.serviceArea` to Places API Text Search field mask (invalid, causes 400 error or empty results)
- Using wrong Claude model names
- Deploying without testing build first
- Deploying without verifying all API routes respond (test with empty body to confirm validation errors, not crashes)

## Self-Improvement Loop (MANDATORY)

At the END of every session, before you say you're done:
1. Create or append to tasks/lessons.md with what worked, what failed, and what to do differently next time
2. Create or append to tasks/todo.md with any unfinished items
3. At the START of every session, read tasks/lessons.md and tasks/todo.md FIRST before doing anything else
4. Never repeat a mistake that's already documented in lessons.md
5. Format each lesson as: [DATE] [AGENT] [LESSON] — e.g. "2026-03-17 SEO Specialist: Frase scores below 85 always need a second pass"

This is not optional. Every session must end with lessons written.

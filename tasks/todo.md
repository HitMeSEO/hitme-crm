# Hit Me CRM — Todo

## DONE 2026-03-20
- ✅ 13-file refactor deployed and live
- ✅ Pam bug fixes deployed: task save UX (auto-filter-switch + toast), removed Blocked status, ContentTab expandable editing
- ✅ Research route timeout hardening: removed per-call abort, added total deadline + graceful wrap-up + logging

## Needs Testing Monday: Research Route Timeout Fix
- ✅ maxDuration bumped from 120 → 300 (code saved, needs build+deploy)
- ✅ Internal deadline bumped from 105s → 270s
- ✅ Client-side timeout bumped from 115s → 295s
- ✅ Removed per-call AbortController (was causing "Request was aborted" errors)
- ⚠️ CODE IS SAVED BUT NOT YET BUILT/DEPLOYED — Tim needs to run:
  - `cd ~/Desktop/hitme-crm-app && npm run build`
  - `npx vercel --prod --yes`
- Then Kevin retests Fort Mill, SC
- If still failing after 300s, next options:
  1. Reduce search queries from 6 to 3 for initial call
  2. Split research into async start + poll pattern
  3. Check Vercel logs: `npx vercel logs https://hitme-crm-app.vercel.app --no-follow -n 50 --scope tim-maroses-projects`

## DONE 2026-03-23
- ✅ CRM OAuth connected to pmadara@hitmeseo.com (webmaster account)
- ✅ Search Console API route with auto-detection of property URL format
- ✅ GA4 Analytics API route pulling sessions, users, pageviews, channels, pages
- ✅ GA4 Admin API enabled in Google Cloud Console (separate from Data API)
- ✅ Diagnostic endpoints: `/api/google/search-console-sites`, `/api/google/analytics-properties`
- ✅ Auto-match endpoint (`/api/google/auto-match`): GET=dry run, POST=save, DELETE=clear bad matches
- ✅ 7 clients auto-populated with GA4 property IDs (domain + fuzzy matching)
- ✅ 15 clients matched in Search Console
- ✅ Fuzzy matching tightened (require 2+ word matches to prevent false positives)
- ✅ Search Console card improved: 7d/28d/90d period selector, Queries/Pages tabs, impressions column, property URL footer
- ✅ GA4 Analytics card improved: 7d/28d/90d period selector, Channels/Pages tabs, property ID footer
- ✅ Better error messages (Search Console shows "Site not found" instead of raw API error)

## DONE 2026-03-23 (Session 2 — "Still to Build" Sprint)
- ✅ GBP post auto-generation: batch endpoint with service × neighborhood rotation, previous post awareness
- ✅ GBP post scheduling: weekly/biweekly spread, scheduled_date column on content_queue
- ✅ Resend email integration: send-approval endpoint via Resend API, branded HTML email
- ✅ Email on "Send for Approval": ContentTab wired to call send-approval, email status feedback
- ✅ Bulk content generation progress bar: pulsing gradient animation during GBP batch gen
- ✅ Before/after comparison on re-scan: previous_audit_snapshot saved before reset, delta badges (↑↓) on all scores
- ⚠️ SQL MIGRATIONS NEEDED (run in Supabase SQL Editor):
  - `ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS scheduled_date DATE;`
  - `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS previous_audit_snapshot JSONB;`
- ⚠️ ENV VAR NEEDED: Add RESEND_API_KEY to Vercel environment variables
- ⚠️ DEPLOY NEEDED: `cd ~/Desktop/hitme-crm-app && npm run build && npx vercel --prod --yes`

## DONE 2026-03-23 (Session 3 — Autosave, Upload, Audit Tab)
- ✅ Before/after comparison on re-scan: previous_audit_snapshot JSONB column, DeltaBadge component with ↑↓ indicators
- ✅ SEO Audit tab wired into page.js (was built but never imported/rendered)
- ✅ Bulletproof autosave on onboarding form: 5-layer save (debounce + periodic 15s + beforeunload keepalive + visibilitychange + retry with backoff)
- ✅ Fixed sendBeacon → fetch with keepalive (sendBeacon can't set Supabase auth headers)
- ✅ Onboarding form upload feature: drag-and-drop on Onboarding tab, Claude Vision extracts form fields
- ✅ PDF support for form upload (Claude API document type)
- ✅ Word doc (.docx) support for form upload (mammoth.js client-side text extraction)
- ✅ One-sheeter PDF guide created (Hit_Me_SEO_CRM_Guide.pdf) for Pam/Kevin
- ✅ CLAUDE.md updated: 11 tabs, removed SHELVED references, full API route table, new columns
- ✅ tasks/todo.md updated with Session 2 completed items
- ✅ Zero console errors verified across CRM backend + public onboarding form
- ⚠️ NEEDS DEPLOY: Form upload PDF/Word support + mammoth dependency
  - `cd ~/Desktop/hitme-crm-app && npx vercel --prod --yes`

## DONE 2026-03-23 (Session 4 — Images Tab + Google Drive)
- ✅ Images tab built: gallery UI, stats bar, filter bar (All/Unused/Website/GBP/Social/Blog), usage badges, mark-as-used form, clear usage, open-in-Drive
- ✅ Images API route (`/api/clients/[id]/images`): GET lists from Google Drive, POST marks used, DELETE clears usage
- ✅ `image_assets` Supabase table created with RLS policies (SELECT/INSERT/UPDATE/DELETE for authenticated)
- ✅ Google Drive `drive.readonly` scope added to OAuth — Tim already re-authorized
- ✅ Dropbox URL detection: shows "Dropbox integration coming soon" instead of parse error
- ✅ Client detail page now has 12 tabs (Images added between GBP Health and SEO Audit)
- ✅ tasks/lessons.md and tasks/todo.md updated

## DONE 2026-03-23 (Session 4 continued — Dropbox + GBP Image Attachments)
- ✅ Dropbox integration: OAuth flow (connect/callback), token storage, folder listing with shared link resolution
- ✅ Images tab works with both Google Drive and Dropbox folders automatically
- ✅ Dropbox app created: App key slva9vdoxklbwrl, redirect URI configured
- ✅ dropbox_tokens table + RLS policies in Supabase
- ✅ GBP post image attachments: image picker in content edit panel, pulls from client's image folder
- ✅ image_url + image_file_id columns on content_queue
- ✅ Auto-marks image as "used for GBP" when attached to a post
- ✅ Image thumbnail shows on content row for posts with attached images

## DONE 2026-03-23 (Session 5 — Schema Markup System)
- ✅ Schema generation engine: Service, BreadcrumbList, FAQPage, WebPage per page
- ✅ `extractServiceAndArea()` parser handles 5 title formats (City State Service, Service in City State, etc.)
- ✅ Image schema support: Service.image + WebPage.primaryImageOfPage for unique image-to-page binding
- ✅ serviceType field for extra page uniqueness signal
- ✅ Schema preview endpoint (`/api/content/preview-schema`): bulk or single-page preview with warnings
- ✅ Schema generate endpoint (`/api/content/schema`): saves schema_json to content_queue
- ✅ Push-schema endpoint (`/api/content/push-schema`): writes to WP `_hitme_schema` meta field via REST API
- ✅ Publish endpoint (`/api/content/publish`): WebPage schema included in new page creation
- ✅ WordPress mu-plugin created (`scripts/hitme-schema-output.php`): reads meta field → renders JSON-LD in `<head>`
- ✅ WP credentials verified for charlottesbestroofing.com (user: webdev, Application Password)
- ✅ 2 test content_queue records created linked to real WP pages (Ballantyne ID 11731, Mooresville ID 11723)
- ✅ Schema preview tested live: correct service names, areas, FAQ extraction, provider rating
- ✅ image_url + image_file_id columns migrated on content_queue table
- ✅ Old JSON-LD stripped from both test pages (WP content sanitization issue discovered + fixed)
- ✅ Yoast SEO coexistence confirmed (our schema goes alongside Yoast's @graph output)

## DONE 2026-03-24 (Session 6 — Google Map Embeds + Schema Fixes)
- ✅ Google Map embed system built (`lib/map-embed.js`): GBP listing embed using place_id + search fallback
- ✅ Maps Embed API enabled in Google Cloud Console (free, no usage fees)
- ✅ Map embed auto-appended to service location pages at bottom of body_html during content generation
- ✅ Publish route updated: appends map embed to existing pages if not already present
- ✅ Publish route fixed: schema no longer injected into content body (WP strips <script> tags); now uses `_hitme_schema` meta field
- ✅ Both embed modes tested live on Charlotte's Best Roofing: place_id mode (exact GBP pin) + search mode (service area cities)
- ✅ Embed shows: business name, address, 5.0★ rating, 224 reviews, directions button, "View on Google Maps" link
- ✅ Responsive iframe with 16:9 aspect ratio, rounded corners, shadow, "Our Service Area" header

## DONE 2026-03-24 (Session 7 — Editable GBP Post Tracker)
- ✅ Post Tracker section in GBP Health tab now fully editable (was static placeholder)
- ✅ Date picker for "Last Post" field — saves to `gbp_last_post_date` on clients table
- ✅ "Days Since Post" auto-calculates from last post date with color coding (green ≤7d, yellow ≤14d, red >14d)
- ✅ Post Frequency selector: daily, 3x/week, 2x/week, weekly, biweekly, monthly
- ✅ Overdue warning banner when days since post exceeds target frequency
- ✅ Auto-save on change with "Saving..." / "✓ Saved" feedback
- ⚠️ SQL MIGRATION NEEDED (run in Supabase SQL Editor):
  - `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gbp_last_post_date DATE;`
  - `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gbp_post_frequency TEXT DEFAULT 'weekly';`
- ⚠️ DEPLOY NEEDED: `cd ~/Desktop/hitme-crm-app && npm run build && npx vercel --prod --yes`

## Upcoming — Needs Action
### Immediate (blocked on deploy + client authorization)
1. **Git push** — run `git push origin main` to deploy schema system + push-schema fix to Vercel
2. **Client authorization** — get Charlotte's Best Roofing's OK to install the mu-plugin on their WP site
3. **Install mu-plugin** — Kevin/someone with FTP access uploads `scripts/hitme-schema-output.php` to `wp-content/mu-plugins/` on charlottesbestroofing.com
4. **Re-push schema + validate** — once mu-plugin is installed, push schema and test with Google Rich Results Test
5. **Research route timeout** — Kevin needs to retest Fort Mill, SC after deploy (maxDuration=300 code ready)

### Next Features
- In-app help/guide page (Tim mentioned as option, not yet prioritized)
- Schema UI in Content tab — Preview Schema / Push Schema buttons per content item
- Bulk schema push across all client pages with progress feedback
- Image attachment workflow — pick unique image per page before schema push

## DONE 2026-03-25 (Claude Code Session: Citation Health Feature)
- ✅ Citation Health tab built: NAP consistency auditing across 40+ directories
- ✅ 14 core directories (Google, Yelp, BBB, Apple Maps, Facebook, Bing Places, etc.)
- ✅ 30+ industry-specific directories (Angi, HomeAdvisor, Porch, GAF, Carrier, Dumpsters.com, Moving.com, etc.)
- ✅ Data aggregators included (Data Axle, Neustar Localeze, Factual)
- ✅ Manufacturer directories (GAF, Owens Corning, CertainTeed, Carrier, Trane, Lennox)
- ✅ Claim/Fix action buttons with direct URLs to each directory's signup/claim page
- ✅ Tracking workflow: Not Listed → Submitted → Claimed → Verified dropdown per citation
- ✅ Citation Building Progress card with counts per tracking status
- ✅ Health score (0-100) with color-coded bar
- ✅ Filter by: All, Correct, Issues, Missing
- ✅ Supabase tables: citation_audits + citations (with RLS)
- ✅ API route: /api/citations (GET latest audit, POST multi-step audit)
- ✅ /last30days research skill installed for team research

## Upcoming — Feature 2: Bulk Location Content Generation
- Pam has location page generator files in Google Drive: https://drive.google.com/drive/folders/1L39a3nPjwbviHbcJpw0Mb1onKPfpjC-B?usp=sharing
- Generate unique SEO-optimized service landing pages for each client's ~20 service locations
- Must follow client's brandVoice and existing content style
- Uses targetCities + targetKeywords + primaryServices from client data
- Store with status workflow: DRAFT → APPROVED → PUBLISHED

## Upcoming — Feature 3: Weekly Rank Tracking
- Track keyword rankings weekly per client
- Historical rank data with trends
- Feed into monthly reports

## Upcoming — Feature 4: Automated Review Response Drafting
- Nightly cron to AI-draft responses for all NEW reviews
- Configurable per client: auto-approve positive (4-5 star) vs hold all for review
- Uses existing review management workflow

## Phase 3: Site Link Audit (crawl client website)
- Extend audit route to GET page HTML instead of just HEAD
- Parse all <a href> tags from each page
- Categorize: internal links, outbound links, broken links (404)
- Cross-reference against sitemap.xml to find orphaned pages
- Report: pages with zero inbound internal links, broken link list, link density per page
- Feed crawl data into content generator so new pages auto-include correct internal links
- Store results in client_audits as link_audit_results JSONB
- Show in AI Readiness Dashboard as "Link Health" metric

## DONE 2026-03-25
- ✅ Citation Audit feature: tracking_status workflow (Not Listed → Submitted → Claimed → Verified), 70+ industry-specific directories for home services
- ✅ Bulk Location Content Engine: bulk-generate API, uniqueness-check API, variation system, BulkGenerateModal in LocationsTab, quality score badges in ContentTab
- ✅ Fixed activities/summarize build error

## TODO
- [ ] Test bulk generation with a client that has 3-4 locations before running full 20
- [ ] Add content_restrictions field to client settings edit form so Pam can set per-client restrictions
- [ ] Consider refactoring generate/route.js to import WRITING_RULES and buildServicePagePrompt from lib/content-engine.js (currently duplicated)
- [ ] Review automation (Feature 4 from original plan)

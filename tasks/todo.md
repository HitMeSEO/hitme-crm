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

## Still To Build
- In-app help/guide page (Tim mentioned as option, not yet prioritized)
- Research route timeout: maxDuration=300 code saved, Kevin needs to retest Fort Mill, SC after deploy

## Phase 3: Site Link Audit (crawl client website)
- Extend audit route to GET page HTML instead of just HEAD
- Parse all <a href> tags from each page
- Categorize: internal links, outbound links, broken links (404)
- Cross-reference against sitemap.xml to find orphaned pages
- Report: pages with zero inbound internal links, broken link list, link density per page
- Feed crawl data into content generator so new pages auto-include correct internal links
- Store results in client_audits as link_audit_results JSONB
- Show in AI Readiness Dashboard as "Link Health" metric

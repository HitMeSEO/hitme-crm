-- ============================================================
-- Enable RLS on ALL tables + add authenticated user policies
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- This locks down all tables so only logged-in users can access data.
-- The onboarding anon policies (from onboarding-rls-fix.sql) are preserved.
-- The activities/summarize API route uses service_role_key so it bypasses RLS.
-- ============================================================

-- ── 1. Enable RLS on every table ──
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_radar_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.looker_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropbox_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_keywords ENABLE ROW LEVEL SECURITY;

-- activity_log may or may not exist — safe to try
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 2. Authenticated user policies (full CRUD for logged-in team members) ──
-- Pattern: DROP IF EXISTS then CREATE, so this script is idempotent.

-- clients
DROP POLICY IF EXISTS "Auth full access clients" ON public.clients;
CREATE POLICY "Auth full access clients"
  ON public.clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- client_settings
DROP POLICY IF EXISTS "Auth full access client_settings" ON public.client_settings;
CREATE POLICY "Auth full access client_settings"
  ON public.client_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- client_audits
DROP POLICY IF EXISTS "Auth full access client_audits" ON public.client_audits;
CREATE POLICY "Auth full access client_audits"
  ON public.client_audits FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- contacts
DROP POLICY IF EXISTS "Auth full access contacts" ON public.contacts;
CREATE POLICY "Auth full access contacts"
  ON public.contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- content_queue
DROP POLICY IF EXISTS "Auth full access content_queue" ON public.content_queue;
CREATE POLICY "Auth full access content_queue"
  ON public.content_queue FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- locations
DROP POLICY IF EXISTS "Auth full access locations" ON public.locations;
CREATE POLICY "Auth full access locations"
  ON public.locations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- tasks
DROP POLICY IF EXISTS "Auth full access tasks" ON public.tasks;
CREATE POLICY "Auth full access tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- task_comments
DROP POLICY IF EXISTS "Auth full access task_comments" ON public.task_comments;
CREATE POLICY "Auth full access task_comments"
  ON public.task_comments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- activities
DROP POLICY IF EXISTS "Auth full access activities" ON public.activities;
CREATE POLICY "Auth full access activities"
  ON public.activities FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Auth full access profiles" ON public.profiles;
CREATE POLICY "Auth full access profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- team_members
DROP POLICY IF EXISTS "Auth full access team_members" ON public.team_members;
CREATE POLICY "Auth full access team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- onboarding_forms (authenticated + anon read/update by token)
DROP POLICY IF EXISTS "Auth full access onboarding_forms" ON public.onboarding_forms;
CREATE POLICY "Auth full access onboarding_forms"
  ON public.onboarding_forms FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon select onboarding_forms" ON public.onboarding_forms;
CREATE POLICY "Anon select onboarding_forms"
  ON public.onboarding_forms FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon update onboarding_forms" ON public.onboarding_forms;
CREATE POLICY "Anon update onboarding_forms"
  ON public.onboarding_forms FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- geo_radar_scans
DROP POLICY IF EXISTS "Auth full access geo_radar_scans" ON public.geo_radar_scans;
CREATE POLICY "Auth full access geo_radar_scans"
  ON public.geo_radar_scans FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- image_assets
DROP POLICY IF EXISTS "Auth full access image_assets" ON public.image_assets;
CREATE POLICY "Auth full access image_assets"
  ON public.image_assets FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- wiki_links
DROP POLICY IF EXISTS "Auth full access wiki_links" ON public.wiki_links;
CREATE POLICY "Auth full access wiki_links"
  ON public.wiki_links FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- looker_links
DROP POLICY IF EXISTS "Auth full access looker_links" ON public.looker_links;
CREATE POLICY "Auth full access looker_links"
  ON public.looker_links FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- google_tokens
DROP POLICY IF EXISTS "Auth full access google_tokens" ON public.google_tokens;
CREATE POLICY "Auth full access google_tokens"
  ON public.google_tokens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- dropbox_tokens
DROP POLICY IF EXISTS "Auth full access dropbox_tokens" ON public.dropbox_tokens;
CREATE POLICY "Auth full access dropbox_tokens"
  ON public.dropbox_tokens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- vertical_keywords
DROP POLICY IF EXISTS "Auth full access vertical_keywords" ON public.vertical_keywords;
CREATE POLICY "Auth full access vertical_keywords"
  ON public.vertical_keywords FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- activity_log (if exists)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth full access activity_log" ON public.activity_log';
  EXECUTE 'CREATE POLICY "Auth full access activity_log" ON public.activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 3. Verify ──
-- Run this after to confirm all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ============================================================
-- Onboarding Form Submission Fix
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. SECURITY DEFINER function for task insert
--    Runs as the table owner, bypasses RLS entirely.
--    Anon key can call this via supabase.rpc().
CREATE OR REPLACE FUNCTION public.create_onboarding_task(
  p_client_id  UUID,
  p_title      TEXT,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id UUID;
BEGIN
  INSERT INTO public.tasks (client_id, title, description, status, priority)
  VALUES (p_client_id, p_title, p_description, 'Not Started', 'High')
  RETURNING id INTO v_task_id;
  RETURN v_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_onboarding_task(UUID, TEXT, TEXT) TO anon;

-- 2. Anon RLS policies for the other onboarding writes

-- clients: anon needs SELECT (to fetch company_name) + UPDATE (to sync business info)
DROP POLICY IF EXISTS "Anon select clients onboarding" ON public.clients;
CREATE POLICY "Anon select clients onboarding"
  ON public.clients FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon update clients onboarding" ON public.clients;
CREATE POLICY "Anon update clients onboarding"
  ON public.clients FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- client_settings: anon needs SELECT + INSERT + UPDATE
DROP POLICY IF EXISTS "Anon select client_settings onboarding" ON public.client_settings;
CREATE POLICY "Anon select client_settings onboarding"
  ON public.client_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon insert client_settings onboarding" ON public.client_settings;
CREATE POLICY "Anon insert client_settings onboarding"
  ON public.client_settings FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update client_settings onboarding" ON public.client_settings;
CREATE POLICY "Anon update client_settings onboarding"
  ON public.client_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- locations: anon needs SELECT + INSERT
DROP POLICY IF EXISTS "Anon select locations onboarding" ON public.locations;
CREATE POLICY "Anon select locations onboarding"
  ON public.locations FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon insert locations onboarding" ON public.locations;
CREATE POLICY "Anon insert locations onboarding"
  ON public.locations FOR INSERT TO anon WITH CHECK (true);

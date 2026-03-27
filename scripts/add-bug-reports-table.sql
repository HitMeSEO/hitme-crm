-- Bug Reports table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by TEXT NOT NULL,
  page_url TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  screenshot_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do everything
CREATE POLICY "Authenticated users full access on bug_reports"
  ON public.bug_reports
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

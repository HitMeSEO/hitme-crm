-- GEO Radar Scans table
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/pcrkgltlzmplsocvmieq/sql

CREATE TABLE IF NOT EXISTS public.geo_radar_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  queries_run INTEGER DEFAULT 0,
  mentions_found INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  results JSONB DEFAULT '[]',
  summary TEXT,
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.geo_radar_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on geo_radar_scans" ON public.geo_radar_scans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

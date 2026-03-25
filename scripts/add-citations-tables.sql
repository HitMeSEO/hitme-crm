-- Citation Building & Tracking
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/pcrkgltlzmplsocvmieq/sql

-- Citation Audits (one per audit run)
CREATE TABLE IF NOT EXISTS citation_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | error
  total_found INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_inconsistent INTEGER NOT NULL DEFAULT 0,
  total_missing INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER,  -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_audits_client ON citation_audits(client_id);

-- Individual citations (one per directory per audit)
CREATE TABLE IF NOT EXISTS citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES citation_audits(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  directory TEXT NOT NULL,        -- key: "google", "yelp", "bbb"
  directory_label TEXT NOT NULL,  -- "Google Business Profile", "Yelp"
  category TEXT NOT NULL,         -- "core" or "industry"
  listing_url TEXT,
  status TEXT NOT NULL,           -- "found_correct", "found_inconsistent", "not_found"
  name_match BOOLEAN,
  address_match BOOLEAN,
  phone_match BOOLEAN,
  url_match BOOLEAN,
  found_name TEXT,
  found_address TEXT,
  found_phone TEXT,
  found_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_client ON citations(client_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);

-- Enable RLS
ALTER TABLE citation_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- RLS policies (match the pattern used by other tables)
CREATE POLICY "Users can read citation_audits" ON citation_audits FOR SELECT USING (true);
CREATE POLICY "Users can insert citation_audits" ON citation_audits FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update citation_audits" ON citation_audits FOR UPDATE USING (true);
CREATE POLICY "Users can delete citation_audits" ON citation_audits FOR DELETE USING (true);

CREATE POLICY "Users can read citations" ON citations FOR SELECT USING (true);
CREATE POLICY "Users can insert citations" ON citations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update citations" ON citations FOR UPDATE USING (true);
CREATE POLICY "Users can delete citations" ON citations FOR DELETE USING (true);

-- Dropbox OAuth token storage (mirrors google_tokens pattern)
-- Single row keyed as 'default' for the whole CRM

CREATE TABLE IF NOT EXISTS public.dropbox_tokens (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  account_id TEXT DEFAULT '',
  uid TEXT DEFAULT '',
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.dropbox_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dropbox tokens"
  ON public.dropbox_tokens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert dropbox tokens"
  ON public.dropbox_tokens FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update dropbox tokens"
  ON public.dropbox_tokens FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

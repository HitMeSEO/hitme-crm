-- Client Approval + WordPress Push columns
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/pcrkgltlzmplsocvmieq/sql

-- Content queue: approval tracking + WP publishing
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS client_approval TEXT DEFAULT 'not_sent';
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS wordpress_post_id TEXT;
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS published_url TEXT;
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Client settings: WordPress credentials
ALTER TABLE public.client_settings ADD COLUMN IF NOT EXISTS wordpress_url TEXT;
ALTER TABLE public.client_settings ADD COLUMN IF NOT EXISTS wordpress_api_key TEXT;

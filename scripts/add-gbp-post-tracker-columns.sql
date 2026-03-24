-- Add GBP Post Tracker columns to clients table
-- Run this in Supabase SQL Editor

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gbp_last_post_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gbp_post_frequency TEXT DEFAULT 'weekly';

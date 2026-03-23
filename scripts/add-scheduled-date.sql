-- Add scheduled_date to content_queue for GBP post scheduling
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS scheduled_date DATE;

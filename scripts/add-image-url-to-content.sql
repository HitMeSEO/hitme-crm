-- Add image_url column to content_queue for GBP post image attachments
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.content_queue ADD COLUMN IF NOT EXISTS image_file_id TEXT DEFAULT '';

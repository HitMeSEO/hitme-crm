-- Add new task status option
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('Not Started', 'In Progress', 'Pending Client Approval', 'Done', 'Blocked'));

-- Add new simplified service columns to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_ads BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_social BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_crm BOOLEAN NOT NULL DEFAULT false;

-- Migrate old ads columns into single ads column
UPDATE public.clients SET service_ads = true WHERE service_ads_google = true OR service_ads_bing = true OR service_ads_meta = true;
-- Migrate old social column (if service_social_media exists)
UPDATE public.clients SET service_social = COALESCE(service_social_media, false);

-- Add folder link columns if not already there
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS drive_folder TEXT DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS image_folder TEXT DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS content_folder TEXT DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dropbox_folder TEXT DEFAULT '';

-- Add content tracking date columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_gbp_post_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_social_post_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_website_post_date DATE;

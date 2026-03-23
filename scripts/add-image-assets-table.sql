-- Image assets tracking table
-- Tracks which Google Drive images have been used (website, GBP, social) to prevent reuse
CREATE TABLE IF NOT EXISTS public.image_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  used_on TEXT NOT NULL,          -- 'website', 'gbp', 'social', 'blog', 'other'
  used_for TEXT DEFAULT '',       -- description: "Homepage hero", "GBP post March 2026"
  content_id UUID REFERENCES public.content_queue(id) ON DELETE SET NULL,
  used_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, drive_file_id)
);

-- Index for fast lookups by client
CREATE INDEX IF NOT EXISTS idx_image_assets_client ON public.image_assets(client_id);

-- RLS
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read image_assets"
  ON public.image_assets FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert image_assets"
  ON public.image_assets FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update image_assets"
  ON public.image_assets FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete image_assets"
  ON public.image_assets FOR DELETE
  TO authenticated USING (true);

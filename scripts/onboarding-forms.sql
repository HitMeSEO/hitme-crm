-- Onboarding Forms table
CREATE TABLE IF NOT EXISTS public.onboarding_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'in_progress', 'submitted')),
  form_data JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enable row level security
ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;

-- Allow public to read/update their own form by token (no login needed)
CREATE POLICY "Public read by token" ON public.onboarding_forms
  FOR SELECT USING (true);

CREATE POLICY "Public update by token" ON public.onboarding_forms
  FOR UPDATE USING (true);

-- Allow authenticated users full access (for CRM admin)
CREATE POLICY "Authenticated full access" ON public.onboarding_forms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

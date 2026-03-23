-- Pipeline Status Migration
-- Run this in the Supabase SQL editor

-- 1. Drop the old status check constraint (if any)
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;

-- 2. Migrate existing data
UPDATE public.clients SET status = 'client' WHERE status IN ('Active', 'active', 'Paused', 'paused');
UPDATE public.clients SET status = 'churned' WHERE status IN ('Churned', 'churned');
UPDATE public.clients SET status = 'lead' WHERE status IN ('Lead', 'lead');
UPDATE public.clients SET status = 'prospect' WHERE status IN ('Prospect', 'prospect');
-- Catch any remaining unknown values
UPDATE public.clients SET status = 'client' WHERE status NOT IN ('lead', 'prospect', 'client', 'churned', 'lost');

-- 3. Add the new check constraint
ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('lead', 'prospect', 'client', 'churned', 'lost'));

-- Verify
SELECT status, count(*) FROM public.clients GROUP BY status ORDER BY status;

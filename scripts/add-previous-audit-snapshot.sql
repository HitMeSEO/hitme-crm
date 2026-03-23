-- Add previous_audit_snapshot to clients for before/after comparison on re-scan
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS previous_audit_snapshot JSONB;

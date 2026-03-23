-- Task Comments table
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/pcrkgltlzmplsocvmieq/sql

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on task_comments" ON public.task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

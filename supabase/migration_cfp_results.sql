-- ============================================================
-- Миграция: добавить cfp_results в cfp_reports
-- Выполни в Supabase SQL Editor
-- ============================================================

ALTER TABLE public.cfp_reports
  ADD COLUMN IF NOT EXISTS cfp_results JSONB DEFAULT NULL;

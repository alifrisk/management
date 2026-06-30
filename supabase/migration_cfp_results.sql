-- ============================================================
-- Миграция: добавить все недостающие колонки в cfp_reports
-- Выполни в Supabase SQL Editor
-- ============================================================

ALTER TABLE public.cfp_reports
  ADD COLUMN IF NOT EXISTS plan_period    TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_date      DATE          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car11          NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car12          NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car13          NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS k21            NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outflows_data  JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cfp_results    JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funding_sources JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_conclusion  TEXT          DEFAULT NULL;

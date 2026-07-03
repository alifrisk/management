-- ============================================================
-- Миграция: создание таблицы cfp_reports + RLS
-- Выполни в Supabase SQL Editor
-- ============================================================

-- 1. Создать таблицу если не существует
CREATE TABLE IF NOT EXISTS public.cfp_reports (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_name     TEXT NOT NULL DEFAULT '',
  plan_period     TEXT DEFAULT NULL,
  plan_date       DATE DEFAULT NULL,
  car11           NUMERIC(6,2) DEFAULT NULL,
  car12           NUMERIC(6,2) DEFAULT NULL,
  car13           NUMERIC(6,2) DEFAULT NULL,
  k21             NUMERIC(6,2) DEFAULT NULL,
  outflows_data   JSONB DEFAULT NULL,
  inflows_data    JSONB DEFAULT NULL,
  cfp_results     JSONB DEFAULT NULL,
  funding_sources JSONB DEFAULT NULL,
  ai_conclusion   TEXT DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Добавить report_name если таблица уже есть без неё
ALTER TABLE public.cfp_reports
  ADD COLUMN IF NOT EXISTS report_name TEXT NOT NULL DEFAULT '';

-- 3. Добавить остальные колонки если таблица уже есть без них
ALTER TABLE public.cfp_reports
  ADD COLUMN IF NOT EXISTS plan_period     TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_date       DATE          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car11           NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car12           NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS car13           NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS k21             NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outflows_data   JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inflows_data    JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cfp_results     JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funding_sources JSONB         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_conclusion   TEXT          DEFAULT NULL;

-- 4. Включить RLS
ALTER TABLE public.cfp_reports ENABLE ROW LEVEL SECURITY;

-- 5. Политика для admin: полный доступ (SELECT + INSERT + UPDATE + DELETE)
DROP POLICY IF EXISTS "Admins can manage cfp_reports" ON public.cfp_reports;
CREATE POLICY "Admins can manage cfp_reports"
  ON public.cfp_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Миграция: сохранение вычисленных коэффициентов МСФО
-- Выполни в Supabase SQL Editor
-- ============================================================

ALTER TABLE public.counterparty_financials
  ADD COLUMN IF NOT EXISTS p2_car_ratio       NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_roe_ratio       NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_liquidity_ratio NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_npl_ratio       NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_nim_ratio       NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_liquid_assets_usd NUMERIC(20,2) DEFAULT NULL;

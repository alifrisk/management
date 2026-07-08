-- ============================================================
-- Миграция: полная синхронизация credit_conclusions с кодом
-- Дата: 2026-07-08
-- Безопасна для повторного применения (ADD COLUMN IF NOT EXISTS)
-- Выполни в Supabase → SQL Editor → Run
-- ============================================================

-- 1. financial_data (основная причина ошибки «column not found»)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS financial_data JSONB DEFAULT NULL;

-- 2. Переименованные поля — добавляем под новыми именами
--    (старые borrower_bin / currency / ai_analysis остаются для совместимости)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS borrower_inn  TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS loan_currency TEXT         NOT NULL DEFAULT 'TJS',
  ADD COLUMN IF NOT EXISTS ai_conclusion TEXT         NOT NULL DEFAULT '';

-- 3. Основные поля кредита (вкладка «Заёмщик»)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS business_type     TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sector            TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS years_in_business NUMERIC(6,1)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS loan_term         TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS loan_term_months  INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interest_rate     NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_history    TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p1_label          TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_label          TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS additional_info   TEXT          DEFAULT NULL;

-- 4. Залоги и поручители (JSONB-массивы)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS collaterals JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS guarantors  JSONB DEFAULT '[]';

-- 5. Концентрация / PAR30 (вкладка «Концентрация»)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS sme_sector_portfolio  NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_total_portfolio  NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ra_conc_limit         NUMERIC(8,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_par30_pct     NUMERIC(8,4)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ra_par30_limit        NUMERIC(8,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_msb_par30_pct NUMERIC(8,4)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ra_msb_par30_limit    NUMERIC(8,2)  DEFAULT NULL;

-- 6. Баланс — поля не вошедшие в migration_minfin_rt_42
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS p1_inventory NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_inventory NUMERIC(20,2) DEFAULT NULL;

-- 7. ОПУ — поля помеченные «уже есть» в старой миграции (перестраховка)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS p1_cogs         NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_cogs         NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p1_gross_profit NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_gross_profit NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p1_tax          NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_tax          NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p1_net_profit   NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_net_profit   NUMERIC(20,2) DEFAULT NULL;

-- 8. ОДДС — итоговые остатки денежных средств
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS p1_cash_end NUMERIC(20,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS p2_cash_end NUMERIC(20,2) DEFAULT NULL;

-- 9. Проверка: список колонок после миграции
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'credit_conclusions'
ORDER BY ordinal_position;

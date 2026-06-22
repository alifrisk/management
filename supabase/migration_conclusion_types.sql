-- ============================================================
-- Миграция: добавление типов заключений и нумерации
-- Выполни в Supabase SQL Editor
-- ============================================================

-- 1. Номер заключения (глобальный счётчик)
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS conclusion_number INTEGER;

-- 2. Тип заключения
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS conclusion_type TEXT NOT NULL DEFAULT 'Одобрение кредитной линии';

-- 3. Остаток по действующему кредиту (для "Смена залога")
ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS existing_loan_balance NUMERIC(15,2) DEFAULT 0;

-- 4. Проставить номера существующим записям по дате создания
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.credit_conclusions
)
UPDATE public.credit_conclusions c
SET conclusion_number = n.rn
FROM numbered n
WHERE c.id = n.id AND c.conclusion_number IS NULL;

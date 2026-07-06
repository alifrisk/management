-- Migration: add exchange_rate column to credit_conclusions
-- Stores the exchange rate (currency/TJS) used for concentration and PAR30 calculations.
-- NULL means the loan currency is TJS (no conversion needed).

ALTER TABLE public.credit_conclusions
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 4) DEFAULT NULL;

COMMENT ON COLUMN public.credit_conclusions.exchange_rate
  IS 'Exchange rate (loan_currency/TJS) at the report date. NULL if loan_currency = TJS.';

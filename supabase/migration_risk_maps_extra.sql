-- Новые поля для картирования рисков
ALTER TABLE public.risk_maps
  ADD COLUMN IF NOT EXISTS mitigation_status    TEXT DEFAULT 'Идентифицирован',
  ADD COLUMN IF NOT EXISTS mitigation_deadline  DATE,
  ADD COLUMN IF NOT EXISTS residual_probability TEXT,
  ADD COLUMN IF NOT EXISTS residual_impact      TEXT,
  ADD COLUMN IF NOT EXISTS residual_score       INTEGER,
  ADD COLUMN IF NOT EXISTS residual_level       TEXT;

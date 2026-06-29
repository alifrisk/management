-- Добавляем новые поля в таблицу анкет риск-координаторов
ALTER TABLE public.incident_forms
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS actions_taken TEXT;

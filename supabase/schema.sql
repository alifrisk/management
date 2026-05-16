-- ============================================
-- ALIF BANK — Risk Management Platform
-- База данных Supabase — полная схема
-- Выполни этот скрипт в Supabase SQL Editor
-- ============================================

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ТАБЛИЦА ПРОФИЛЕЙ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  department TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (Row Level Security) для профилей
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Триггер: автоматически создаёт профиль при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. ТАБЛИЦА ОПЕРАЦИОННЫХ ИНЦИДЕНТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS public.operational_incidents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  incident_number SERIAL,  -- Автоматический номер

  -- ЭТАП 1: Классификация
  event_category_l1 TEXT NOT NULL DEFAULT '',
  event_category_l2 TEXT NOT NULL DEFAULT '',
  event_category_l3 TEXT NOT NULL DEFAULT '',
  business_process TEXT NOT NULL DEFAULT '',
  case_description TEXT NOT NULL DEFAULT '',
  repeat_count INTEGER NOT NULL DEFAULT 1,
  system TEXT NOT NULL DEFAULT '',
  cause TEXT NOT NULL DEFAULT '',
  factor TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  employee_involved TEXT,
  incident_location TEXT,
  department TEXT NOT NULL DEFAULT '',

  -- ЭТАП 2: Идентификация
  discovered_by TEXT NOT NULL DEFAULT '',
  disclosure TEXT NOT NULL DEFAULT '',
  discovery_date DATE,
  incident_date DATE,

  -- ЭТАП 3: Анализ (финансы)
  loss_amount NUMERIC(15,2),
  currency TEXT DEFAULT 'TJS',
  loss_amount_tjs NUMERIC(15,2),
  recovery_amount NUMERIC(15,2),
  remainder NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(loss_amount_tjs, 0) - COALESCE(recovery_amount, 0)
  ) STORED,
  recovery_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(loss_amount_tjs, 0) > 0
      THEN ROUND((COALESCE(recovery_amount, 0) / loss_amount_tjs) * 100, 2)
      ELSE 0
    END
  ) STORED,

  -- Статусы
  incident_status TEXT NOT NULL DEFAULT 'Открыт'
    CHECK (incident_status IN ('Открыт', 'В процессе', 'Закрыт')),
  client_work_status TEXT,
  system_link TEXT,
  transaction_count INTEGER,

  -- ЭТАП 4: Оценка
  probability INTEGER CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER CHECK (impact BETWEEN 1 AND 5),
  control_quality INTEGER CHECK (control_quality BETWEEN 1 AND 3),
  probability_score NUMERIC(3,1),
  impact_score NUMERIC(3,1),
  risk_level TEXT CHECK (risk_level IN ('Низкий', 'Средний', 'Высокий', 'Экстремальные')),

  -- Метаданные
  submitted_by TEXT,       -- email риск-координатора (если анкета)
  source TEXT DEFAULT 'admin',  -- 'admin' или 'form' (анкета)
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрой фильтрации
CREATE INDEX idx_incidents_status ON public.operational_incidents(incident_status);
CREATE INDEX idx_incidents_factor ON public.operational_incidents(factor);
CREATE INDEX idx_incidents_system ON public.operational_incidents(system);
CREATE INDEX idx_incidents_department ON public.operational_incidents(department);
CREATE INDEX idx_incidents_risk_level ON public.operational_incidents(risk_level);
CREATE INDEX idx_incidents_dates ON public.operational_incidents(incident_date, discovery_date);
CREATE INDEX idx_incidents_created_at ON public.operational_incidents(created_at);

-- RLS для инцидентов
ALTER TABLE public.operational_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with incidents"
  ON public.operational_incidents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Триггер: автоматически обновляет updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.operational_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. ТАБЛИЦА АНКЕТ РИСК-КООРДИНАТОРОВ
-- ============================================
CREATE TABLE IF NOT EXISTS public.incident_forms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  discovered_by TEXT NOT NULL,
  business_process TEXT NOT NULL,
  factor TEXT NOT NULL,
  cause TEXT NOT NULL,
  system TEXT NOT NULL,
  discovery_date DATE NOT NULL,
  incident_date DATE NOT NULL,
  loss_amount NUMERIC(15,2),
  recovery_amount NUMERIC(15,2),
  disclosure TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL,
  submitted_by TEXT,  -- email координатора
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'rejected')),
  processed_by UUID REFERENCES public.user_profiles(id),
  processed_at TIMESTAMPTZ,
  incident_id UUID REFERENCES public.operational_incidents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incident_forms ENABLE ROW LEVEL SECURITY;

-- Анкеты могут подавать все (включая незарегистрированных через ссылку)
CREATE POLICY "Anyone can submit forms"
  ON public.incident_forms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all forms"
  ON public.incident_forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update forms"
  ON public.incident_forms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 4. ТАБЛИЦА КАРТИРОВАНИЯ РИСКОВ
-- ============================================
CREATE TABLE IF NOT EXISTS public.risk_maps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_process TEXT NOT NULL,
  risk_description TEXT NOT NULL,
  probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  risk_score INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
  risk_level TEXT NOT NULL,
  controls TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  notes TEXT,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_by UUID REFERENCES public.user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.risk_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage risk maps"
  ON public.risk_maps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE TRIGGER update_risk_maps_updated_at
  BEFORE UPDATE ON public.risk_maps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. ТАБЛИЦА КРЕДИТНЫХ ЗАКЛЮЧЕНИЙ (SME)
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_conclusions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  borrower_name TEXT NOT NULL,
  borrower_bin TEXT,
  loan_amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TJS',
  loan_purpose TEXT NOT NULL DEFAULT '',
  financial_data JSONB NOT NULL DEFAULT '{}',
  ai_analysis TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT ''
    CHECK (recommendation IN ('Одобрить', 'Отклонить', 'Условно одобрить')),
  risk_level TEXT NOT NULL DEFAULT 'Средний',
  analyst_id UUID REFERENCES public.user_profiles(id),
  analyst_name TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_conclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credit conclusions"
  ON public.credit_conclusions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. ТАБЛИЦА ОЦЕНОК КОНТРАГЕНТОВ (Рыночный риск)
-- ============================================
CREATE TABLE IF NOT EXISTS public.counterparty_assessments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  assessment_data JSONB NOT NULL DEFAULT '{}',
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  reliability_category TEXT NOT NULL DEFAULT '',
  recommended_limit_usd NUMERIC(15,2),
  ai_analysis TEXT NOT NULL DEFAULT '',
  analyst_id UUID REFERENCES public.user_profiles(id),
  analyst_name TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.counterparty_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage counterparty assessments"
  ON public.counterparty_assessments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. ТАБЛИЦА СТРЕСС-ТЕСТОВ ЛИКВИДНОСТИ
-- ============================================
CREATE TABLE IF NOT EXISTS public.liquidity_stress_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period TEXT NOT NULL DEFAULT '',
  liabilities_data JSONB NOT NULL DEFAULT '[]',
  facilities_data JSONB NOT NULL DEFAULT '[]',
  liquidity_buffer JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  analyst_id UUID REFERENCES public.user_profiles(id),
  analyst_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.liquidity_stress_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stress tests"
  ON public.liquidity_stress_tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 8. ТАБЛИЦА АУДИТ-ЛОГА (история действий)
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id),
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 9. НАСТРОЙКИ УВЕДОМЛЕНИЙ
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) UNIQUE,
  notify_new_incident BOOLEAN DEFAULT true,
  notify_new_form BOOLEAN DEFAULT true,
  notify_status_change BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification settings"
  ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 10. ПОЛЕЗНЫЕ ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ============================================

-- Статистика по инцидентам для дашборда
CREATE OR REPLACE VIEW public.incident_stats AS
SELECT
  COUNT(*) AS total_incidents,
  COUNT(*) FILTER (WHERE incident_status = 'Открыт') AS open_incidents,
  COUNT(*) FILTER (WHERE incident_status = 'В процессе') AS in_progress,
  COUNT(*) FILTER (WHERE incident_status = 'Закрыт') AS closed_incidents,
  COALESCE(SUM(loss_amount_tjs), 0) AS total_loss_tjs,
  COALESCE(SUM(recovery_amount), 0) AS total_recovery_tjs,
  CASE
    WHEN SUM(loss_amount_tjs) > 0
    THEN ROUND((SUM(COALESCE(recovery_amount, 0)) / SUM(loss_amount_tjs)) * 100, 2)
    ELSE 0
  END AS recovery_rate_pct,
  COUNT(*) FILTER (WHERE risk_level = 'Экстремальные') AS extreme_risk_count,
  COUNT(*) FILTER (WHERE risk_level = 'Высокий') AS high_risk_count,
  EXTRACT(YEAR FROM NOW())::integer AS current_year
FROM public.operational_incidents
WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

-- ============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ============================================

-- Создаём первого администратора через Supabase Auth UI
-- После регистрации выполни:
-- UPDATE public.user_profiles SET role = 'admin', full_name = 'Имя Фамилия', department = 'СУР', position = 'Руководитель СУР' WHERE email = 'твой@email.com';

COMMENT ON TABLE public.user_profiles IS 'Профили пользователей Risk Management Platform';
COMMENT ON TABLE public.operational_incidents IS 'Реестр операционных инцидентов';
COMMENT ON TABLE public.incident_forms IS 'Анкеты от риск-координаторов';
COMMENT ON TABLE public.risk_maps IS 'Картирование рисков по бизнес-процессам';
COMMENT ON TABLE public.credit_conclusions IS 'Заключения по кредитному риску SME';
COMMENT ON TABLE public.counterparty_assessments IS 'Оценки контрагентов (рыночный риск)';
COMMENT ON TABLE public.liquidity_stress_tests IS 'Стресс-тесты ликвидности';
COMMENT ON TABLE public.audit_logs IS 'Журнал действий пользователей';

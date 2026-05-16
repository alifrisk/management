// ============================================
// ТИПЫ ДАННЫХ — Risk Management Platform
// ============================================

// --- ПОЛЬЗОВАТЕЛИ ---
export type UserRole = 'admin' | 'user'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  department: string
  position: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- ОПЕРАЦИОННЫЙ РИСК ---

// Статус инцидента
export type IncidentStatus = 'Открыт' | 'В процессе' | 'Закрыт'

// Статус работы с клиентами
export type ClientWorkStatus =
  | 'В процессе обзвона'
  | 'В ожидании возмещения'
  | 'Возмещенно'
  | 'Невозмещаемый'
  | 'Нефинансовый инцидент'
  | 'Процесс возмещения не начался'
  | 'Процесс возмещения не идет'

// Фактор риска
export type RiskFactor =
  | 'Риск систем'
  | 'Риск человеческого фактора'
  | 'Риск внутренний процесс'
  | 'Юридический риск'
  | 'Внешний риск'

// Категория уровень 1
export type EventCategory =
  | 'Внутреннее_мошенничество'
  | 'Внешнее_мошенничество'
  | 'Кадровая_политика_и_безопасность_труда'
  | 'Клиенты_продукты_и_бизнес_практика'
  | 'Ущерб_в_отношении_физических_ресурсов'
  | 'Сбои_в_бизнесе_и_отказы_систем'
  | 'Исполнение_доставка_и_управление_процессом'

// Валюта
export type Currency = 'TJS' | 'USD' | 'EUR' | 'RUR' | 'UZS' | 'KZT' | 'GBP' | 'Другие валюты'

// Оценка вероятности
export type ProbabilityScore = 1 | 2 | 3 | 4 | 5

// Оценка влияния
export type ImpactScore = 1 | 2 | 3 | 4 | 5

// Степень риска
export type RiskLevel = 'Низкий' | 'Средний' | 'Высокий' | 'Экстремальные'

// Частота повторений
export type IncidentFrequency = 'Часто повторяющиеся' | 'Редко повторяющиеся' | 'Единичный случай'

// Система
export type SystemName =
  | 'Alif Core'
  | 'Alif Pay'
  | 'Alif Mobi'
  | 'CRM'
  | 'Solar'
  | 'Procard'
  | 'Alif Terminal'
  | 'Денежный перевод (НПСР)'
  | 'Внесистемный инциденты'
  | 'Alif Cards'
  | 'Alif Business'

// Бизнес-процесс
export type BusinessProcess =
  | 'Кредитование'
  | 'Депозит'
  | 'Касса'
  | 'IT'
  | 'Работа с корпоративными клиентами'
  | 'Комплексные банковские процессы'
  | 'Денежный перевод'
  | 'Комплаенс'
  | 'HR'
  | 'Электронный кошелек Алиф Моби'
  | 'Терминал'
  | 'Платежная карта'
  | 'Маркетинг'
  | 'Бухгалтерия'
  | 'Инкассация'
  | 'Банкоматы'
  | 'Логистика'
  | 'Казначейство'
  | 'Работа с проблемными кредитами'
  | 'Административно-хозяйственная деятельность'
  | 'Внутренние процессы'
  | 'Технический саппорт'
  | 'Благотворительный фонд'
  | 'Бухгалтерия процессинга'
  | 'Административное управление'
  | 'Фронт'
  | 'Фронт/Касса'
  | 'Поддержка корпоративных клиентов'

// Структурное подразделение
export type Department =
  | 'Головной офис (ГО)'
  | 'Филиал в г. Душанбе (р-н И. Сомони)'
  | 'Филиал в г. Душанбе (р-н Шохмансур)'
  | 'Филиал в г. Худжанд'
  | 'Филиал в г. Бохтар'
  | 'Филиал в г. Куляб'
  | 'ЦБО №1 — г. Душанбе'
  | 'ЦБО №2 — г. Душанбе'
  | 'ЦБО №3 — г. Вахдат'
  | 'ЦБО №4 — г. Бохтар'
  | 'ЦБО №5 — г. Гиссар'
  | 'ЦБО №6 — г. Турсунзода'
  | 'ЦБО №7 — г. Пенджикент'
  | 'ЦБО №8 — г. Истаравшан'
  | 'ЦБО №9 — г. Душанбе'
  | 'ЦБО №10 — г. Душанбе'
  | 'ЦБО №11 — г. Душанбе'
  | 'ЦБО №12 — г. Куляб'
  | 'ЦБО №13 — г. Куляб'
  | 'ЦБО №14 — г. Бохтар'
  | 'ЦБО №15 — г. Бохтар'
  | 'ЦБО №1 — г. Худжанд'
  | 'ЦБО №2 — г. Бустон'
  | 'ЦБО №3 — г. Худжанд'
  | 'ЦБО №4 — г. Б. Гафуров'
  | 'ЦБО №5 — г. Дж. Расулов'
  | 'ЦБО №6 — г. Исфара'

// Полный операционный инцидент (таблица в БД)
export interface OperationalIncident {
  id: string
  incident_number: number

  // ЭТАП 1 — Классификация
  event_category_l1: EventCategory
  event_category_l2: string
  event_category_l3: string
  business_process: BusinessProcess
  case_description: string
  repeat_count: number
  system: SystemName
  cause: string
  factor: RiskFactor
  frequency: IncidentFrequency
  employee_involved?: string
  incident_location?: string

  // ЭТАП 2 — Идентификация
  discovered_by: string        // ФИО риск-координатора
  disclosure: string           // Раскрытие
  discovery_date: string       // Дата обнаружения
  incident_date: string        // Фактическая дата инцидента

  // ЭТАП 3 — Анализ (финансовое воздействие)
  loss_amount?: number
  currency?: Currency
  loss_amount_tjs?: number
  recovery_amount?: number
  remainder?: number
  recovery_rate?: number

  // Статусы
  incident_status: IncidentStatus
  client_work_status?: ClientWorkStatus
  system_link?: string
  transaction_count?: number

  // ЭТАП 4 — Оценка
  probability: ProbabilityScore
  impact: ImpactScore
  control_quality: 1 | 2 | 3   // 1=Слабый, 2=Благоразумный, 3=Эффективный
  probability_score: number
  impact_score: number
  risk_level: RiskLevel

  // Метаданные
  submitted_by?: string        // email того кто подал анкету (координатор)
  created_by: string           // email аналитика СУР
  created_at: string
  updated_at: string
  department: Department
}

// Анкета от риск-координатора (упрощённая)
export interface IncidentFormData {
  discovered_by: string
  business_process: BusinessProcess
  factor: RiskFactor
  cause: string
  system: SystemName
  discovery_date: string
  incident_date: string
  loss_amount?: number
  recovery_amount?: number
  disclosure: string
  department: Department
}

// --- КРЕДИТНЫЙ РИСК ---
export interface CreditConclusion {
  id: string
  borrower_name: string
  borrower_bin: string
  loan_amount: number
  currency: Currency
  loan_purpose: string
  financial_data: Record<string, unknown>
  ai_analysis: string
  recommendation: 'Одобрить' | 'Отклонить' | 'Условно одобрить'
  risk_level: RiskLevel
  analyst_id: string
  analyst_name: string
  created_at: string
  file_url?: string
}

// --- РЫНОЧНЫЙ РИСК ---
export interface CounterpartyAssessment {
  id: string
  bank_name: string
  country: string
  assessment_data: Record<string, unknown>
  total_score: number
  reliability_category: string
  recommended_limit_usd: number
  ai_analysis: string
  analyst_id: string
  analyst_name: string
  created_at: string
  file_url?: string
}

// --- ЛИКВИДНОСТЬ ---
export interface LiquidityStressTest {
  id: string
  test_date: string
  period: string
  liabilities_data: LiabilityItem[]
  facilities_data: FacilityItem[]
  liquidity_buffer: LiquidityBuffer
  results: StressTestResults
  analyst_id: string
  analyst_name: string
  created_at: string
}

export interface LiabilityItem {
  name: string
  amount_tjs: number
  pessimistic_t1_pct: number
  pessimistic_t7_pct: number
  pessimistic_t30_pct: number
  catastrophic_t1_pct: number
  catastrophic_t7_pct: number
  catastrophic_t30_pct: number
}

export interface FacilityItem {
  name: string
  limit_tjs: number
  pessimistic_t1_pct: number
  pessimistic_t7_pct: number
  pessimistic_t30_pct: number
  catastrophic_t1_pct: number
  catastrophic_t7_pct: number
  catastrophic_t30_pct: number
}

export interface LiquidityBuffer {
  cash_and_equivalents: number
  cash_only: number
}

export interface StressTestResults {
  pessimistic: ScenarioResult
  catastrophic: ScenarioResult
}

export interface ScenarioResult {
  t1: HorizonResult
  t7: HorizonResult
  t30: HorizonResult
}

export interface HorizonResult {
  stress_outflow: number
  facility_drawdown: number
  total_need: number
  cash_equivalents: number
  coverage_cash_equiv: number
  cash_only: number
  coverage_cash_only: number
  risk_level: 'Low' | 'Medium' | 'High'
}

// --- КАРТИРОВАНИЕ РИСКОВ ---
export interface RiskMap {
  id: string
  business_process: BusinessProcess
  risk_description: string
  probability: ProbabilityScore
  impact: ImpactScore
  risk_level: RiskLevel
  controls: string
  responsible: string
  notes?: string
  year: number
  created_by: string
  updated_at: string
}

// --- ФИЛЬТРЫ ---
export interface IncidentFilters {
  year?: number
  quarter?: number
  month?: number
  department?: Department
  factor?: RiskFactor
  system?: SystemName
  business_process?: BusinessProcess
  status?: IncidentStatus
  risk_level?: RiskLevel
  date_from?: string
  date_to?: string
}

// --- API ОТВЕТЫ ---
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

// --- ДАШБОРД МЕТРИКИ ---
export interface DashboardStats {
  total_incidents: number
  open_incidents: number
  in_progress_incidents: number
  closed_incidents: number
  total_loss_tjs: number
  total_recovery_tjs: number
  recovery_rate: number
  extreme_risk_count: number
  high_risk_count: number
}

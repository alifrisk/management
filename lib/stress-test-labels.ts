export const FIELD_LABELS: Record<string, string> = {
  // ── Общие входные данные ────────────────────────────────────────────────────
  report_date:        'Дата отчётности',
  date_from:          'Дата начала',
  date_to:            'Дата окончания',
  horizon:            'Горизонт прогноза',
  base_profit:        'Базовая прибыль (TJS)',
  calendar_months:    'Период (мес.)',

  // ── Кредитный риск — входные данные ─────────────────────────────────────────
  portfolio:          'Кредитный портфель (TJS)',
  current_par:        'Текущий PAR30 (%)',
  current_cov:        'Текущий Coverage (%)',
  grow_table:         'Таблица прогноза роста',

  // ── Кредитный риск — поля сценария ──────────────────────────────────────────
  par:                'PAR30 (%)',
  cov:                'Coverage Rate (%)',
  reserve:            'Доп. резерв (TJS)',
  adj_profit:         'Скорр. прибыль (TJS)',

  // ── Операционный риск — входные данные ──────────────────────────────────────
  incidents:          'Кол-во инцидентов',
  total_loss_hist:    'Исторический ущерб (TJS)',
  avg_loss_per_month: 'Средний ущерб/мес. (TJS)',

  // ── Операционный риск — поля сценария ───────────────────────────────────────
  loss_per_month:     'Ущерб в месяц (TJS)',
  recovery_rate_pct:  'Уровень возвратности (%)',
  total_loss:         'Общий ущерб (TJS)',
  total_recovery:     'Сумма возврата (TJS)',
  net_loss:           'Чистый убыток (TJS)',

  // ── Рыночный риск — входные данные ──────────────────────────────────────────
  currency:           'Валюта',
  mean:               'Среднее значение (%)',
  std_dev:            'Стандартное отклонение (%)',
  iterations:         'Итераций (Monte Carlo)',
  horizon_days:       'Горизонт (дней)',

  // ── Рыночный риск — результаты ───────────────────────────────────────────────
  var95_hist:         'VaR 95% (ист.)',
  var99_hist:         'VaR 99% (ист.)',
  var95_param:        'VaR 95% (пар.)',
  var99_param:        'VaR 99% (пар.)',
  cvar95:             'CVaR 95%',
  cvar99:             'CVaR 99%',
  expected:           'Ожидаемое значение (%)',
  median:             'Медиана (%)',
  appreciation_pct:   'Вероятность укрепления (%)',
  depreciation_pct:   'Вероятность ослабления (%)',
}

const PCT_KEYS = new Set([
  'current_par', 'current_cov',
  'mean', 'std_dev', 'expected', 'median', 'appreciation_pct', 'depreciation_pct',
  'var95_hist', 'var99_hist', 'var95_param', 'var99_param', 'cvar95', 'cvar99',
  'par', 'cov', 'recovery_rate_pct',
])

const MONEY_KEYS = new Set([
  'portfolio', 'base_profit',
  'total_loss_hist', 'avg_loss_per_month',
  'reserve', 'adj_profit',
  'loss_per_month', 'total_loss', 'total_recovery', 'net_loss',
])

const fmt = new Intl.NumberFormat('ru-RU')

export function labelField(key: string): string {
  return FIELD_LABELS[key] ?? key
}

export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!isNaN(n) && typeof value !== 'string') {
    if (MONEY_KEYS.has(key)) return fmt.format(n) + ' TJS'
    if (PCT_KEYS.has(key))   return n + '%'
    return fmt.format(n)
  }
  return String(value)
}

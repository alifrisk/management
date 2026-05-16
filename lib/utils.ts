import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { RiskLevel, ProbabilityScore, ImpactScore } from '@/types'

// Объединение CSS классов (Tailwind utility)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Форматирование чисел в валюту
export function formatCurrency(
  amount: number,
  currency: string = 'TJS',
  locale: string = 'ru-TJ'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + currency
}

// Форматирование большого числа (сокращённо)
export function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1) + ' млн'
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(1) + ' тыс'
  }
  return amount.toFixed(2)
}

// Форматирование даты
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-TJ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Форматирование даты и времени
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-TJ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Вычисление уровня риска по матрице 5x5
export function calculateRiskLevel(
  probability: ProbabilityScore,
  impact: ImpactScore
): RiskLevel {
  const score = probability * impact

  if (score <= 4) return 'Низкий'
  if (score <= 9) return 'Средний'
  if (score <= 16) return 'Высокий'
  return 'Экстремальные'
}

// Цвет для уровня риска
export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    'Низкий': 'bg-green-100 text-green-800 border-green-200',
    'Средний': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Высокий': 'bg-orange-100 text-orange-800 border-orange-200',
    'Экстремальные': 'bg-red-100 text-red-800 border-red-200',
  }
  return colors[level] || 'bg-gray-100 text-gray-800'
}

// Цвет для тепловой матрицы (по score)
export function getHeatmapColor(probability: number, impact: number): string {
  const score = probability * impact
  if (score <= 4)  return '#dcfce7' // зелёный
  if (score <= 9)  return '#fef9c3' // жёлтый
  if (score <= 16) return '#ffedd5' // оранжевый
  return '#fee2e2'                  // красный
}

// Цвет текста для тепловой матрицы
export function getHeatmapTextColor(probability: number, impact: number): string {
  const score = probability * impact
  if (score <= 4)  return '#15803d'
  if (score <= 9)  return '#854d0e'
  if (score <= 16) return '#9a3412'
  return '#991b1b'
}

// Оценка вероятности → текст
export function getProbabilityLabel(score: number): string {
  const labels: Record<number, string> = {
    1: 'Маловероятно',
    2: 'Редко',
    3: 'Вероятно',
    4: 'Часто',
    5: 'Определенно',
  }
  return labels[score] || String(score)
}

// Оценка влияния → текст
export function getImpactLabel(score: number): string {
  const labels: Record<number, string> = {
    1: 'Несущественные',
    2: 'Малые',
    3: 'Умеренные',
    4: 'Критические',
    5: 'Катастрофические',
  }
  return labels[score] || String(score)
}

// Цвет статуса инцидента
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Открыт': 'bg-blue-100 text-blue-800 border-blue-200',
    'В процессе': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Закрыт': 'bg-green-100 text-green-800 border-green-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

// Получение текущего года
export function getCurrentYear(): number {
  return new Date().getFullYear()
}

// Получение квартала из месяца
export function getQuarter(month: number): number {
  return Math.ceil(month / 3)
}

// Инициалы пользователя
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return parts[0].substring(0, 2).toUpperCase()
}

// Процент с форматированием
export function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

// Укорачивание длинных строк
export function truncate(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

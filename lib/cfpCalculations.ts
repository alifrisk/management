export type EwiStatus = 'green' | 'yellow' | 'red'

export const EWI_EMOJI: Record<EwiStatus, string> = { green: '🟢', yellow: '⚠️', red: '🔴' }
export const EWI_LABEL: Record<EwiStatus, string> = { green: 'Норма', yellow: 'Бдительность', red: 'Кризис' }

export function ewiN1(v: number): EwiStatus {
  if (v < 40) return 'red'
  if (v < 45) return 'yellow'
  return 'green'
}

export function ewiLcr(v: number): EwiStatus {
  if (v < 80) return 'red'
  if (v < 100) return 'yellow'
  return 'green'
}

export function ewiOutflow(v: number): EwiStatus {
  if (v > 7) return 'red'
  if (v > 3) return 'yellow'
  return 'green'
}

export function ewiTop5(v: number): EwiStatus {
  if (v > 20) return 'red'
  if (v > 15) return 'yellow'
  return 'green'
}

export function overallEwi(statuses: EwiStatus[]): EwiStatus {
  if (statuses.includes('red')) return 'red'
  if (statuses.includes('yellow')) return 'yellow'
  return 'green'
}

// Survival Horizon: HQLA (haircut 35%) / avg daily net outflow
// outflow is computed from total deposits × outflow7dPct over 7 days
export function calcSurvivalHorizon(
  hqlaTotal: number,
  totalDeposits: number,
  outflow7dPct: number,
): number {
  const effectiveHqla = hqlaTotal * 0.65
  const dailyOutflow = (totalDeposits * (outflow7dPct / 100)) / 7
  if (dailyOutflow <= 0) return 999
  return Math.round((effectiveHqla / dailyOutflow) * 10) / 10
}

// Reserve coverage %: total available reserve sources / pessimistic outflow × 100
export function calcReserveCoverage(reserveTotal: number, pessimisticOutflow: number): number {
  if (pessimisticOutflow <= 0) return 0
  return Math.round((reserveTotal / pessimisticOutflow) * 1000) / 10
}

export const READINESS_LEVELS: Record<number, { label: string; color: string; bg: string; border: string; desc: string }> = {
  1: { label: 'Уровень 1 — Норма',          color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  desc: 'Штатный режим работы, мониторинг показателей' },
  2: { label: 'Уровень 2 — Наблюдение',      color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', desc: 'Ранние сигналы, усиленный мониторинг, уведомление КУАП' },
  3: { label: 'Уровень 3 — Готовность',      color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', desc: 'Несколько EWI сработали, подготовка резервных источников' },
  4: { label: 'Уровень 4 — Кризисный режим', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300',    desc: 'Активация полного CFP, экстренное заседание КУАП' },
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { TrendingDown, TrendingUp, AlertTriangle, Activity, RefreshCw } from 'lucide-react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g, '')) || 0

// Коэффициенты сценариев
const SCENARIO_COEFF = {
  pessimistic:    { incidents: 1.5, loss: 2.0, recovery: 0.7  },
  catastrophic:   { incidents: 2.5, loss: 5.0, recovery: 0.5  },
}

// Фиксированные строки ущерба для матрицы
const LOSS_ROWS = [400000, 800000, 1000000, 1400000, 1600000, 2000000, 2500000, 3000000, 3200000, 3500000, 4000000, 4500000, 5000000]
// Столбцы возвратности
const RECOVERY_COLS = [0.10, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]

interface HistoricalData {
  totalIncidents: number
  totalLoss: number
  totalRecovery: number
  recoveryRate: number
  avgLossPerIncident: number
  avgIncidentsPerMonth: number
}

export default function OpStressTest() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState('')
  const [historical, setHistorical] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(false)

  // Бюджетный сценарий — ввод вручную
  const [budgetIncidents, setBudgetIncidents] = useState('')
  const [budgetLoss, setBudgetLoss] = useState('')
  const [budgetRecovery, setBudgetRecovery] = useState('')

  // Базовая прибыль для What-If
  const [baseProfit, setBaseProfit] = useState('')

  const fetchHistorical = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('operational_incidents')
      .select('loss_amount_tjs, recovery_amount, discovery_date')
      .gte('discovery_date', `${year}-01-01`)
      .lte('discovery_date', `${year}-12-31`)
    if (month) {
      query = query
        .gte('discovery_date', `${year}-${month.padStart(2,'0')}-01`)
        .lte('discovery_date', `${year}-${month.padStart(2,'0')}-31`)
    }
    const { data } = await query
    if (data && data.length > 0) {
      const totalLoss = data.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)
      const totalRecovery = data.reduce((s, i) => s + (i.recovery_amount || 0), 0)
      const months = month ? 1 : 12
      setHistorical({
        totalIncidents: data.length,
        totalLoss,
        totalRecovery,
        recoveryRate: totalLoss > 0 ? totalRecovery / totalLoss : 0,
        avgLossPerIncident: data.length > 0 ? totalLoss / data.length : 0,
        avgIncidentsPerMonth: data.length / months,
      })
    } else {
      setHistorical(null)
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchHistorical() }, [fetchHistorical])

  // Сценарии
  const budgetScenario = {
    incidents: parseN(budgetIncidents) || historical?.totalIncidents || 0,
    loss:      parseN(budgetLoss)      || historical?.totalLoss || 0,
    recovery:  (parseN(budgetRecovery) / 100) || historical?.recoveryRate || 0,
  }

  const pessimistic = historical ? {
    incidents: Math.round(historical.totalIncidents * SCENARIO_COEFF.pessimistic.incidents),
    loss:      Math.round(historical.totalLoss      * SCENARIO_COEFF.pessimistic.loss),
    recovery:  historical.recoveryRate              * SCENARIO_COEFF.pessimistic.recovery,
  } : null

  const catastrophic = historical ? {
    incidents: Math.round(historical.totalIncidents * SCENARIO_COEFF.catastrophic.incidents),
    loss:      Math.round(historical.totalLoss      * SCENARIO_COEFF.catastrophic.loss),
    recovery:  historical.recoveryRate              * SCENARIO_COEFF.catastrophic.recovery,
  } : null

  const netLoss = (loss: number, rec: number) => loss * (1 - rec)
  const effectPnL = (loss: number, rec: number) => -netLoss(loss, rec)
  const adjProfit = (loss: number, rec: number) => parseN(baseProfit) + effectPnL(loss, rec)

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  const ScenarioCard = ({
    title, icon, color, bg, border,
    incidents, loss, recovery, baseProfitVal,
  }: {
    title: string; icon: string; color: string; bg: string; border: string
    incidents: number; loss: number; recovery: number; baseProfitVal: number
  }) => {
    const nl = netLoss(loss, recovery)
    const eff = effectPnL(loss, recovery)
    const adj = baseProfitVal > 0 ? baseProfitVal + eff : null
    return (
      <div className={`rounded-xl border-2 ${border} ${bg} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <p className={`text-sm font-bold ${color}`}>{title}</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Кол-во инцидентов:</span>
            <span className="font-semibold">{fmt(incidents)} шт.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Сумма ущерба:</span>
            <span className="font-semibold text-red-600">{fmt(loss)} TJS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Возвратность:</span>
            <span className="font-semibold text-green-600">{(recovery * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Сумма возмещения:</span>
            <span className="font-semibold text-green-600">{fmt(loss * recovery)} TJS</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
            <span className="font-semibold text-gray-700">Чистый ущерб (нетто):</span>
            <span className="font-bold text-red-700">{fmt(nl)} TJS</span>
          </div>
          {adj !== null && (
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Эффект на П&У:</span>
              <span className={`font-bold ${eff < 0 ? 'text-red-700' : 'text-green-700'}`}>
                {eff < 0 ? '-' : '+'}{fmt(Math.abs(eff))} TJS
              </span>
            </div>
          )}
          {adj !== null && (
            <div className={`flex justify-between rounded-lg p-2 ${adj >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="font-bold text-gray-700">Скорр. прибыль:</span>
              <span className={`font-bold text-base ${adj >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(adj)} TJS
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const bp = parseN(baseProfit)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Операционный риск — Стресс-тест</h1>
        <p className="text-sm text-gray-500 mt-0.5">Сценарный анализ и What-If модель влияния на прибыль и убыток</p>
      </div>

      {/* Выбор периода */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <Activity className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Период анализа:</span>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          {[2026,2025,2024,2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Весь год</option>
          {MONTHS.map((m,i) => <option key={i} value={String(i+1)}>{m}</option>)}
        </select>
        <button onClick={fetchHistorical}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040]">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </button>
      </div>

      {/* Исторические данные */}
      {historical ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            📊 Исторические данные за {month ? `${MONTHS[parseInt(month)-1]} ${year}` : `${year} год`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Инцидентов', value: `${historical.totalIncidents} шт.`, c: 'text-gray-900' },
              { label: 'Общий ущерб', value: `${fmt(historical.totalLoss)} TJS`, c: 'text-red-600' },
              { label: 'Возмещено', value: `${fmt(historical.totalRecovery)} TJS`, c: 'text-green-600' },
              { label: 'Возвратность', value: `${(historical.recoveryRate * 100).toFixed(1)}%`, c: 'text-blue-600' },
              { label: 'Чистый ущерб', value: `${fmt(historical.totalLoss * (1 - historical.recoveryRate))} TJS`, c: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">⚠️ Нет данных за выбранный период. Введите бюджетные значения вручную.</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          МОДЕЛЬ 1 — СЦЕНАРИИ
      ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-semibold text-gray-900">Модель 1 — Сценарный прогноз</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">Прогноз количества инцидентов, ущерба и возмещения по трём сценариям</p>

        {/* Базовая прибыль */}
        <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <label className={lbl}>Базовая прибыль банка (TJS) *</label>
              <input type="text" inputMode="numeric" value={baseProfit}
                onChange={e => setBaseProfit(fmtN(e.target.value))}
                placeholder="119 884 299" className={inp} />
              <p className="text-xs text-gray-400 mt-0.5">Прибыль до учёта операционных потерь</p>
            </div>
            {bp > 0 && (
              <div className="bg-white rounded-lg p-3 text-xs">
                <p className="text-gray-400">Текущая прибыль с учётом истории</p>
                {historical && (
                  <p className="font-bold text-gray-900 text-sm mt-0.5">
                    {fmt(bp - historical.totalLoss * (1 - historical.recoveryRate))} TJS
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Бюджетный сценарий — ввод */}
        <div className="mb-5 p-4 border-2 border-green-200 bg-green-50 rounded-xl">
          <p className="text-xs font-bold text-green-700 mb-3">📈 БЮДЖЕТНЫЙ СЦЕНАРИЙ — ввод вручную</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Кол-во инцидентов</label>
              <input type="text" inputMode="numeric" value={budgetIncidents}
                onChange={e => setBudgetIncidents(e.target.value.replace(/\D/g,''))}
                placeholder={historical ? String(historical.totalIncidents) : '0'} className={inp} />
            </div>
            <div>
              <label className={lbl}>Сумма ущерба (TJS)</label>
              <input type="text" inputMode="numeric" value={budgetLoss}
                onChange={e => setBudgetLoss(fmtN(e.target.value))}
                placeholder={historical ? fmt(historical.totalLoss) : '0'} className={inp} />
            </div>
            <div>
              <label className={lbl}>Возвратность (%)</label>
              <input type="text" inputMode="numeric" value={budgetRecovery}
                onChange={e => setBudgetRecovery(e.target.value.replace(/\D/g,''))}
                placeholder={historical ? `${(historical.recoveryRate * 100).toFixed(0)}` : '0'} className={inp} />
            </div>
          </div>
        </div>

        {/* Три карточки сценариев */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ScenarioCard
            title="Бюджетный" icon="📈"
            color="text-green-700" bg="bg-green-50" border="border-green-200"
            incidents={budgetScenario.incidents}
            loss={budgetScenario.loss}
            recovery={budgetScenario.recovery}
            baseProfitVal={bp}
          />
          {pessimistic ? (
            <ScenarioCard
              title="Пессимистичный" icon="📉"
              color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200"
              incidents={pessimistic.incidents}
              loss={pessimistic.loss}
              recovery={pessimistic.recovery}
              baseProfitVal={bp}
            />
          ) : (
            <div className="rounded-xl border-2 border-dashed border-yellow-200 bg-yellow-50 p-4 flex items-center justify-center">
              <p className="text-xs text-yellow-600 text-center">Загрузите исторические данные для автоматического расчёта</p>
            </div>
          )}
          {catastrophic ? (
            <ScenarioCard
              title="Катастрофический" icon="⚠️"
              color="text-red-700" bg="bg-red-50" border="border-red-200"
              incidents={catastrophic.incidents}
              loss={catastrophic.loss}
              recovery={catastrophic.recovery}
              baseProfitVal={bp}
            />
          ) : (
            <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-4 flex items-center justify-center">
              <p className="text-xs text-red-600 text-center">Загрузите исторические данные для автоматического расчёта</p>
            </div>
          )}
        </div>

        {/* Пояснение логики */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">
            <span className="font-semibold">Логика расчёта:</span>{' '}
            Пессимистичный = история × (инциденты: 1.5×, ущерб: 2.0×, возвратность: 0.7×) ·{' '}
            Катастрофический = история × (инциденты: 2.5×, ущерб: 5.0×, возвратность: 0.5×)
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          МОДЕЛЬ 2 — WHAT-IF МАТРИЦА
      ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Модель 2 — What-If матрица</h2>
        <p className="text-xs text-gray-500 mb-4">
          Влияние на прибыль и убыток банка при различных комбинациях ущерба и возвратности
          {bp > 0 && <span className="font-medium text-gray-700"> · Базовая прибыль: {fmt(bp)} TJS</span>}
        </p>

        {bp === 0 ? (
          <div className="p-6 bg-blue-50 rounded-xl text-center">
            <p className="text-sm text-blue-700">Введите базовую прибыль выше для отображения матрицы</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap rounded-tl-lg">
                    Ущерб (TJS) ↓ / Возвратность →
                  </th>
                  {RECOVERY_COLS.map(r => (
                    <th key={r} className="bg-gray-800 text-white px-2 py-2 text-center whitespace-nowrap">
                      {(r * 100).toFixed(0)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LOSS_ROWS.map((loss, li) => {
                  // Highlight rows matching scenarios
                  const isPess = pessimistic && Math.abs(loss - pessimistic.loss) < 200000
                  const isCat  = catastrophic && Math.abs(loss - catastrophic.loss) < 200000
                  const isBudget = Math.abs(loss - budgetScenario.loss) < 200000
                  const rowBg = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isBudget ? 'bg-green-50' : li % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  return (
                    <tr key={loss} className={rowBg}>
                      <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200">
                        {fmt(loss)}
                        {isCat  && <span className="ml-1 text-[10px] text-red-500 font-normal">⚠️ кат.</span>}
                        {isPess && !isCat && <span className="ml-1 text-[10px] text-yellow-500 font-normal">📉 песс.</span>}
                        {isBudget && !isPess && !isCat && <span className="ml-1 text-[10px] text-green-500 font-normal">📈 бюдж.</span>}
                      </td>
                      {RECOVERY_COLS.map(rec => {
                        const adj = adjProfit(loss, rec)
                        const eff = effectPnL(loss, rec)
                        const isNeg = adj < 0
                        const isLow = adj > 0 && adj < bp * 0.9
                        return (
                          <td key={rec} className={`px-2 py-1.5 text-center font-medium whitespace-nowrap ${isNeg ? 'text-red-700 bg-red-100' : isLow ? 'text-yellow-700' : 'text-green-700'}`}>
                            {fmt(adj)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Легенда */}
        {bp > 0 && (
          <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block"/> &gt;90% базовой прибыли</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block"/> 0–90% базовой прибыли</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block"/> Убыток</span>
          </div>
        )}
      </div>
    </div>
  )
}

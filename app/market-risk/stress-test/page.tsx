'use client'
import { useState, useCallback } from 'react'
import { RefreshCw, Download, Printer, TrendingDown, TrendingUp, Info } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const fmt2 = (n: number) => n.toFixed(2)
const fmt4 = (n: number) => (n * 100).toFixed(2) + '%'

// ✅ Monte Carlo simulation (Normal distribution via Box-Muller)
function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function runMonteCarlo(mean: number, stdDev: number, iterations = 10000): {
  results: number[]
  probabilities: { threshold: number; prob: number }[]
} {
  const results: number[] = []
  for (let i = 0; i < iterations; i++) {
    results.push(normalRandom(mean, stdDev))
  }

  // Devaluation thresholds (TJS weakens = positive change)
  const devalThresholds = [1, 3, 5, 6, 10, 12, 15, 20]
  // Appreciation thresholds (TJS strengthens = negative change)
  const appreciateThresholds = [1, 2, 3, 5, 6, 10, 15]

  const probabilities: { threshold: number; type: 'deval' | 'apprec'; prob: number }[] = [
    ...devalThresholds.map(t => ({
      threshold: t, type: 'deval' as const,
      prob: results.filter(r => r > t).length / iterations * 100,
    })),
    ...appreciateThresholds.map(t => ({
      threshold: t,
    type: 'apprec' as const,
    prob: results.filter(r => r < -t).length / iterations * 100
  })))

  return { results, probabilities }
}

// Histogram bins
function makeHistogram(results: number[], bins = 40) {
  const min = Math.min(...results)
  const max = Math.max(...results)
  const step = (max - min) / bins
  const histogram = Array.from({ length: bins }, (_, i) => ({
    range: `${(min + i * step).toFixed(1)}%`,
    count: 0,
    pct: min + i * step,
  }))
  results.forEach(r => {
    const idx = Math.min(Math.floor((r - min) / step), bins - 1)
    histogram[idx].count++
  })
  return histogram
}

interface CurrencyStats {
  mean: number
  stdDev: number
  min: number
  max: number
  current: number
  dataPoints: number
  totalChange: number
  rates?: { date: string; value: number }[]
}

const CURRENCIES = [
  { code: 'USD', label: 'USD / TJS', color: '#1B8A4C' },
  { code: 'RUB', label: 'RUB / TJS', color: '#3B82F6' },
  { code: 'EUR', label: 'EUR / TJS', color: '#F59E0B' },
]

const SCENARIO_PARAMS = {
  base:        { strengthen: 2,  weaken: 5,  volatility: 5  },
  optimistic:  { strengthen: 4,  weaken: 10, volatility: 7  },
  pessimistic: { strengthen: 6,  weaken: 20, volatility: 10 },
}

export default function MarketStressTest() {
  const [dateFrom, setDateFrom]   = useState('2022-01-01')
  const [dateTo,   setDateTo]     = useState(new Date().toISOString().split('T')[0])
  const [currency, setCurrency]   = useState('USD')
  const [stats,    setStats]      = useState<CurrencyStats | null>(null)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState<string | null>(null)

  // Manual override
  const [manualMean,   setManualMean]   = useState('')
  const [manualStdDev, setManualStdDev] = useState('')
  const [iterations,   setIterations]   = useState(10000)

  // Monte Carlo results
  const [mcResults, setMcResults] = useState<ReturnType<typeof runMonteCarlo> | null>(null)
  const [histogram, setHistogram] = useState<ReturnType<typeof makeHistogram> | null>(null)
  const [running,   setRunning]   = useState(false)

  const [tab, setTab] = useState<1|2|3>(1)

  // Model 2 state
  const [gdpBase,     setGdpBase]     = useState('173000000000')
  const [gdpGrowth,   setGdpGrowth]   = useState('8.1')
  const [remitShare,  setRemitShare]  = useState('35.6')
  const [alifShare,   setAlifShare]   = useState('15.04')
  const [margin,      setMargin]      = useState('1.67')
  const [baseIncome,  setBaseIncome]  = useState('83597906')

  const GROWTH_ROWS = [-5.0, -3.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 8.5]
  const REMIT_COLS  = [55, 50, 48, 45, 40, 35, 30, 25, 15, 10]

  // Fetch from NBT
  const fetchRates = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/market-risk/nbt-rates?currency=${currency}&d1=${dateFrom}&d2=${dateTo}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStats(data.stats)
      // Pre-fill manual fields
      setManualMean(String(data.stats.mean))
      setManualStdDev(String(data.stats.stdDev))
    } catch (e: unknown) {
      setError('Ошибка: ' + (e instanceof Error ? e.message : String(e)))
    }
    setLoading(false)
  }, [currency, dateFrom, dateTo])

  // Run Monte Carlo
  function runSimulation() {
    const mean   = parseFloat(manualMean)   || stats?.mean   || 0
    const stdDev = parseFloat(manualStdDev) || stats?.stdDev || 1
    if (isNaN(mean) || isNaN(stdDev) || stdDev <= 0) return
    setRunning(true)
    setTimeout(() => {
      const result = runMonteCarlo(mean, stdDev, iterations)
      setMcResults(result)
      setHistogram(makeHistogram(result.results))
      setRunning(false)
    }, 50)
  }

  // Export
  function exportExcel() {
    if (!mcResults) return
    const rows: string[][] = []
    rows.push(['СТРЕСС-ТЕСТ РЫНОЧНОГО РИСКА — Симуляция Монте Карло'])
    rows.push([`Валюта: ${currency}/TJS  |  Период: ${dateFrom} — ${dateTo}`])
    rows.push([`Итераций: ${iterations}  |  Mean: ${manualMean || stats?.mean}%  |  StdDev: ${manualStdDev || stats?.stdDev}%`])
    rows.push([])
    if (stats) {
      rows.push(['ИСТОРИЧЕСКИЕ ПАРАМЕТРЫ'])
      rows.push(['Среднее изменение', `${stats.mean}%`])
      rows.push(['Стд. отклонение', `${stats.stdDev}%`])
      rows.push(['Минимум', `${stats.min}%`])
      rows.push(['Максимум', `${stats.max}%`])
      rows.push(['Текущий курс', String(stats.current)])
      rows.push(['Точек данных', String(stats.dataPoints)])
      rows.push([])
    }
    rows.push(['ВЕРОЯТНОСТИ ДЕВАЛЬВАЦИИ TJS'])
    rows.push(['Порог', 'Вероятность'])
    mcResults.probabilities.filter(p => p.type === 'deval').forEach(p => {
      rows.push([`>${p.threshold}%`, `${p.prob.toFixed(2)}%`])
    })
    rows.push([])
    rows.push(['ВЕРОЯТНОСТИ УКРЕПЛЕНИЯ TJS'])
    rows.push(['Порог', 'Вероятность'])
    mcResults.probabilities.filter(p => p.type === 'apprec').forEach(p => {
      rows.push([`>${p.threshold}%`, `${p.prob.toFixed(2)}%`])
    })
    rows.push([])
    rows.push(['СЦЕНАРИИ'])
    rows.push(['Сценарий', 'Укрепление', 'Ослабление', 'Волатильность'])
    Object.entries(SCENARIO_PARAMS).forEach(([name, s]) => {
      rows.push([name, `${s.strengthen}%`, `${s.weaken}%`, `${s.volatility}%`])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `Монте_Карло_${currency}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Model 2 calculations
  const calcIncome = (growth: number, remitPct: number) => {
    const gdp      = parseFloat(gdpBase.replace(/\D/g,''))   || 0
    const aShare   = parseFloat(alifShare)  || 0
    const mgn      = parseFloat(margin)     || 0
    const gdpNew   = gdp * (1 + growth / 100)
    const remits   = gdpNew * (remitPct / 100)
    const alifRem  = remits * (aShare / 100)
    return alifRem * (mgn / 100)
  }

  const baseIncomeVal = parseFloat(baseIncome.replace(/\D/g,'')) || 0
  const effectPnL2    = (growth: number, remitPct: number) => calcIncome(growth, remitPct) - baseIncomeVal

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Рыночный риск — Стресс-тест</h1>
          <p className="text-sm text-gray-500 mt-0.5">Симуляция Монте Карло · Валютный риск TJS</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={exportExcel} disabled={!mcResults}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Параметры */}
      <div className={card}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Параметры</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className={lbl}>Валютная пара</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>История — от</label>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>История — до</label>
            <input type="date" value={dateTo} min={dateFrom} max={new Date().toISOString().split('T')[0]}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Итераций</label>
            <select value={iterations} onChange={e => setIterations(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
              {[1000, 5000, 10000, 50000].map(n => <option key={n} value={n}>{n.toLocaleString('ru-RU')}</option>)}
            </select>
          </div>
          <button onClick={fetchRates} disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Загрузка...' : 'Загрузить из НБТ'}
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
      </div>

      {/* Исторические параметры */}
      {stats && (
        <div className={card}>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            📊 {currency}/TJS — исторические параметры ({stats.dataPoints} торговых дней)
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
            {[
              { l: 'Текущий курс', v: `${stats.current} TJS`, c: 'text-gray-900' },
              { l: 'Среднее (Mean)', v: `${stats.mean}%`, c: stats.mean >= 0 ? 'text-red-600' : 'text-green-600' },
              { l: 'Стд. откл. (σ)', v: `${stats.stdDev}%`, c: 'text-blue-600' },
              { l: 'Минимум', v: `${stats.min}%`, c: 'text-green-600' },
              { l: 'Максимум', v: `${stats.max}%`, c: 'text-red-600' },
              { l: 'Изм. за период', v: `${stats.totalChange}%`, c: stats.totalChange >= 0 ? 'text-red-600' : 'text-green-600' },
            ].map(s => (
              <div key={s.l} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {/* Rate chart */}
          {stats.rates && stats.rates.length > 0 && (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stats.rates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} domain={['auto','auto']} />
                <Tooltip formatter={(v: number) => [`${v} TJS`, `${currency}/TJS`]} />
                <Line type="monotone" dataKey="value" stroke="#1B8A4C" strokeWidth={1.5} dot={false} name={`${currency}/TJS`} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Параметры для симуляции */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Параметры симуляции</p>
          {stats && <p className="text-xs text-gray-400">Заполнены из истории НБТ · можно изменить вручную</p>}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className={lbl}>Среднее дневное изменение (%)</label>
            <input type="text" value={manualMean} onChange={e => setManualMean(e.target.value)}
              placeholder={stats ? String(stats.mean) : '0'} className={inp} />
            <p className="text-xs text-gray-400 mt-0.5">Из истории НБТ: {stats?.mean ?? '—'}%</p>
          </div>
          <div>
            <label className={lbl}>Стандартное отклонение σ (%)</label>
            <input type="text" value={manualStdDev} onChange={e => setManualStdDev(e.target.value)}
              placeholder={stats ? String(stats.stdDev) : '1'} className={inp} />
            <p className="text-xs text-gray-400 mt-0.5">Из истории НБТ: {stats?.stdDev ?? '—'}%</p>
          </div>
          <button onClick={runSimulation} disabled={running || (!manualMean && !stats)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
            {running ? <><RefreshCw className="w-4 h-4 animate-spin"/> Симуляция...</> : <>▶ Запустить Монте Карло ({iterations.toLocaleString('ru-RU')} итераций)</>}
          </button>
        </div>
        {/* Info */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Монте Карло генерирует {iterations.toLocaleString('ru-RU')} случайных сценариев изменения курса по нормальному распределению N(μ, σ). 
            Результат — вероятность превышения порогового значения изменения.
          </p>
        </div>
      </div>

      {/* Сценарии */}
      <div className={card}>
        <p className="text-sm font-semibold text-gray-700 mb-3">Предположения по сценариям</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide">Предположение</th>
                <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Базовый</th>
                <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Оптимистичный</th>
                <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Пессимистичный</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50 border-b border-gray-200">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">Резкое укрепление валюты</p>
                  <p className="text-xs text-gray-500 mt-0.5">При экономическом росте / политической стабильности</p>
                </td>
                <td className="px-4 py-3 text-center font-bold text-green-700">{SCENARIO_PARAMS.base.strengthen}%</td>
                <td className="px-4 py-3 text-center font-bold text-green-600">{SCENARIO_PARAMS.optimistic.strengthen}%</td>
                <td className="px-4 py-3 text-center font-bold text-green-500">{SCENARIO_PARAMS.pessimistic.strengthen}%</td>
              </tr>
              <tr className="bg-red-50 border-b border-gray-200">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">Резкое ослабление валюты</p>
                  <p className="text-xs text-gray-500 mt-0.5">При экономическом кризисе / нестабильности</p>
                </td>
                <td className="px-4 py-3 text-center font-bold text-red-700">{SCENARIO_PARAMS.base.weaken}%</td>
                <td className="px-4 py-3 text-center font-bold text-red-600">{SCENARIO_PARAMS.optimistic.weaken}%</td>
                <td className="px-4 py-3 text-center font-bold text-red-500">{SCENARIO_PARAMS.pessimistic.weaken}%</td>
              </tr>
              <tr className="bg-yellow-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">Волатильность</p>
                  <p className="text-xs text-gray-500 mt-0.5">Резкие колебания курса в короткий период</p>
                </td>
                <td className="px-4 py-3 text-center font-bold text-yellow-700">{SCENARIO_PARAMS.base.volatility}%</td>
                <td className="px-4 py-3 text-center font-bold text-yellow-600">{SCENARIO_PARAMS.optimistic.volatility}%</td>
                <td className="px-4 py-3 text-center font-bold text-yellow-500">{SCENARIO_PARAMS.pessimistic.volatility}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Вкладки моделей */}
      <div className="flex border-b border-gray-200">
        {([1, 2] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t===1 ? '📈 Модель 1 — Монте Карло (валютный риск)' : '🌍 Модель 2 — Макроэкономика (переводы)'}
          </button>
        ))}
      </div>

      {tab === 1 && (
      <>
      {/* Результаты Монте Карло */}
      {mcResults && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Девальвация */}
            <div className={card}>
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Вероятность девальвации {currency} к TJS
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Порог</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Вероятность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mcResults.probabilities.filter(p => p.type === 'deval').map((p, i) => (
                    <tr key={p.threshold} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{i+1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-700">Вероятность &gt;{p.threshold}%</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm font-bold ${p.prob > 30 ? 'text-red-600' : p.prob > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {p.prob.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Укрепление */}
            <div className={card}>
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Вероятность укрепления TJS к {currency}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Порог</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Вероятность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mcResults.probabilities.filter(p => p.type === 'apprec').map((p, i) => (
                    <tr key={p.threshold} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{i+1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-700">Вероятность &gt;{p.threshold}%</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm font-bold ${p.prob > 30 ? 'text-green-600' : p.prob > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {p.prob.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Гистограмма распределения */}
          {histogram && (
            <div className={card}>
              <p className="text-sm font-semibold text-gray-700 mb-1">Распределение результатов симуляции</p>
              <p className="text-xs text-gray-400 mb-4">Нормальное распределение N(μ={manualMean || stats?.mean}%, σ={manualStdDev || stats?.stdDev}%) · {iterations.toLocaleString('ru-RU')} итераций</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histogram.filter((_, i) => i % 2 === 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, 'Частота']} />
                  <Bar dataKey="count" fill="#1B8A4C" radius={[2,2,0,0]} name="Частота" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!mcResults && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Загрузите данные из НБТ и запустите симуляцию</p>
        </div>
      )}
      </>
      )}



      {/* ═══ МОДЕЛЬ 2 — МАКРОЭКОНОМИКА ═══ */}
      {tab === 2 && (
        <div className="space-y-5">
          {/* Входные данные */}
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Параметры модели</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className={lbl}>ВВП базовый (сомони)</label>
                <input type="text" value={gdpBase} onChange={e => setGdpBase(e.target.value)} placeholder="173 000 000 000" className={inp} /></div>
              <div><label className={lbl}>Прогноз роста ВВП (%)</label>
                <input type="text" value={gdpGrowth} onChange={e => setGdpGrowth(e.target.value)} placeholder="8.1" className={inp} /></div>
              <div><label className={lbl}>Доля переводов в ВВП (%)</label>
                <input type="text" value={remitShare} onChange={e => setRemitShare(e.target.value)} placeholder="35.6" className={inp} /></div>
              <div><label className={lbl}>Доля Алиф в переводах (%)</label>
                <input type="text" value={alifShare} onChange={e => setAlifShare(e.target.value)} placeholder="15.04" className={inp} /></div>
              <div><label className={lbl}>Маржа доходности (%)</label>
                <input type="text" value={margin} onChange={e => setMargin(e.target.value)} placeholder="1.67" className={inp} /></div>
              <div><label className={lbl}>Базовый доход (сомони)</label>
                <input type="text" value={baseIncome} onChange={e => setBaseIncome(e.target.value)} placeholder="83 597 906" className={inp} /></div>
            </div>
            {/* Расчёт базового */}
            {parseFloat(gdpBase.replace(/\D/g,'')) > 0 && (
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: 'Прогноз ВВП', v: `${new Intl.NumberFormat('ru-RU').format(Math.round(parseFloat(gdpBase.replace(/\D/g,'')) * (1 + parseFloat(gdpGrowth)/100)))} TJS` },
                  { l: 'Переводы в РТ', v: `${new Intl.NumberFormat('ru-RU').format(Math.round(parseFloat(gdpBase.replace(/\D/g,'')) * (1 + parseFloat(gdpGrowth)/100) * parseFloat(remitShare)/100))} TJS` },
                  { l: 'Переводы Алиф', v: `${new Intl.NumberFormat('ru-RU').format(Math.round(parseFloat(gdpBase.replace(/\D/g,'')) * (1 + parseFloat(gdpGrowth)/100) * parseFloat(remitShare)/100 * parseFloat(alifShare)/100))} TJS` },
                  { l: 'Ожид. доход', v: `${new Intl.NumberFormat('ru-RU').format(Math.round(calcIncome(parseFloat(gdpGrowth), parseFloat(remitShare))))} TJS` },
                ].map(s => (
                  <div key={s.l} className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{s.l}</p>
                    <p className="text-sm font-bold text-green-700">{s.v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Сценарии */}
          <div className={card}>
            <p className="text-sm font-semibold text-gray-700 mb-4">Сценарии</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2.5 text-left text-xs uppercase">Сценарий</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Рост ВВП</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Доля переводов</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Ожид. доход</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Эффект на П&У</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: '📈 Базовый',           g: parseFloat(gdpGrowth), r: parseFloat(remitShare), bg: 'bg-green-50'  },
                    { name: '📉 Пессимистичный',     g: 0,                     r: 15,                     bg: 'bg-yellow-50' },
                    { name: '⚠️ Катастрофический',   g: -5,                    r: 10,                     bg: 'bg-red-50'    },
                  ].map(sc => {
                    const inc = calcIncome(sc.g, sc.r)
                    const eff = inc - baseIncomeVal
                    return (
                      <tr key={sc.name} className={`${sc.bg} border-b border-gray-200`}>
                        <td className="px-4 py-3 font-semibold">{sc.name}</td>
                        <td className="px-4 py-3 text-center">{sc.g}%</td>
                        <td className="px-4 py-3 text-center">{sc.r}%</td>
                        <td className="px-4 py-3 text-center font-medium">{new Intl.NumberFormat('ru-RU').format(Math.round(inc))}</td>
                        <td className="px-4 py-3 text-center font-bold text-base">
                          <span className={eff >= 0 ? 'text-green-700' : 'text-red-700'}>
                            {eff >= 0 ? '+' : ''}({new Intl.NumberFormat('ru-RU').format(Math.abs(Math.round(eff)))})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* What-If матрица */}
          <div className={card}>
            <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица</p>
            <p className="text-xs text-gray-500 mb-4">Ожидаемый доход Алиф от денежных переводов (сомони)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap sticky left-0">
                      Рост ВВП ↓ / Доля переводов →
                    </th>
                    {REMIT_COLS.map(c => (
                      <th key={c} className={`px-3 py-2 text-center whitespace-nowrap text-white ${c === 35 ? 'bg-[#1B8A4C]' : 'bg-gray-800'}`}>
                        {c}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROWTH_ROWS.map((g, gi) => {
                    const isPess = g === 0
                    const isCat  = g === -5.0
                    const isBase = Math.abs(g - parseFloat(gdpGrowth)) < 0.1
                    const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isBase ? 'bg-green-50' : gi%2===0 ? 'bg-white' : 'bg-gray-50'
                    return (
                      <tr key={g} className={rowBg}>
                        <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                          {g > 0 ? '+' : ''}{g}%
                          {isCat  && <span className="ml-1 text-[10px] text-red-500">⚠️</span>}
                          {isPess && !isCat && <span className="ml-1 text-[10px] text-yellow-500">📉</span>}
                          {isBase && <span className="ml-1 text-[10px] text-green-500">📈</span>}
                        </td>
                        {REMIT_COLS.map(r => {
                          const inc = calcIncome(g, r)
                          const eff = inc - baseIncomeVal
                          const isNeg = eff < 0
                          const isLow = eff >= 0 && inc < baseIncomeVal * 0.9
                          return (
                            <td key={r} className={`px-2 py-1.5 text-center font-medium whitespace-nowrap
                              ${r === 35 ? 'border-x border-green-200' : ''}
                              ${isNeg ? 'text-red-700 bg-red-100' : isLow ? 'text-yellow-700' : 'text-green-700'}`}>
                              {new Intl.NumberFormat('ru-RU').format(Math.round(inc))}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block"/> Выше базового</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block"/> Ниже базового</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block"/> Убыток</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1B8A4C]/20 rounded inline-block"/> Доля 35% (текущий прогноз)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

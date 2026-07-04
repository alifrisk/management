'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, Download, Printer, TrendingDown, TrendingUp, Info, Database, Save } from 'lucide-react'
import { supabase } from '@/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const fmtN   = (v: string)  => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }

function normalRandom(mean: number, sd: number) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function runMonteCarlo(mean: number, sd: number, n: number) {
  const results: number[] = Array.from({ length: n }, () => normalRandom(mean, sd))
  const sorted = [...results].sort((a, b) => a - b)

  const devalT    = [1, 3, 5, 6, 10, 12, 15, 20]
  const appreciT  = [1, 2, 3, 5, 6, 10, 15]
  const probs: { label: string; pct: number; type: 'deval' | 'apprec' }[] = [
    ...devalT.map(t => ({ label: `> ${t}%`, pct: results.filter(r => r > t).length / n * 100, type: 'deval' as const })),
    ...appreciT.map(t => ({ label: `> ${t}%`, pct: results.filter(r => r < -t).length / n * 100, type: 'apprec' as const })),
  ]

  // ── Исторический VaR (из симуляций, без предположений о распределении)
  const q = (p: number) => sorted[Math.floor(p * n)]
  const histVar95 = +(-q(0.05)).toFixed(2)
  const histVar99 = +(-q(0.01)).toFixed(2)

  // ── Параметрический VaR (аналитическая формула нормального распределения)
  const mu  = results.reduce((s,r) => s+r, 0) / n
  const sig = Math.sqrt(results.reduce((s,r) => s+(r-mu)**2, 0) / n)
  const paramVar95 = +(-(mu - 1.645 * sig)).toFixed(2)  // z=1.645 для 95%
  const paramVar99 = +(-(mu - 2.326 * sig)).toFixed(2)  // z=2.326 для 99%

  // ── CVaR / Expected Shortfall (среднее худших сценариев за порогом VaR)
  const tail95 = sorted.slice(0, Math.floor(0.05 * n))
  const tail99 = sorted.slice(0, Math.floor(0.01 * n))
  const cvar95 = tail95.length ? +(-(tail95.reduce((s,r) => s+r, 0) / tail95.length)).toFixed(2) : 0
  const cvar99 = tail99.length ? +(-(tail99.reduce((s,r) => s+r, 0) / tail99.length)).toFixed(2) : 0

  const median   = +q(0.50).toFixed(2)
  const expected = +mu.toFixed(2)

  const var95loss = histVar95
  const var99loss = histVar99

  // Histogram
  const min = Math.min(...results), max = Math.max(...results), bins = 40
  const step = (max - min) / bins
  const hist = Array.from({ length: bins }, (_, i) => ({ x: `${(min + i * step).toFixed(1)}%`, n: 0, pct: 0 }))
  results.forEach(r => { const i = Math.min(Math.floor((r - min) / step), bins - 1); hist[i].n++ })
  hist.forEach(h => { h.pct = Math.round(h.n / n * 1000) / 10 })

  const appreciationPct = +(results.filter(r => r < 0).length / n * 100).toFixed(1)
  const depreciationPct = +(results.filter(r => r > 0).length / n * 100).toFixed(1)

  return { probs, hist: hist.filter((_, i) => i % 2 === 0), var95loss, var99loss, median, expected, histVar95, histVar99, paramVar95, paramVar99, cvar95, cvar99, appreciationPct, depreciationPct }
}

function calcStats(rates: { date: string; value: number }[]) {
  const returns = rates.slice(1).map((r, i) => (r.value - rates[i].value) / rates[i].value * 100)
  const mean   = returns.reduce((s, r) => s + r, 0) / returns.length
  const sd     = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length)
  return {
    mean:   +mean.toFixed(2),
    stdDev: +sd.toFixed(2),
    min:    +Math.min(...returns).toFixed(2),
    max:    +Math.max(...returns).toFixed(2),
    current: rates[rates.length - 1].value,
    points:  rates.length,
  }
}

function parseNBT(xml: string) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
  return items.flatMap(item => {
    const d = item.match(/<date>(.*?)<\/date>/)
    const v = item.match(/<value>(.*?)<\/value>/)
    if (!d || !v) return []
    const val = parseFloat(v[1].replace(',', '.'))
    return isNaN(val) || val <= 0 ? [] : [{ date: d[1], value: val }]
  })
}

// ── Model 2 helpers ───────────────────────────────────────────────────────────
const GROWTH_ROWS = [-3, -2, -1, 0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const REMIT_COLS  = [70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10]

const HORIZONS = [
  { days: 1,   label: '1 день'   },
  { days: 7,   label: '7 дней'   },
  { days: 30,  label: '30 дней'  },
  { days: 90,  label: '3 месяца' },
  { days: 180, label: '6 месяцев'},
  { days: 365, label: '1 год'    },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function MarketStressTest() {
  const [model, setModel] = useState<1 | 2>(1)
  const [saving, setSaving]       = useState(false)
  const [analystName, setAnalystName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('full_name').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p) setAnalystName(p.full_name || '') })
      }
    })
  }, [])

  // Model 1 — source
  const [currency,   setCurrency]   = useState('USD')
  const handleCurrencyChange = (val: string) => { setCurrency(val); setTrimmed(false); setNbtStats(null); setNbtRates([]); setMean(''); setStdDev(''); setMcResult(null) }
  const [dateFrom,   setDateFrom]   = useState('2022-01-01')
  const [dateTo,     setDateTo]     = useState(new Date().toISOString().split('T')[0])
  const handleDateChange = (key: 'from'|'to', val: string) => { if(key==='from') setDateFrom(val); else setDateTo(val); setTrimmed(false); setNbtStats(null); setNbtRates([]); setMean(''); setStdDev(''); setMcResult(null) }
  const [nbtLoading, setNbtLoading] = useState(false)
  const [nbtError,   setNbtError]   = useState<string | null>(null)
  const [trimmed,    setTrimmed]    = useState(false)
  const [nbtStats,   setNbtStats]   = useState<ReturnType<typeof calcStats> | null>(null)
  const [nbtRates,   setNbtRates]   = useState<{ date: string; value: number }[]>([])

  // Parameters (auto-filled from NBT or manual)
  const [mean,   setMean]   = useState('')
  const [stdDev, setStdDev] = useState('')
  const [iters,   setIters]   = useState(10000)
  const [horizon, setHorizon] = useState(1)

  // Monte Carlo results
  const [mcResult,    setMcResult]    = useState<ReturnType<typeof runMonteCarlo> | null>(null)
  const [running,     setRunning]     = useState(false)

  // Model 2 inputs
  const [gdpBase,    setGdpBase]    = useState('173 000 000 000')
  const [alifShare,  setAlifShare]  = useState('15.04')
  const [margin,     setMargin]     = useState('1.67')
  const [baseIncome, setBaseIncome] = useState('83 597 906')

  // Model 2 scenario selectors
  const [optGrowth,  setOptGrowth]  = useState<number>(8)
  const [optRemit,   setOptRemit]   = useState<number>(55)
  const [pessGrowth, setPessGrowth] = useState<number>(1)
  const [pessRemit,  setPessRemit]  = useState<number>(25)
  const [catGrowth,  setCatGrowth]  = useState<number>(-3)
  const [catRemit,   setCatRemit]   = useState<number>(10)

  const inp  = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl  = "block text-xs font-medium text-gray-600 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"

  // ── NBT fetch ───────────────────────────────────────────────────────────────
  async function fetchNBT() {
    setNbtLoading(true); setNbtError(null)
    try {
      const codes: Record<string, { cn: string }> = { USD: { cn: '840' }, RUB: { cn: '643' }, EUR: { cn: '978' } }
      const { cn } = codes[currency] || { cn: '840' }
      const url = `https://nbt.tj/ru/kurs/export_xml_dynamic.php?d1=${dateFrom}&d2=${dateTo}&cn=${cn}&cs=${currency}&export=xml`
      const res = await fetch(`/api/market-risk/nbt-rates?currency=${currency}&d1=${dateFrom}&d2=${dateTo}${trimmed ? '&trim=true' : ''}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const stats = data.stats
      setNbtStats(stats)
      setNbtRates(stats.rates || [])
      setMean(String(stats.mean))
      setStdDev(String(stats.stdDev))
    } catch (e: unknown) {
      setNbtError('Ошибка НБТ: ' + (e instanceof Error ? e.message : String(e)))
    }
    setNbtLoading(false)
  }

  // ── Monte Carlo ─────────────────────────────────────────────────────────────
  function runSim() {
    const m  = parseFloat(mean)
    const sd = parseFloat(stdDev)
    if (isNaN(m) || isNaN(sd) || sd <= 0) return
    setRunning(true)
    setTimeout(() => {
      // Масштабируем по горизонту: μ×T, σ×√T (случайное блуждание)
      const mH  = m  * horizon
      const sdH = sd * Math.sqrt(horizon)
      setMcResult(runMonteCarlo(mH, sdH, iters))
      setRunning(false)
    }, 50)
  }

  // ── Model 2 calc ────────────────────────────────────────────────────────────
  const gdp0     = parseFloat(gdpBase.replace(/\D/g, ''))    || 0
  const aShare   = parseFloat(alifShare)   || 0
  const mgn      = parseFloat(margin)      || 0
  const biVal    = parseFloat(baseIncome.replace(/\D/g, '')) || 0

  const calcIncome = (g: number, r: number) =>
    gdp0 * (1 + g / 100) * (r / 100) * (aShare / 100) * (mgn / 100)

  // ── Сохранить в реестр ───────────────────────────────────────────────────────
  async function saveToRegistry() {
    setSaving(true)

    // Модель 2 — всегда доступна (не требует запуска)
    const m2scenarios = [
      { name: 'Оптимистичный',    g: optGrowth,  r: optRemit  },
      { name: 'Пессимистичный',   g: pessGrowth, r: pessRemit },
      { name: 'Катастрофический', g: catGrowth,  r: catRemit  },
    ].map(sc => ({ ...sc, income: Math.round(calcIncome(sc.g, sc.r)), effect: Math.round(calcIncome(sc.g, sc.r) - biVal) }))
    const model2_inputs  = { gdp_base: gdp0, alif_share: alifShare, margin, base_income: biVal, opt: { g: optGrowth, r: optRemit }, pess: { g: pessGrowth, r: pessRemit }, cat: { g: catGrowth, r: catRemit } }
    const model2_results = { scenarios: m2scenarios }
    const h = HORIZONS.find(hh => hh.days === horizon)?.label || `${horizon} дн.`

    // Модель 1 — только если Monte Carlo уже запущен
    const model1_inputs  = mcResult ? { currency, date_from: dateFrom, date_to: dateTo, mean, std_dev: stdDev, iterations: iters, horizon_days: horizon } : null
    const model1_results = mcResult ? { var95_hist: mcResult.histVar95, var99_hist: mcResult.histVar99, var95_param: mcResult.paramVar95, var99_param: mcResult.paramVar99, cvar95: mcResult.cvar95, cvar99: mcResult.cvar99, expected: mcResult.expected, median: mcResult.median, appreciation_pct: mcResult.appreciationPct, depreciation_pct: mcResult.depreciationPct } : null

    const conclusions = [
      mcResult ? `Модель 1 — Монте Карло (${currency}/TJS). Горизонт: ${h}. μ=${mean}%, σ=${stdDev}%. VaR 95%: ${mcResult.histVar95}%, VaR 99%: ${mcResult.histVar99}%. CVaR 95%: ${mcResult.cvar95}%, CVaR 99%: ${mcResult.cvar99}%.` : 'Модель 1 — Монте Карло не запускался.',
      `Модель 2 — Денежные переводы. ВВП: ${fmtNum(gdp0)} сом. Оптимистичный: ${fmtNum(m2scenarios[0].income)} сом. Пессимистичный: ${fmtNum(m2scenarios[1].income)} сом (${m2scenarios[1].effect >= 0 ? '+' : ''}${fmtNum(m2scenarios[1].effect)}). Катастрофический: ${fmtNum(m2scenarios[2].income)} сом (${m2scenarios[2].effect >= 0 ? '+' : ''}${fmtNum(m2scenarios[2].effect)}).`,
    ]

    const { error } = await supabase.from('stress_test_registry').insert({
      risk_type: 'Рыночный риск',
      analyst_name: analystName,
      period: `${dateFrom} — ${dateTo}`,
      inputs:  { model1: model1_inputs,  model2: model2_inputs  },
      results: { model1: model1_results, model2: model2_results },
      conclusion: conclusions.join(' '),
      status: 'Проведён',
    })
    setSaving(false)
    if (error) alert('Ошибка: ' + error.message)
    else alert('Стресс-тест сохранён в реестр')
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportExcel() {
    const rows: string[][] = []
    if (model === 1 && mcResult) {
      rows.push(['МОНТЕ КАРЛО — Валютный риск'])
      rows.push([`${currency}/TJS  μ=${mean}%  σ=${stdDev}%  итераций=${iters}`])
      rows.push([])
      rows.push(['ДЕВАЛЬВАЦИЯ TJS', 'Вероятность'])
      mcResult.probs.filter(p => p.type === 'deval').forEach(p => rows.push([p.label, `${p.pct.toFixed(2)}%`]))
      rows.push([])
      rows.push(['УКРЕПЛЕНИЕ TJS', 'Вероятность'])
      mcResult.probs.filter(p => p.type === 'apprec').forEach(p => rows.push([p.label, `${p.pct.toFixed(2)}%`]))
    } else if (model === 2) {
      rows.push(['МАКРОЭКОНОМИКА — Денежные переводы'])
      rows.push(['ВВП базовый', String(gdp0)])
      rows.push(['Оптимистичный: рост ВВП', `${optGrowth}%`])
      rows.push(['Оптимистичный: переводы', `${optRemit}%`])
      rows.push(['Доля Алиф', `${alifShare}%`])
      rows.push(['Маржа', `${margin}%`])
      rows.push([])
      rows.push(['Сценарий', 'Рост ВВП', 'Переводы', 'Доход'])
      rows.push(['Оптимистичный',    `${optGrowth}%`,  `${optRemit}%`,  String(Math.round(calcIncome(optGrowth,  optRemit)))])
      rows.push(['Пессимистичный',   `${pessGrowth}%`, `${pessRemit}%`, String(Math.round(calcIncome(pessGrowth, pessRemit)))])
      rows.push(['Катастрофический', `${catGrowth}%`,  `${catRemit}%`,  String(Math.round(calcIncome(catGrowth,  catRemit)))])
      rows.push([])
      rows.push(['МАТРИЦА: Рост ВВП ↓ / Доля переводов →', ...REMIT_COLS.map(c => `${c}%`)])
      GROWTH_ROWS.forEach(g => rows.push([`${g}%`, ...REMIT_COLS.map(r => String(Math.round(calcIncome(g, r))))]))
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Стресс-тест_Рыночный_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Рыночный риск — Стресс-тест</h1>
          <p className="text-sm text-gray-500 mt-0.5">Монте Карло · Макроэкономический анализ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={saveToRegistry} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm hover:bg-[#166a3a] disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Сохранение...' : 'Сохранить в реестр'}
          </button>
        </div>
      </div>

      {/* ── Переключатель моделей (вверху) ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setModel(1)}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${model === 1 ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          📈 Модель 1 — Монте Карло (валютный риск)
        </button>
        <button onClick={() => setModel(2)}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${model === 2 ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          🌍 Модель 2 — Денежные переводы (макро)
        </button>
      </div>

      {/* ════════════════════════════════════
          МОДЕЛЬ 1 — МОНТЕ КАРЛО
      ════════════════════════════════════ */}
      {model === 1 && (
        <div className="space-y-5">

          {/* Шаг 1 — Источник данных */}
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Шаг 1 — Источник параметров (μ, σ)
            </p>


            <div className="space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={lbl}>Валюта</label>
                    <select value={currency} onChange={e => handleCurrencyChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                      <option value="USD">USD / TJS</option>
                      <option value="RUB">RUB / TJS</option>
                      <option value="EUR">EUR / TJS</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Период — от</label>
                    <input type="date" value={dateFrom} max={dateTo}
                      onChange={e => handleDateChange('from', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                  </div>
                  <div>
                    <label className={lbl}>Период — до</label>
                    <input type="date" value={dateTo} min={dateFrom} max={new Date().toISOString().split('T')[0]}
                      onChange={e => handleDateChange('to', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                  </div>
                  <button onClick={fetchNBT} disabled={nbtLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${nbtLoading ? 'animate-spin' : ''}`} />
                    {nbtLoading ? 'Загрузка...' : 'Загрузить'}
                  </button>
                </div>
                {nbtError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{nbtError}</p>}
                {nbtStats && parseFloat(stdDev) > 1.0 && (
                  <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    <div className="flex items-start justify-between gap-3">
                      <p>⚠️ <strong>Высокая волатильность:</strong> σ={stdDev}%/день — в данных есть кризисный период (например обвал рубля в 2022 — СВО).
                      Аномальные выбросы искажают μ и σ и завышают VaR.</p>
                      {!trimmed ? (
                        <button onClick={() => { setTrimmed(true); setTimeout(fetchNBT, 100) }}
                          className="flex-shrink-0 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-medium hover:bg-yellow-700 whitespace-nowrap">
                          ✂️ Исключить аномалии
                        </button>
                      ) : (
                        <button onClick={() => { setTrimmed(false); setTimeout(fetchNBT, 100) }}
                          className="flex-shrink-0 px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 whitespace-nowrap">
                          ↩ Вернуть все данные
                        </button>
                      )}
                    </div>
                    {trimmed && <p className="mt-1.5 text-green-700 font-medium">✅ Аномалии исключены (±2.5σ фильтр) — данные очищены</p>}
                  </div>
                )}
                {nbtStats && (
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                    {[
                      { l: 'Курс сейчас', v: `${nbtStats.current} TJS`, c: 'text-gray-900' },
                      { l: 'Mean (μ)', v: `${nbtStats.mean}%`, c: 'text-blue-600' },
                      { l: 'StdDev (σ)', v: `${nbtStats.stdDev}%`, c: 'text-purple-600' },
                      { l: 'Min', v: `${nbtStats.min}%`, c: 'text-green-600' },
                      { l: 'Max', v: `${nbtStats.max}%`, c: 'text-red-600' },
                      { l: 'Точек данных', v: String(nbtStats.points), c: 'text-gray-600' },
                    ].map(s => (
                      <div key={s.l} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-400">{s.l}</p>
                        <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                      </div>
                    ))}
                  </div>
                )}
                {nbtRates.length > 0 && (
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={nbtRates}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v: number) => [`${v} TJS`, `${currency}/TJS`]} />
                      <Line type="monotone" dataKey="value" stroke="#1B8A4C" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>


          </div>

          {/* Шаг 2 — Параметры симуляции */}
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Шаг 2 — Параметры симуляции
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className={lbl}>
                  μ (Mean) {nbtStats ? '— из данных' : '— загрузите данные'}
                </label>
                <input type="text" value={mean} onChange={e => setMean(e.target.value)}
                  placeholder="0.00" className={`${inp} ${nbtStats ? 'bg-green-50 border-green-200' : ''}`} />
              </div>
              <div>
                <label className={lbl}>
                  σ (StdDev) {nbtStats ? '— из данных' : '— загрузите данные'}
                </label>
                <input type="text" value={stdDev} onChange={e => setStdDev(e.target.value)}
                  placeholder="6.40" className={`${inp} ${nbtStats ? 'bg-green-50 border-green-200' : ''}`} />
              </div>
              <div>
                <label className={lbl}>Горизонт прогноза</label>
                <select value={horizon} onChange={e => setHorizon(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                  {HORIZONS.map(h => <option key={h.days} value={h.days}>{h.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Количество итераций</label>
                <select value={iters} onChange={e => setIters(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                  {[1000, 5000, 10000, 50000].map(n => <option key={n} value={n}>{n.toLocaleString('ru-RU')}</option>)}
                </select>
              </div>
              <button onClick={runSim} disabled={running || !mean || !stdDev}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {running
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Считаем...</>
                  : <>▶ Монте Карло ({iters.toLocaleString('ru-RU')})</>}
              </button>
            </div>
            {mean && stdDev && (
              <p className="mt-2 text-xs text-gray-500">
                Симуляция N(μ={mean}%, σ={stdDev}%) · {iters.toLocaleString('ru-RU')} сценариев
              </p>
            )}
          </div>

          {/* Результаты */}
          {mcResult && (
            <>
              {/* VaR три метода */}
              <div className={card}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">📊 Value at Risk (VaR) · {HORIZONS.find(h => h.days === horizon)?.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Мат. ожидание: <span className={mcResult.expected > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{mcResult.expected > 0 ? '+' : ''}{mcResult.expected}%</span> · Медиана: {mcResult.median > 0 ? '+' : ''}{mcResult.median}%</p>
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Основной показатель для отчёта</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-white text-xs">
                        <th className="px-4 py-2.5 text-left">Метод</th>
                        <th className="px-4 py-2.5 text-center">95% уровень</th>
                        <th className="px-4 py-2.5 text-center">99% уровень</th>
                        <th className="px-4 py-2.5 text-left text-gray-300 font-normal">Что означает</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td className="px-4 py-2 text-[10px] text-gray-400 italic">Метод расчёта</td>
                        <td className="px-4 py-2 text-[10px] text-gray-400 text-center italic">Макс. потеря в 95 из 100 сценариев</td>
                        <td className="px-4 py-2 text-[10px] text-gray-400 text-center italic">Макс. потеря в 99 из 100 сценариев</td>
                        <td className="px-4 py-2 text-[10px] text-gray-400 italic">Применение</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm">📐 Параметрический VaR</p>
                          <p className="text-[10px] text-gray-400">Нормальное распределение N(μ,σ)</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{mcResult.paramVar95 > 0 ? '-' : '+'}{Math.abs(mcResult.paramVar95)}%</td>
                        <td className="px-4 py-3 text-center font-bold text-red-700">{mcResult.paramVar99 > 0 ? '-' : '+'}{Math.abs(mcResult.paramVar99)}%</td>
                        <td className="px-4 py-3 text-xs text-gray-500">Аналитическая формула. Быстро, но недооценивает хвосты</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm">📈 Исторический VaR</p>
                          <p className="text-[10px] text-gray-400">Из симуляций Монте Карло</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{mcResult.histVar95 > 0 ? '-' : '+'}{Math.abs(mcResult.histVar95)}%</td>
                        <td className="px-4 py-3 text-center font-bold text-red-700">{mcResult.histVar99 > 0 ? '-' : '+'}{Math.abs(mcResult.histVar99)}%</td>
                        <td className="px-4 py-3 text-xs text-gray-500">Перцентиль симуляций. В 95% сценариев потеря меньше этого</td>
                      </tr>
                      <tr className="bg-orange-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm">⚠️ CVaR / Expected Shortfall</p>
                          <p className="text-[10px] text-gray-400">Basel III · FRTB · Рекомендован IMF</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600">{mcResult.cvar95 > 0 ? '-' : '+'}{Math.abs(mcResult.cvar95)}%</td>
                        <td className="px-4 py-3 text-center font-bold text-orange-700">{mcResult.cvar99 > 0 ? '-' : '+'}{Math.abs(mcResult.cvar99)}%</td>
                        <td className="px-4 py-3 text-xs text-gray-500">Средняя потеря в худших сценариях за порогом VaR. Наиболее точный</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <strong>💡 Таблицы ниже — вероятности превышения порога.</strong> Пример: "Вероятность &gt;5% = 87%" →
                  в 87 из 100 сценариев курс изменится более чем на 5% за {HORIZONS.find(h => h.days === horizon)?.label?.toLowerCase()}.
                  CVaR всегда ≥ VaR — это нормально, он показывает глубину потерь в хвосте.
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={card}>
                  <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" /> Вероятность девальвации TJS · {HORIZONS.find(h => h.days === horizon)?.label || `${horizon} дн.`}
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">Сколько симуляций показало ослабление TJS сильнее порога. Строки независимы — не складываются в 100%.</p>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500">#</th><th className="px-3 py-2 text-left text-xs text-gray-500">Порог</th><th className="px-3 py-2 text-right text-xs text-gray-500">Вероятность</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {mcResult.probs.filter(p => p.type === 'deval').map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">Вероятность {p.label}</td>
                          <td className="px-3 py-2 text-right font-bold text-sm">
                            <span className={p.pct > 30 ? 'text-red-600' : p.pct > 10 ? 'text-yellow-600' : 'text-green-600'}>
                              {p.pct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={card}>
                  <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" /> Вероятность укрепления TJS · {HORIZONS.find(h => h.days === horizon)?.label || `${horizon} дн.`}
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">Сколько симуляций показало укрепление TJS сильнее порога. Строки независимы — не складываются в 100%.</p>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500">#</th><th className="px-3 py-2 text-left text-xs text-gray-500">Порог</th><th className="px-3 py-2 text-right text-xs text-gray-500">Вероятность</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {mcResult.probs.filter(p => p.type === 'apprec').map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">Вероятность {p.label}</td>
                          <td className="px-3 py-2 text-right font-bold text-sm">
                            <span className={p.pct > 30 ? 'text-green-600' : p.pct > 10 ? 'text-yellow-600' : 'text-red-600'}>
                              {p.pct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={card}>
                <p className="text-sm font-semibold text-gray-700 mb-1">📊 Распределение симуляций</p>
                <p className="text-[11px] text-gray-500 mb-3">
                  Каждый столбец = доля симуляций с данным изменением курса TJS/USD за выбранный горизонт.
                  Ось X — изменение курса в %, ось Y — доля симуляций (%). Левая зона (отрицательные %) = TJS укрепился, правая = ослабел.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-green-600 font-medium mb-0.5">🟢 Укрепление TJS</p>
                    <p className="text-3xl font-bold text-green-600">{mcResult.appreciationPct}%</p>
                    <p className="text-[10px] text-green-500 mt-0.5">симуляций показали укрепление</p>
                    <p className="text-[10px] text-gray-400 mt-1">Изменение курса &lt; 0% (TJS/USD ↓)</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-red-600 font-medium mb-0.5">🔴 Ослабление TJS</p>
                    <p className="text-3xl font-bold text-red-600">{mcResult.depreciationPct}%</p>
                    <p className="text-[10px] text-red-500 mt-0.5">симуляций показали ослабление</p>
                    <p className="text-[10px] text-gray-400 mt-1">Изменение курса &gt; 0% (TJS/USD ↑)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-2 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-400 rounded inline-block"/> TJS укрепился (столбцы слева от 0)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-400 rounded inline-block"/> TJS ослабел (столбцы справа от 0)</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mcResult.hist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="x" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip
                      formatter={(v: number, _name: string, props: {payload?: {x?: string}}) => {
                        const xVal = parseFloat(props?.payload?.x ?? '0')
                        return [`${v}% симуляций`, xVal < 0 ? '🟢 Укрепление TJS' : '🔴 Ослабление TJS']
                      }}
                    />
                    <Bar dataKey="pct" radius={[2, 2, 0, 0]} name="% симуляций">
                      {mcResult.hist.map((entry, index) => (
                        <Cell key={index} fill={parseFloat(entry.x) < 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {!mcResult && (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">
  '① Выберите валюту и период → нажмите Загрузить → ② нажмите Монте Карло'
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          МОДЕЛЬ 2 — МАКРОЭКОНОМИКА
      ════════════════════════════════════ */}
      {model === 2 && (
        <div className="space-y-5">
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Входные данные</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { l: 'ВВП базовый (сомони)',       v: gdpBase,    s: setGdpBase,    p: '173 000 000 000', fmt: true  },
                { l: 'Доля Алиф в переводах (%)',  v: alifShare,  s: setAlifShare,  p: '15.04',           fmt: false },
                { l: 'Маржа доходности (%)',        v: margin,     s: setMargin,     p: '1.67',             fmt: false },
                { l: 'Базовый доход (сомони)',      v: baseIncome, s: setBaseIncome, p: '83 597 906',       fmt: true  },
              ].map(f => (
                <div key={f.l}>
                  <label className={lbl}>{f.l}</label>
                  <input type="text" value={f.v}
                    onChange={e => f.s(f.fmt ? fmtN(e.target.value) : e.target.value)}
                    placeholder={f.p} className={inp} />
                </div>
              ))}
            </div>
            {gdp0 > 0 && (
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: 'ВВП (оптимистичный)', v: fmtNum(gdp0 * (1 + optGrowth / 100)) + ' TJS' },
                  { l: 'Переводы в РТ',        v: fmtNum(gdp0 * (1 + optGrowth / 100) * optRemit / 100) + ' TJS' },
                  { l: 'Переводы Алиф',        v: fmtNum(gdp0 * (1 + optGrowth / 100) * optRemit / 100 * aShare / 100) + ' TJS' },
                  { l: 'Доход (оптимистичный)', v: fmtNum(calcIncome(optGrowth, optRemit)) + ' TJS' },
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Сценарии — выбор параметров</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([
                { name: '📈 Оптимистичный',    growth: optGrowth,  setGrowth: setOptGrowth,  remit: optRemit,   setRemit: setOptRemit,  border: 'border-green-300',  bg: 'bg-green-50',  text: 'text-green-700'  },
                { name: '📉 Пессимистичный',   growth: pessGrowth, setGrowth: setPessGrowth, remit: pessRemit,  setRemit: setPessRemit, border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700' },
                { name: '⚠️ Катастрофический', growth: catGrowth,  setGrowth: setCatGrowth,  remit: catRemit,   setRemit: setCatRemit,  border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-700'    },
              ] as const).map(sc => {
                const inc = calcIncome(sc.growth, sc.remit)
                const eff = inc - biVal
                return (
                  <div key={sc.name} className={`rounded-xl border-2 p-4 ${sc.border} ${sc.bg}`}>
                    <p className={`text-sm font-bold mb-3 ${sc.text}`}>{sc.name}</p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Экономический рост (%)</label>
                        <select value={sc.growth} onChange={e => sc.setGrowth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                          {GROWTH_ROWS.map(g => <option key={g} value={g}>{g > 0 ? `+${g}` : g}%</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Денежные переводы (%)</label>
                        <select value={sc.remit} onChange={e => sc.setRemit(Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                          {REMIT_COLS.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Ожид. доход:</span>
                        <span className={`font-bold ${sc.text}`}>{fmtNum(inc)} сом.</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Эффект на П&У:</span>
                        <span className={`font-bold ${eff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {eff >= 0 ? '+' : '−'}{fmtNum(Math.abs(eff))}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* What-If матрица */}
          <div className={card}>
            <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица</p>
            <p className="text-xs text-gray-500 mb-4">Ожидаемый доход Алиф от переводов (сомони) · базовый доход: {fmtNum(biVal)} · флаги на пересечении выбранных сценариев</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap sticky left-0">
                      Рост ВВП ↓ / Переводы →
                    </th>
                    {REMIT_COLS.map(c => {
                      const scFlags = [
                        optRemit  === c ? '📈' : '',
                        pessRemit === c ? '📉' : '',
                        catRemit  === c ? '⚠️' : '',
                      ].filter(Boolean)
                      return (
                        <th key={c} className={`px-3 py-2 text-center whitespace-nowrap text-white ${scFlags.length > 0 ? 'bg-[#1B8A4C]' : 'bg-gray-800'}`}>
                          {c}%
                          {scFlags.length > 0 && <span className="block text-[9px] leading-tight">{scFlags.join('')}</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {GROWTH_ROWS.map((g, gi) => {
                    const isOpt  = g === optGrowth
                    const isPess = g === pessGrowth
                    const isCat  = g === catGrowth
                    const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isOpt ? 'bg-green-50' : gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    const rowFlags = [
                      isOpt  ? '📈' : '',
                      isPess ? '📉' : '',
                      isCat  ? '⚠️' : '',
                    ].filter(Boolean)
                    return (
                      <tr key={g} className={rowBg}>
                        <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                          {g > 0 ? '+' : ''}{g}%
                          {rowFlags.length > 0 && <span className="ml-1 text-[10px]">{rowFlags.join('')}</span>}
                        </td>
                        {REMIT_COLS.map(r => {
                          const inc = calcIncome(g, r)
                          const eff = inc - biVal
                          const isOptCell  = g === optGrowth  && r === optRemit
                          const isPessCell = g === pessGrowth && r === pessRemit
                          const isCatCell  = g === catGrowth  && r === catRemit
                          const cellFlags  = [
                            isOptCell  ? '📈' : '',
                            isPessCell ? '📉' : '',
                            isCatCell  ? '⚠️' : '',
                          ].filter(Boolean)
                          const isScCell = cellFlags.length > 0
                          return (
                            <td key={r} className={`px-2 py-1.5 text-center whitespace-nowrap
                              ${isScCell ? 'font-bold ring-2 ring-inset ring-[#1B8A4C] bg-[#1B8A4C]/10 text-gray-900' :
                                eff < 0 ? 'font-medium text-red-700 bg-red-100' :
                                eff < biVal * 0.1 ? 'font-medium text-yellow-700' : 'font-medium text-green-700'}`}>
                              {isScCell && <span className="block text-[10px] leading-none mb-0.5">{cellFlags.join('')}</span>}
                              {fmtNum(inc)}
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
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 ring-2 ring-[#1B8A4C] rounded bg-[#1B8A4C]/10"/> Точка сценария</span>
              <span className="flex items-center gap-1.5">📈 Оптимистичный</span>
              <span className="flex items-center gap-1.5">📉 Пессимистичный</span>
              <span className="flex items-center gap-1.5">⚠️ Катастрофический</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded"/> Ниже базового</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

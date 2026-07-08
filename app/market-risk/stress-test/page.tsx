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

const MONTH_LABELS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const OFP_PERIOD_IDX: Record<string, number[]> = {
  Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11],
  H1: [0,1,2,3,4,5], H2: [6,7,8,9,10,11],
}

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

  // Model 2 — manual inputs
  const [gdpBase,        setGdpBase]        = useState('')
  const [gdpGrowthFcst,  setGdpGrowthFcst]  = useState('')
  const [remitShareFcst, setRemitShareFcst] = useState('')
  const [alifBudgetVol,  setAlifBudgetVol]  = useState('')
  const [actualVolH1,    setActualVolH1]    = useState('')
  const [actualIncomeH1, setActualIncomeH1] = useState('')

  // Model 2 — scenario selectors (Pessimistic and Catastrophic)
  const [pessGrowth, setPessGrowth] = useState<number>(1)
  const [pessRemit,  setPessRemit]  = useState<number>(25)
  const [catGrowth,  setCatGrowth]  = useState<number>(-3)
  const [catRemit,   setCatRemit]   = useState<number>(10)

  // OFP — открытая валютная позиция
  const [ofpPeriod,       setOfpPeriod]       = useState<'Q1'|'Q2'|'Q3'|'Q4'|'H1'|'H2'|'custom'>('H1')
  const [ofpMonths,       setOfpMonths]       = useState(3)
  const [posLimitPct,     setPosLimitPct]     = useState('8')
  const [regulCapMonthly, setRegulCapMonthly] = useState<string[]>(Array(12).fill(''))
  const [spotFxMonthly,   setSpotFxMonthly]   = useState<string[]>(Array(12).fill(''))
  const updArr = (arr: string[], idx: number, val: string): string[] => { const copy = [...arr]; copy[idx] = val; return copy }
  const ofpMonthIdxs = ofpPeriod === 'custom'
    ? Array.from({length: ofpMonths}, (_, i) => i)
    : (OFP_PERIOD_IDX[ofpPeriod] ?? [0,1,2,3,4,5])

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
  const gdp0        = parseFloat(gdpBase.replace(/\D/g, ''))        || 0
  const gdpGrowthP  = parseFloat(gdpGrowthFcst)                     || 0
  const remitShareP = parseFloat(remitShareFcst)                    || 0
  const alifBudget  = parseFloat(alifBudgetVol.replace(/\D/g, ''))  || 0
  const actVolH1n   = parseFloat(actualVolH1.replace(/\D/g, ''))    || 0
  const actIncH1n   = parseFloat(actualIncomeH1.replace(/\D/g, '')) || 0

  // Computed (auto)
  const expectedGdp     = gdp0 > 0 ? gdp0 * (1 + gdpGrowthP / 100) : 0
  const forecastRemitRT = expectedGdp * (remitShareP / 100)
  const alifSharePct    = forecastRemitRT > 0 ? (alifBudget / forecastRemitRT) * 100 : 0
  const marginPct       = actVolH1n > 0 ? (actIncH1n / actVolH1n) * 100 : 0
  const baseIncomeH2    = (forecastRemitRT > 0 && alifSharePct > 0 && marginPct > 0)
    ? (forecastRemitRT * (alifSharePct / 100) / 2) * (marginPct / 100)
    : 0

  // Matrix: H2 income for scenario (growth%, remitShare%)
  const calcIncomeH2 = (g: number, r: number) => {
    const volRT   = gdp0 * (1 + g / 100) * (r / 100)
    const volAlif = volRT * (alifSharePct / 100)
    return (volAlif / 2) * (marginPct / 100)
  }

  // ── Сохранить в реестр ───────────────────────────────────────────────────────
  async function saveToRegistry() {
    setSaving(true)

    const h      = HORIZONS.find(hh => hh.days === horizon)?.label || `${horizon} дн.`
    const posLim = parseFloat(posLimitPct) || 0

    // ── Блок 1: FX-эффект (открытая валютная позиция) ──
    const buildFxScenario = (cvarPct: number) => {
      const N            = ofpMonthIdxs.length || 1
      const cvarPerMonth = cvarPct / N
      let totalShort = 0, totalLong = 0
      const rows = ofpMonthIdxs.map(mi => {
        const rc      = parseFloat(regulCapMonthly[mi].replace(/\D/g, '')) || 0
        const openPos = rc * posLim / 100
        const sPnL    = -(openPos * cvarPerMonth / 100)
        const lPnL    =  (openPos * cvarPerMonth / 100)
        totalShort   += sPnL
        totalLong    += lPnL
        return { month: MONTH_LABELS[mi], reg_cap: rc, open_pos: openPos, fx_shock_pct: +cvarPerMonth.toFixed(4), pnl_short: +sPnL.toFixed(2), pnl_long: +lPnL.toFixed(2) }
      })
      return { cvar_pct: cvarPct, total_short: +totalShort.toFixed(2), total_long: +totalLong.toFixed(2), rows }
    }
    const hasFx = mcResult != null && posLim > 0 && ofpMonthIdxs.some(mi => (parseFloat(regulCapMonthly[mi].replace(/\D/g, '')) || 0) > 0)
    const fxEffect = hasFx ? {
      period:        ofpPeriod === 'custom' ? `${ofpMonths} мес.` : ofpPeriod,
      pos_limit_pct: posLim,
      pessimistic:   buildFxScenario(mcResult!.cvar95),
      catastrophic:  buildFxScenario(mcResult!.cvar99),
    } : null

    // ── Блок 2: Monte Carlo ──
    const monteCarloData = mcResult ? {
      currency,
      mean:             +mean,
      std_dev:          +stdDev,
      horizon_days:     horizon,
      var95_hist:       mcResult.histVar95,
      var99_hist:       mcResult.histVar99,
      var95_param:      mcResult.paramVar95,
      var99_param:      mcResult.paramVar99,
      cvar95:           mcResult.cvar95,
      cvar99:           mcResult.cvar99,
      expected:         mcResult.expected,
      median:           mcResult.median,
      appreciation_pct: mcResult.appreciationPct,
      depreciation_pct: mcResult.depreciationPct,
    } : null

    // ── Блок 3: Model 2 (каскадная модель переводов) ──
    const hasModel2 = gdp0 > 0 || alifBudget > 0 || actVolH1n > 0
    const model2Data = hasModel2 ? {
      gdp_base:              gdp0,
      gdp_growth_pct:        gdpGrowthP,
      remit_share_pct:       remitShareP,
      bank_budget:           alifBudget,
      bank_share_pct:        +alifSharePct.toFixed(4),
      margin_pct:            +marginPct.toFixed(4),
      expected_gdp:          Math.round(expectedGdp),
      forecast_remit_rt:     Math.round(forecastRemitRT),
      forecast_income_h2:    Math.round(baseIncomeH2),
      actual_vol_h1:         actVolH1n,
      actual_income_h1:      actIncH1n,
      scenario_pessimistic:  {
        gdp_growth_pct:  pessGrowth,
        remit_share_pct: pessRemit,
        forecast_income: Math.round(calcIncomeH2(pessGrowth, pessRemit)),
        delta:           Math.round(calcIncomeH2(pessGrowth, pessRemit) - baseIncomeH2),
      },
      scenario_catastrophic: {
        gdp_growth_pct:  catGrowth,
        remit_share_pct: catRemit,
        forecast_income: Math.round(calcIncomeH2(catGrowth, catRemit)),
        delta:           Math.round(calcIncomeH2(catGrowth, catRemit) - baseIncomeH2),
      },
    } : null

    // ── Заключение (приоритет: FX → MC) ──
    const parts: string[] = []
    if (fxEffect) {
      const p = fxEffect.pessimistic
      const c = fxEffect.catastrophic
      parts.push(
        `FX-эффект (${fxEffect.period}, ОВП лимит ${fxEffect.pos_limit_pct}%): ` +
        `Пессимистичный CVaR95=${p.cvar_pct}%: SHORT −${fmtNum(Math.abs(p.total_short))} / LONG +${fmtNum(p.total_long)} TJS. ` +
        `Катастрофический CVaR99=${c.cvar_pct}%: SHORT −${fmtNum(Math.abs(c.total_short))} / LONG +${fmtNum(c.total_long)} TJS.`
      )
    }
    if (monteCarloData) {
      parts.push(
        `Монте Карло (${currency}/TJS, горизонт ${h}): μ=${mean}%, σ=${stdDev}%. ` +
        `VaR95: ${mcResult!.histVar95}%, VaR99: ${mcResult!.histVar99}%. ` +
        `CVaR95: ${mcResult!.cvar95}%, CVaR99: ${mcResult!.cvar99}%.`
      )
    }
    if (!parts.length) parts.push('Данные не введены.')

    const { error } = await supabase.from('stress_test_registry').insert({
      risk_type:    'Рыночный риск',
      analyst_name: analystName,
      period:       `${dateFrom} — ${dateTo}`,
      inputs: {
        currency:  currency || null,
        date_from: dateFrom || null,
        date_to:   dateTo   || null,
      },
      results: {
        fx_effect:   fxEffect,
        monte_carlo: monteCarloData,
        model2:      model2Data,
      },
      conclusion: parts.join('\n'),
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
      rows.push(['МАКРОЭКОНОМИКА — Денежные переводы (прогноз)'])
      rows.push(['ВВП базовый (TJS)', String(gdp0)])
      rows.push(['Прогноз роста ВВП', `${gdpGrowthP}%`])
      rows.push(['Прогноз доля переводов в ВВП', `${remitShareP}%`])
      rows.push(['Ожидаемый объём переводов Банка (TJS)', String(alifBudget)])
      rows.push(['Факт. объём переводов за отчётный период (TJS)', String(actVolH1n)])
      rows.push(['Факт. доход от переводов за отчётный период (TJS)', String(actIncH1n)])
      rows.push([])
      rows.push(['Ожидаемый ВВП (TJS)', String(Math.round(expectedGdp))])
      rows.push(['Прогноз переводов в РТ (TJS)', String(Math.round(forecastRemitRT))])
      rows.push(['Доля Банка % (авт.)', `${alifSharePct.toFixed(2)}%`])
      rows.push(['Маржа доходности % (авт.)', `${marginPct.toFixed(4)}%`])
      rows.push(['Прогнозный доход за оставшийся период (TJS)', String(Math.round(baseIncomeH2))])
      rows.push([])
      rows.push(['Сценарий', 'Рост ВВП', 'Доля в ВВП', 'Прогнозный доход (TJS)', 'Эффект FX/Dealing Net (TJS)'])
      rows.push(['Пессимистичный',   `${pessGrowth}%`, `${pessRemit}%`, String(Math.round(calcIncomeH2(pessGrowth, pessRemit))), String(Math.round(calcIncomeH2(pessGrowth, pessRemit) - baseIncomeH2))])
      rows.push(['Катастрофический', `${catGrowth}%`,  `${catRemit}%`,  String(Math.round(calcIncomeH2(catGrowth,  catRemit))),  String(Math.round(calcIncomeH2(catGrowth,  catRemit)  - baseIncomeH2))])
      rows.push([])
      rows.push(['МАТРИЦА (доход H2): Рост ВВП ↓ / Доля перевода в ВВП →', ...REMIT_COLS.map(c => `${c}%`)])
      GROWTH_ROWS.forEach(g => rows.push([`${g}%`, ...REMIT_COLS.map(r => String(Math.round(calcIncomeH2(g, r))))]))
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

              {/* ── Эффект на прибыль через открытую валютную позицию ── */}
              <div className={card}>

                {/* ═══ Sticky config header ═══ */}
                <div className="sticky top-0 z-20 bg-white -mx-5 -mt-5 px-5 pt-5 pb-4 border-b border-gray-100 mb-5 rounded-t-xl">
                  <p className="text-base font-semibold text-gray-900 mb-0.5">💹 Эффект на прибыль через открытую валютную позицию</p>
                  <p className="text-xs text-gray-500 mb-3">
                    CVaR из Монте Карло · пессимистичный: <span className="font-semibold text-yellow-700">CVaR95 = {mcResult.cvar95}%</span> · катастрофический: <span className="font-semibold text-red-700">CVaR99 = {mcResult.cvar99}%</span> · валюта симуляции: <span className="font-semibold text-gray-800">{currency}/TJS</span>
                  </p>

                  {/* Выбор периода */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 mr-1">Период:</span>
                    {(['Q1','Q2','Q3','Q4','H1','H2','custom'] as const).map(p => (
                      <button key={p} onClick={() => setOfpPeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${ofpPeriod === p
                            ? 'bg-[#1B8A4C] text-white border-[#1B8A4C] shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B8A4C] hover:text-[#1B8A4C]'}`}>
                        {p === 'custom' ? 'Произвольный' : p}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-end gap-4">
                    {ofpPeriod === 'custom' && (
                      <div>
                        <label className={lbl}>Количество месяцев</label>
                        <select value={ofpMonths} onChange={e => setOfpMonths(Number(e.target.value))}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} мес.</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className={lbl}>Лимит открытой позиции (±%, дефолт 8)</label>
                      <input type="text" value={posLimitPct}
                        onChange={e => setPosLimitPct(e.target.value.replace(/[^0-9.]/g,''))}
                        placeholder="8"
                        className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                    </div>
                  </div>
                </div>

                {/* Помесячные входные данные */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Помесячные входные данные · {ofpPeriod === 'custom' ? `${ofpMonths} мес.` : ofpPeriod}
                </p>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="px-3 py-2 text-left sticky left-0 bg-gray-800">Месяц</th>
                        <th className="px-3 py-2 text-right">Рег. капитал банка (TJS)</th>
                        <th className="px-3 py-2 text-right">Прогнозный курс {currency}/TJS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ofpMonthIdxs.map((mi, rowIdx) => {
                        const dailyDrift = parseFloat(mean)
                        const forecastRate = (nbtStats && !isNaN(dailyDrift))
                          ? nbtStats.current * Math.pow(1 + dailyDrift / 100, (rowIdx + 1) * 30)
                          : null
                        return (
                          <tr key={mi} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-1 font-semibold text-gray-700 sticky left-0 bg-inherit">{MONTH_LABELS[mi]}</td>
                            <td className="px-1.5 py-1">
                              <input type="text" value={regulCapMonthly[mi]}
                                onChange={e => setRegulCapMonthly(updArr(regulCapMonthly, mi, fmtN(e.target.value)))}
                                placeholder="0"
                                className="w-full px-2 py-1 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                            </td>
                            <td className="px-3 py-1 text-right font-mono text-gray-700">
                              {forecastRate !== null ? forecastRate.toFixed(4) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Сценарные таблицы */}
                <div className="space-y-5">
                  {[
                    { label: 'Сценарий 1 — Пессимистичный',   cvarPct: mcResult.cvar95, hdrBg: 'bg-yellow-600', border: 'border-yellow-200', tag: 'CVaR95' },
                    { label: 'Сценарий 2 — Катастрофический', cvarPct: mcResult.cvar99, hdrBg: 'bg-red-700',    border: 'border-red-200',    tag: 'CVaR99' },
                  ].map(sc => {
                    const posLim = parseFloat(posLimitPct) || 0
                    const N = ofpMonthIdxs.length || 1
                    const cvarPerMonth = sc.cvarPct / N
                    let totalShort = 0, totalLong = 0
                    const rows = ofpMonthIdxs.map(mi => {
                      const rc      = parseFloat(regulCapMonthly[mi].replace(/\D/g,'')) || 0
                      const openPos = rc * posLim / 100
                      const sPnL    = -(openPos * cvarPerMonth / 100)
                      const lPnL    =  (openPos * cvarPerMonth / 100)
                      totalShort   += sPnL
                      totalLong    += lPnL
                      return { mi, rc, openPos, sPnL, lPnL }
                    })
                    const hasData     = rows.some(r => r.openPos > 0)
                    const periodLabel = ofpPeriod === 'custom' ? `${ofpMonths} мес.` : ofpPeriod
                    return (
                      <div key={sc.label} className={`rounded-xl border ${sc.border} overflow-hidden`}>
                        <div className={`${sc.hdrBg} text-white px-4 py-2.5 flex items-center justify-between`}>
                          <p className="text-sm font-bold">{sc.label}</p>
                          <p className="text-xs opacity-90">{sc.tag} = ±{sc.cvarPct}% за горизонт · {currency}/TJS · {periodLabel}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-100 text-gray-600 text-[11px]">
                                <th className="px-3 py-2 text-left sticky left-0 bg-gray-100">Месяц</th>
                                <th className="px-3 py-2 text-right">Рег. капитал (TJS)</th>
                                <th className="px-3 py-2 text-right">Откр. позиция (TJS)</th>
                                <th className="px-3 py-2 text-right">FX шок ({sc.tag}) %</th>
                                <th className="px-3 py-2 text-right">P&amp;L если SHORT (TJS)</th>
                                <th className="px-3 py-2 text-right">P&amp;L если LONG (TJS)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {rows.map((row, rowIdx) => (
                                <tr key={row.mi} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-3 py-1.5 font-semibold text-gray-700 sticky left-0 bg-inherit">{MONTH_LABELS[row.mi]}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600">{row.rc > 0 ? fmtNum(row.rc) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right font-medium text-gray-800">{row.openPos > 0 ? fmtNum(row.openPos) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-500">{cvarPerMonth.toFixed(2)}%</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-red-600">{row.openPos > 0 ? `−${fmtNum(Math.abs(row.sPnL))}` : '—'}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-green-600">{row.openPos > 0 ? `+${fmtNum(row.lPnL)}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-800 text-white font-bold text-[11px]">
                                <td className="px-3 py-2.5 sticky left-0 bg-gray-800" colSpan={4}>
                                  Total Effect — {hasData ? periodLabel : 'введите регулятивный капитал'}
                                </td>
                                <td className="px-3 py-2.5 text-right text-red-300">{hasData ? `−${fmtNum(Math.abs(totalShort))}` : '—'}</td>
                                <td className="px-3 py-2.5 text-right text-green-300">{hasData ? `+${fmtNum(totalLong)}` : '—'}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 text-[10px] text-gray-400 leading-relaxed">
                  Открытая позиция = Рег. капитал × Лимит%. CVaR — кумулятивный шок за весь горизонт, распределён равномерно по месяцам (CVaR / N мес.) так что сумма Total Effect = Позиция × CVaR один раз. P&amp;L SHORT — убыток при девальвации TJS (короткая позиция). P&amp;L LONG — прибыль при длинной позиции. CVaR точнее VaR — учитывает среднее по хвосту.
                </p>
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

          {/* ═══ Sticky: Входные данные + Вычисленные показатели ═══ */}
          <div className="sticky top-0 z-20 space-y-3 bg-[#F5F8F6] pb-2 shadow-[0_4px_8px_-2px_rgba(0,0,0,0.08)]">

            {/* Входные данные */}
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Входные данные (вводит аналитик)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  { l: 'ВВП базового периода (TJS)',                        v: gdpBase,        s: setGdpBase,        p: 'напр. 173 000 000 000', fmt: true  },
                  { l: 'Прогноз роста ВВП (%)',                             v: gdpGrowthFcst,  s: setGdpGrowthFcst,  p: 'напр. 7',               fmt: false },
                  { l: 'Прогноз доля переводов в ВВП (%)',                  v: remitShareFcst, s: setRemitShareFcst, p: 'напр. 45',              fmt: false },
                  { l: 'Ожидаемый объём денежных переводов Банка на год (TJS)', v: alifBudgetVol,  s: setAlifBudgetVol,  p: 'напр. 10 000 000 000',  fmt: true  },
                  { l: 'Факт. объём переводов за отчётный период (TJS)',    v: actualVolH1,    s: setActualVolH1,    p: 'напр. 5 000 000 000',   fmt: true  },
                  { l: 'Факт. доход от переводов за отчётный период (TJS)', v: actualIncomeH1, s: setActualIncomeH1, p: 'напр. 81 000 000',      fmt: true  },
                ] as { l: string; v: string; s: (v: string) => void; p: string; fmt: boolean }[]).map(f => (
                  <div key={f.l}>
                    <label className={lbl}>{f.l}</label>
                    <input type="text" value={f.v}
                      onChange={e => f.s(f.fmt ? fmtN(e.target.value) : e.target.value)}
                      placeholder={f.p} className={inp} />
                  </div>
                ))}
              </div>
            </div>

            {/* Вычисленные показатели */}
            {(gdp0 > 0 || alifBudget > 0) && (
              <div className={card}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Вычисленные показатели (автоматически)</p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { l: 'Ожидаемый ВВП',                 v: expectedGdp > 0     ? fmtNum(expectedGdp)     + ' TJS' : '—', c: 'text-gray-800'  },
                    { l: 'Прогноз переводов в РТ',         v: forecastRemitRT > 0 ? fmtNum(forecastRemitRT) + ' TJS' : '—', c: 'text-gray-800'  },
                    { l: 'Доля Банка % (авт.)',             v: alifSharePct > 0    ? alifSharePct.toFixed(2) + '%'    : '—', c: 'text-blue-700'  },
                    { l: 'Маржа доходности % (авт.)',      v: marginPct > 0       ? marginPct.toFixed(4)    + '%'    : '—', c: 'text-blue-700'  },
                    { l: 'Прогнозный доход (ост. период)', v: baseIncomeH2 > 0    ? fmtNum(baseIncomeH2)    + ' TJS' : '—', c: 'text-green-700' },
                  ].map(s => (
                    <div key={s.l} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 leading-tight mb-1">{s.l}</p>
                      <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Сценарии */}
          <div className={card}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Сценарии — выбор параметров</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Базовый прогноз — read-only */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-700 mb-3">📊 Базовый прогноз</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Рост ВВП:</span>
                    <span className="font-semibold text-gray-800">{gdpGrowthP > 0 ? `+${gdpGrowthP}` : gdpGrowthP}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Доля переводов в ВВП:</span>
                    <span className="font-semibold text-gray-800">{remitShareP}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Доля Банка (авт.):</span>
                    <span className="font-semibold text-gray-800">{alifSharePct > 0 ? alifSharePct.toFixed(2) + '%' : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Маржа (авт.):</span>
                    <span className="font-semibold text-gray-800">{marginPct > 0 ? marginPct.toFixed(4) + '%' : '—'}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Прогнозный доход:</span>
                    <span className="font-bold text-blue-700">{baseIncomeH2 > 0 ? fmtNum(baseIncomeH2) + ' сом.' : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Пессимистичный и Катастрофический */}
              {([
                { name: '📉 Пессимистичный',   growth: pessGrowth, setGrowth: setPessGrowth, remit: pessRemit, setRemit: setPessRemit, border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700', sep: 'border-yellow-200' },
                { name: '⚠️ Катастрофический', growth: catGrowth,  setGrowth: setCatGrowth,  remit: catRemit,  setRemit: setCatRemit,  border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-700',    sep: 'border-red-200'    },
              ] as const).map(sc => {
                const inc = calcIncomeH2(sc.growth, sc.remit)
                const eff = inc - baseIncomeH2
                const hasData = alifSharePct > 0 && marginPct > 0
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
                        <label className="block text-[11px] text-gray-500 mb-1">Доля перевода в ВВП (%)</label>
                        <select value={sc.remit} onChange={e => sc.setRemit(Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
                          {REMIT_COLS.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={`mt-3 pt-3 border-t ${sc.sep} space-y-1.5`}>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Прогнозный доход:</span>
                        <span className={`font-bold ${sc.text}`}>{hasData ? fmtNum(inc) + ' сом.' : '—'}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 leading-snug">
                        Эффект на чистую прибыль по части операций в иностранной валюте (FX/Dealing Net):
                      </div>
                      <div className="flex justify-end text-xs">
                        <span className={`font-bold ${eff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {hasData ? (eff >= 0 ? '+' : '−') + fmtNum(Math.abs(eff)) + ' сом.' : '—'}
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
            <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица — Прогнозный доход Банка (сомони)</p>
            <p className="text-xs text-gray-500 mb-4">
              Доля Банка: {alifSharePct > 0 ? alifSharePct.toFixed(2) + '%' : '—'} (авт.) · Маржа: {marginPct > 0 ? marginPct.toFixed(4) + '%' : '—'} (авт.) · Прогнозный доход: {baseIncomeH2 > 0 ? fmtNum(baseIncomeH2) + ' TJS' : '—'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap sticky left-0">
                      Рост ВВП ↓ / Доля перевода в ВВП →
                    </th>
                    {REMIT_COLS.map(c => {
                      const scFlags = [
                        remitShareP === c ? '📊' : '',
                        pessRemit   === c ? '📉' : '',
                        catRemit    === c ? '⚠️' : '',
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
                    const isBase = g === gdpGrowthP
                    const isPess = g === pessGrowth
                    const isCat  = g === catGrowth
                    const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isBase ? 'bg-blue-50' : gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    const rowFlags = [
                      isBase ? '📊' : '',
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
                          const inc = calcIncomeH2(g, r)
                          const eff = inc - baseIncomeH2
                          const isBaseCell = g === gdpGrowthP && r === remitShareP
                          const isPessCell = g === pessGrowth  && r === pessRemit
                          const isCatCell  = g === catGrowth   && r === catRemit
                          const cellFlags  = [
                            isBaseCell ? '📊' : '',
                            isPessCell ? '📉' : '',
                            isCatCell  ? '⚠️' : '',
                          ].filter(Boolean)
                          const isScCell   = cellFlags.length > 0
                          const hasData    = alifSharePct > 0 && marginPct > 0
                          return (
                            <td key={r} className={`px-2 py-1.5 text-center whitespace-nowrap
                              ${isScCell ? 'font-bold ring-2 ring-inset ring-[#1B8A4C] bg-[#1B8A4C]/10 text-gray-900' :
                                !hasData ? 'text-gray-300' :
                                eff < 0 ? 'font-medium text-red-700 bg-red-100' :
                                eff < baseIncomeH2 * 0.05 ? 'font-medium text-yellow-700' : 'font-medium text-green-700'}`}>
                              {isScCell && <span className="block text-[10px] leading-none mb-0.5">{cellFlags.join('')}</span>}
                              {hasData ? fmtNum(inc) : '—'}
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
              <span className="flex items-center gap-1.5">📊 Базовый прогноз</span>
              <span className="flex items-center gap-1.5">📉 Пессимистичный</span>
              <span className="flex items-center gap-1.5">⚠️ Катастрофический</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded"/> Ниже базового дохода H2</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { Download, Printer, TrendingDown, Info, Save } from 'lucide-react'
import { supabase } from '@/supabase/client'

const fmt  = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g,'')) || 0

// PAR30 строки и Coverage столбцы для матрицы
const PAR_ROWS = [2.2, 2.5, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 4.0, 5.0, 7.0, 8.0, 9.0, 10.0]
const COV_COLS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

const CREDIT_HORIZONS = [
  { months: 1,  label: '1 месяц',   pessMultiplier: 1 + 0.4/12, catMultiplier: 1 + 1.0/12 },
  { months: 3,  label: '3 месяца',  pessMultiplier: 1 + 0.4/4,  catMultiplier: 1 + 1.0/4  },
  { months: 6,  label: '6 месяцев', pessMultiplier: 1 + 0.4/2,  catMultiplier: 1 + 1.0/2  },
  { months: 12, label: '1 год',     pessMultiplier: 1.4,         catMultiplier: 2.0         },
]

export default function CreditStressTest() {
  // Входные данные
  const [portfolio, setPortfolio]   = useState('')
  const [currentPar, setCurrentPar] = useState('')
  const [currentCov, setCurrentCov] = useState('')
  const [baseProfit, setBaseProfit] = useState('')

  // Бюджетный сценарий — ежемесячные приросты
  const [growPar7,   setGrowPar7]   = useState('')
  const [growPar30,  setGrowPar30]  = useState('')
  const [growPar90,  setGrowPar90]  = useState('')
  const [growPar180, setGrowPar180] = useState('')
  const [growCov,    setGrowCov]    = useState('')

  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0])
  const [tab, setTab]         = useState<1|2>(1)
  const [horizonIdx, setHorizonIdx] = useState(3) // default: 1 год
  const [saving, setSaving]   = useState(false)
  const [analystName, setAnalystName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('full_name').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p) setAnalystName(p.full_name || '') })
      }
    })
  }, [])

  const P  = parseN(portfolio)
  const CP = parseFloat(currentPar)  || 0   // текущий PAR30 %
  const CC = parseFloat(currentCov)  || 0   // текущий Coverage %
  const BP = parseN(baseProfit)

  // Доп. резерв = Портфель × (НовыйPAR% − ТекущийPAR%) / 100 × Coverage% / 100
  const addReserve = (newPar: number, cov: number) =>
    P * ((newPar - CP) / 100) * (cov / 100)

  const effect     = (newPar: number, cov: number) => -Math.max(0, addReserve(newPar, cov))
  const adjProfit  = (newPar: number, cov: number) => BP + effect(newPar, cov)

  // Сценарии
  const currentHorizon = CREDIT_HORIZONS[horizonIdx]
  const months = currentHorizon.months

  // Мультипликативный расчёт: PAR_new = PAR_current × (1 + rate/100)^months
  const compound = (base: number, ratePct: string) =>
    base * Math.pow(1 + (parseFloat(ratePct) || 0) / 100, months)

  const budget = {
    par: Math.round(compound(CP, growPar30) * 100) / 100,
    cov: Math.min(100, Math.round(compound(CC, growCov) * 10) / 10),
  }

  // Справочный суммарный прирост за горизонт: (1 + rate/100)^months − 1 в %
  const refGrowthPct = (rate: string) =>
    Math.round(((Math.pow(1 + (parseFloat(rate) || 0) / 100, months) - 1) * 100) * 100) / 100
  const refDeltaPar7   = refGrowthPct(growPar7)
  const refDeltaPar90  = refGrowthPct(growPar90)
  const refDeltaPar180 = refGrowthPct(growPar180)

  const pess = { par: Math.round(budget.par * 1.5 * 100) / 100, cov: 80 }
  const cat  = { par: Math.round(budget.par * 2.0 * 100) / 100, cov: 80 }

  // Ближайшие строки PAR_ROWS для подсветки в Модели 2
  const nearestPessPar = PAR_ROWS.reduce((a, b) => Math.abs(b - pess.par) < Math.abs(a - pess.par) ? b : a)
  const nearestCatPar  = PAR_ROWS.reduce((a, b) => Math.abs(b - cat.par)  < Math.abs(a - cat.par)  ? b : a)

  // ── Сохранить в реестр ───────────────────────────
  async function saveToRegistry() {
    setSaving(true)
    const scenarios = [
      { name: 'Бюджетный',        par: budget.par, cov: budget.cov },
      { name: 'Пессимистичный',   par: pess.par,   cov: pess.cov   },
      { name: 'Катастрофический', par: cat.par,     cov: cat.cov    },
    ].map(sc => ({
      ...sc,
      reserve:    Math.round(Math.max(0, addReserve(sc.par, sc.cov))),
      effect:     -Math.round(Math.max(0, addReserve(sc.par, sc.cov))),
      adj_profit: BP > 0 ? Math.round(adjProfit(sc.par, sc.cov)) : null,
    }))
    const catSc = scenarios[2]

    // Модель 2 — ключевые точки What-If матрицы
    const model2 = P > 0 ? {
      par_rows: PAR_ROWS,
      cov_cols: COV_COLS,
      base_profit: BP,
      pess_point: { par: pess.par, cov: pess.cov, reserve: Math.round(Math.max(0, addReserve(pess.par, pess.cov))), adj_profit: BP > 0 ? Math.round(adjProfit(pess.par, pess.cov)) : null },
      cat_point:  { par: cat.par,  cov: cat.cov,  reserve: Math.round(Math.max(0, addReserve(cat.par,  cat.cov))),  adj_profit: BP > 0 ? Math.round(adjProfit(cat.par,  cat.cov))  : null },
    } : null

    const conclusion = [
      `Дата отчётности: ${new Date(reportDate).toLocaleDateString('ru-RU')}. Горизонт: ${currentHorizon.label}.`,
      P > 0 ? `Портфель: ${fmt(P)} TJS. Текущий PAR30: ${CP}%, Coverage: ${CC}%.` : null,
      `Модель 1 — Бюджетный: PAR=${budget.par.toFixed(1)}%, доп. резерв ${fmt(scenarios[0].reserve)} TJS.`,
      `Пессимистичный: PAR=${pess.par.toFixed(1)}%, доп. резерв ${fmt(scenarios[1].reserve)} TJS.`,
      `Катастрофический: PAR=${cat.par.toFixed(1)}%, доп. резерв ${fmt(catSc.reserve)} TJS${BP > 0 && catSc.adj_profit !== null ? `, скорр. прибыль ${fmt(catSc.adj_profit)} TJS` : ''}.`,
      model2?.cat_point?.adj_profit != null ? `Модель 2 — What-If: при катастрофе скорр. прибыль ${fmt(model2.cat_point.adj_profit)} TJS.` : null,
    ].filter(Boolean).join(' ')

    const { error } = await supabase.from('stress_test_registry').insert({
      risk_type: 'Кредитный риск',
      analyst_name: analystName,
      period: new Date(reportDate).toLocaleDateString('ru-RU'),
      inputs: { report_date: reportDate, portfolio: P, current_par: CP, current_cov: CC, base_profit: BP, budget_par: budget.par || null, budget_cov: budget.cov || null, grow_par30: growPar30 || null, grow_cov: growCov || null, horizon: currentHorizon.label },
      results: {
        model1: { scenarios },
        model2,
      },
      conclusion,
      status: 'Проведён',
    })
    setSaving(false)
    if (error) alert('Ошибка: ' + error.message)
    else alert('Стресс-тест сохранён в реестр')
  }

  // Excel экспорт
  function exportExcel() {
    const rows: string[][] = []
    rows.push(['СТРЕСС-ТЕСТ КРЕДИТНОГО РИСКА'])
    rows.push([`Дата отчётности: ${new Date(reportDate).toLocaleDateString('ru-RU')}`])
    rows.push([`Портфель: ${fmt(P)} TJS`])
    rows.push([`Текущий PAR30: ${CP}%  |  Coverage Rate: ${CC}%`])
    rows.push([`Базовая прибыль: ${fmt(BP)} TJS`])
    rows.push([])
    rows.push(['МОДЕЛЬ 1 — СЦЕНАРИИ'])
    rows.push(['Сценарий','PAR30 (%)','Coverage (%)','Доп. резерв (TJS)','Эффект на П&У (TJS)','Скорр. прибыль (TJS)'])
    ;[
      { name: 'Бюджетный',       ...budget },
      { name: 'Пессимистичный',  ...pess   },
      { name: 'Катастрофический',...cat    },
    ].forEach(sc => {
      const res = Math.max(0, addReserve(sc.par, sc.cov))
      const eff = -res
      rows.push([sc.name, String(sc.par), String(sc.cov), String(Math.round(res)), String(Math.round(eff)), BP > 0 ? String(Math.round(BP + eff)) : '—'])
    })
    rows.push([])
    rows.push(['МОДЕЛЬ 2 — WHAT-IF МАТРИЦА'])
    rows.push(['PAR30% / Coverage →', ...COV_COLS.map(c => `${c}%`)])
    PAR_ROWS.forEach(par => {
      rows.push([`${par}%`, ...COV_COLS.map(cov => BP > 0 ? String(Math.round(adjProfit(par, cov))) : String(-Math.round(Math.max(0, addReserve(par, cov)))))])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `Стресс-тест_КР_${reportDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const inp  = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl  = "block text-xs font-medium text-gray-600 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"

  const ScenCard = ({ title, icon, color, bg, border, par, cov }: {
    title: string; icon: string; color: string; bg: string; border: string
    par: number; cov: number
  }) => {
    const res = Math.max(0, addReserve(par, cov))
    const eff = -res
    const adj = BP > 0 ? BP + eff : null
    return (
      <div className={`rounded-xl border-2 ${border} ${bg} p-4`}>
        <p className={`text-sm font-bold ${color} mb-3`}>{icon} {title}</p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-start">
            <span className="text-gray-500">PAR30:</span>
            <span className="font-semibold">{par.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-500">Coverage Rate:</span><span className="font-semibold">{cov}%</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
            <span className="text-gray-500">Доп. резерв:</span>
            <span className="font-bold text-red-600">{fmt(res)} TJS</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-700">Эффект на П&У:</span>
            <span className="font-bold text-red-700">({fmt(res)}) TJS</span>
          </div>
          {adj !== null && (
            <div className={`flex justify-between rounded-lg p-2 mt-1 ${adj >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="font-bold text-gray-700">Скорр. прибыль:</span>
              <span className={`font-bold text-sm ${adj >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(adj)} TJS</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 print:space-y-3">

      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Кредитный риск — Стресс-тест</h1>
          <p className="text-sm text-gray-500 mt-0.5">Сценарный анализ PAR30 · Горизонт: {CREDIT_HORIZONS[horizonIdx].label}{reportDate && ` · ${new Date(reportDate).toLocaleDateString('ru-RU', {month:'long',year:'numeric'})}`}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={saveToRegistry} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm hover:bg-[#166a3a] disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Сохранение...' : 'Сохранить в реестр'}
          </button>
        </div>
      </div>

      {/* Входные данные */}
      <div className={card}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Входные данные</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className={lbl}>Дата отчётности</label>
            <input type="date" value={reportDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setReportDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Кредитный портфель (TJS)</label>
            <input type="text" inputMode="numeric" value={portfolio}
              onChange={e => setPortfolio(fmtN(e.target.value))}
              placeholder="1 122 167 083" className={inp} />
          </div>
          <div>
            <label className={lbl}>Текущий PAR30 (%)</label>
            <input type="text" inputMode="decimal" value={currentPar}
              onChange={e => setCurrentPar(e.target.value)}
              placeholder="2.50" className={inp} />
          </div>
          <div>
            <label className={lbl}>Текущий Coverage Rate (%)</label>
            <input type="text" inputMode="decimal" value={currentCov}
              onChange={e => setCurrentCov(e.target.value)}
              placeholder="80" className={inp} />
          </div>
          <div>
            <label className={lbl}>Базовая прибыль (TJS)</label>
            <input type="text" inputMode="numeric" value={baseProfit}
              onChange={e => setBaseProfit(fmtN(e.target.value))}
              placeholder="119 816 175" className={inp} />
          </div>
        </div>

        {/* Горизонт прогноза */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Горизонт прогноза</p>
          <div className="flex gap-2 flex-wrap">
            {CREDIT_HORIZONS.map((h, i) => (
              <button key={h.months} onClick={() => setHorizonIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${horizonIdx === i ? 'bg-green-50 border-[#1B8A4C] text-[#1B8A4C]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {h.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Пессимистичный = Бюджетный PAR30 × 1.50 · Катастрофический = Бюджетный PAR30 × 2.00
          </p>
        </div>
        {/* Формула */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Формула:</span> Доп. резерв = Портфель × (Новый PAR30% − Текущий PAR30%) × Coverage Rate% ·
            Коэффициенты масштабируются по выбранному горизонту
          </p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-gray-200 print:hidden">
        {([1,2] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t===1 ? '📈 Модель 1 — Сценарии' : '🔢 Модель 2 — What-If матрица'}
          </button>
        ))}
      </div>

      {/* ═══ МОДЕЛЬ 1 ═══ */}
      {tab === 1 && (
        <div className="space-y-5">
          {/* Бюджетный ввод — ежемесячные приросты */}
          <div className="p-4 border-2 border-green-200 bg-green-50 rounded-xl print:hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-green-700">📈 Бюджетный сценарий — средний ежемесячный прирост</p>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">✍️ ручной ввод</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className={lbl}>Прирост PAR&gt;7 (%/мес)</label>
                <input type="text" inputMode="decimal" value={growPar7}
                  onChange={e => setGrowPar7(e.target.value)}
                  placeholder="0.05" className={inp} />
              </div>
              <div>
                <label className={lbl}>Прирост PAR&gt;30 (%/мес)</label>
                <input type="text" inputMode="decimal" value={growPar30}
                  onChange={e => setGrowPar30(e.target.value)}
                  placeholder="0.05" className={inp} />
              </div>
              <div>
                <label className={lbl}>Прирост PAR&gt;90 (%/мес)</label>
                <input type="text" inputMode="decimal" value={growPar90}
                  onChange={e => setGrowPar90(e.target.value)}
                  placeholder="0.03" className={inp} />
              </div>
              <div>
                <label className={lbl}>Прирост PAR&gt;180 (%/мес)</label>
                <input type="text" inputMode="decimal" value={growPar180}
                  onChange={e => setGrowPar180(e.target.value)}
                  placeholder="0.02" className={inp} />
              </div>
              <div>
                <label className={lbl}>Прирост Coverage (%/мес)</label>
                <input type="text" inputMode="decimal" value={growCov}
                  onChange={e => setGrowCov(e.target.value)}
                  placeholder="0.5" className={inp} />
              </div>
            </div>

            {/* Справочный прогноз за горизонт */}
            <div className="mt-3 p-3 bg-white border border-green-100 rounded-lg">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Прогноз за {currentHorizon.label} (справочно)
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">PAR&gt;7</p>
                  <p className="font-semibold text-gray-700">
                    {growPar7 ? `+${refDeltaPar7.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">прирост</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">PAR&gt;30</p>
                  <p className="font-bold text-green-700">{budget.par.toFixed(2)}%</p>
                  <p className="text-[10px] text-green-600">используется</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">PAR&gt;90</p>
                  <p className="font-semibold text-gray-700">
                    {growPar90 ? `+${refDeltaPar90.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">прирост</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">PAR&gt;180</p>
                  <p className="font-semibold text-gray-700">
                    {growPar180 ? `+${refDeltaPar180.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">прирост</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">Coverage</p>
                  <p className="font-bold text-green-700">{budget.cov.toFixed(1)}%</p>
                  <p className="text-[10px] text-green-600">используется</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 карточки */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ScenCard title="Бюджетный" icon="📈"
              color="text-green-700" bg="bg-green-50" border="border-green-200"
              par={budget.par} cov={budget.cov} />
            <ScenCard title="Пессимистичный" icon="📉"
              color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200"
              par={pess.par} cov={pess.cov} />
            <ScenCard title="Катастрофический" icon="⚠️"
              color="text-red-700" bg="bg-red-50" border="border-red-200"
              par={cat.par} cov={cat.cov} />
          </div>

          {/* Сводная таблица */}
          {P > 0 && (
            <div className={card}>
              <p className="text-sm font-semibold text-gray-700 mb-4">Сравнение сценариев</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide">Сценарий</th>
                      <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">PAR30</th>
                      <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Coverage</th>
                      <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Доп. резерв (TJS)</th>
                      <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Эффект на П&У</th>
                      {BP > 0 && <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Скорр. прибыль</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Бюджетный',        icon: '📈', par: budget.par, cov: budget.cov, bg: 'bg-green-50' },
                      { name: 'Пессимистичный',   icon: '📉', par: pess.par,   cov: pess.cov,   bg: 'bg-yellow-50' },
                      { name: 'Катастрофический', icon: '⚠️', par: cat.par,    cov: cat.cov,    bg: 'bg-red-50' },
                    ].map(sc => {
                      const res = Math.max(0, addReserve(sc.par, sc.cov))
                      const eff = -res
                      const adj = BP > 0 ? BP + eff : null
                      return (
                        <tr key={sc.name} className={`${sc.bg} border-b border-gray-200`}>
                          <td className="px-4 py-3 font-semibold">{sc.icon} {sc.name}</td>
                          <td className="px-4 py-3 text-center">{sc.par.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-center">{sc.cov}%</td>
                          <td className="px-4 py-3 text-center text-red-600 font-medium">{fmt(res)}</td>
                          <td className="px-4 py-3 text-center font-bold text-red-700">({fmt(res)})</td>
                          {BP > 0 && <td className={`px-4 py-3 text-center font-bold ${(adj||0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(adj||0)}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ МОДЕЛЬ 2 ═══ */}
      {tab === 2 && (
        <div className={card}>
          <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица</p>
          <p className="text-xs text-gray-500 mb-4">
            {BP > 0
              ? `Скорректированная прибыль · Базовая: ${fmt(BP)} TJS`
              : 'Дополнительный резерв при различных PAR30% и Coverage Rate%'}
          </p>

          {/* Пессимистичный и Катастрофический */}
          {P > 0 && (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide">Сценарий</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">PAR30</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Coverage</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Доп. резерв (TJS)</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase tracking-wide">Эффект на чистую прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Пессимистичный',   icon: '📉', par: pess.par, cov: pess.cov, bg: 'bg-yellow-50', border: 'border-yellow-200' },
                    { name: 'Катастрофический', icon: '⚠️', par: cat.par,  cov: cat.cov,  bg: 'bg-red-50',    border: 'border-red-200'    },
                  ].map(sc => {
                    const res = Math.max(0, addReserve(sc.par, sc.cov))
                    return (
                      <tr key={sc.name} className={`${sc.bg} border-b-2 ${sc.border}`}>
                        <td className="px-4 py-3 font-semibold text-sm">{sc.icon} {sc.name}</td>
                        <td className="px-4 py-3 text-center">{sc.par.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center">{sc.cov}%</td>
                        <td className="px-4 py-3 text-center font-medium text-red-600">{fmt(res)}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-700 text-base">({fmt(Math.round(res))})</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Матрица */}
          {P === 0 ? (
            <div className="p-8 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-700">Введите кредитный портфель и текущий PAR30% выше</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap sticky left-0">
                        PAR30% ↓ / Coverage →
                      </th>
                      {COV_COLS.map(c => (
                        <th key={c} className={`px-3 py-2 text-center whitespace-nowrap text-white ${c === 80 ? 'bg-[#1B8A4C]' : 'bg-gray-800'}`}>
                          {c}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PAR_ROWS.map((par, pi) => {
                      const isCat  = par === nearestCatPar
                      const isPess = par === nearestPessPar && !isCat
                      const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : pi%2===0 ? 'bg-white' : 'bg-gray-50'
                      return (
                        <tr key={par} className={rowBg}>
                          <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                            {par.toFixed(1)}%
                            {isCat  && <span className="ml-1 text-[10px] text-red-500">⚠️</span>}
                            {isPess && <span className="ml-1 text-[10px] text-yellow-500">📧</span>}
                          </td>
                          {COV_COLS.map(cov => {
                            const val = BP > 0 ? adjProfit(par, cov) : -Math.round(Math.max(0, addReserve(par, cov)))
                            const isNeg  = val < 0
                            const isLow  = BP > 0 && val > 0 && val < BP * 0.9
                            const isCov80 = cov === 80
                            return (
                              <td key={cov} className={`px-2 py-1.5 text-center font-medium whitespace-nowrap
                                ${isCov80 ? 'border-x border-green-200' : ''}
                                ${isNeg ? 'text-red-700 bg-red-100' : isLow ? 'text-yellow-700' : 'text-green-700'}`}>
                                {isNeg ? `(${fmt(Math.abs(val))})` : fmt(val)}
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
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block"/> Прибыль &gt;90% базовой</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block"/> 0–90% базовой</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block"/> Убыток</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1B8A4C]/20 rounded inline-block"/> Coverage 80% (текущий норматив)</span>
                <span>📧 Пессимистичный · ⚠️ Катастрофический (ближайшая строка к PAR из Модели 1)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

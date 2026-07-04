'use client'
import { useState, useEffect } from 'react'
import { Download, Printer, TrendingDown, Info, Save } from 'lucide-react'
import { supabase } from '@/supabase/client'

const fmt  = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g,'')) || 0

// Coverage столбцы для матрицы
const COV_COLS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

const CREDIT_HORIZONS = [
  { months: 1,  label: '1 месяц'   },
  { months: 3,  label: '3 месяца'  },
  { months: 6,  label: '6 месяцев' },
  { months: 12, label: '1 год'     },
]

export default function CreditStressTest() {
  // Входные данные
  const [portfolio, setPortfolio]   = useState('')
  const [currentPar, setCurrentPar] = useState('')
  const [currentCov, setCurrentCov] = useState('')
  const [baseProfit, setBaseProfit] = useState('')

  // Текущие значения PAR7/90/180 для справочного прогноза
  const [curPar7,   setCurPar7]   = useState('')
  const [curPar90,  setCurPar90]  = useState('')
  const [curPar180, setCurPar180] = useState('')
  // Таблица приростов [строка: PAR7/30/90/180/Coverage][колонка: мин/сред/макс]
  const [growTable, setGrowTable] = useState<string[][]>(
    Array(5).fill(null).map(() => ['', '', ''])
  )

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

  const currentHorizon = CREDIT_HORIZONS[horizonIdx]
  const months = currentHorizon.months

  // PAR_new = PAR_current × (1 + rate/100)^months
  const compound = (base: number, ratePct: string) =>
    base * Math.pow(1 + (parseFloat(ratePct) || 0) / 100, months)

  const setGrow = (row: number, col: number, val: string) =>
    setGrowTable(prev => prev.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? val : c) : r))

  // Три сценария: Оптимистичный (мин), Пессимистичный (средний), Катастрофический (макс)
  const optim = {
    par: Math.round(compound(CP, growTable[1][0]) * 100) / 100,
    cov: Math.min(100, Math.round(compound(CC, growTable[4][0]) * 10) / 10),
  }
  const pess = {
    par: Math.round(compound(CP, growTable[1][1]) * 100) / 100,
    cov: Math.min(100, Math.round(compound(CC, growTable[4][1]) * 10) / 10),
  }
  const cat = {
    par: Math.round(compound(CP, growTable[1][2]) * 100) / 100,
    cov: Math.min(100, Math.round(compound(CC, growTable[4][2]) * 10) / 10),
  }

  // Текущие значения PAR7/90/180 для справочного прогноза
  const CP7   = parseFloat(curPar7)   || 0
  const CP90  = parseFloat(curPar90)  || 0
  const CP180 = parseFloat(curPar180) || 0

  // Динамические строки матрицы: шаг 0.5% от CP до CP+10%, плюс точные pess/cat
  const parRows: number[] = (() => {
    if (CP <= 0) return []
    const step  = 0.5
    const start = Math.floor(CP / step) * step
    const end   = Math.round((CP + 10) * 10) / 10
    const base: number[] = []
    for (let v = start; v <= end + 0.001; v = Math.round((v + step) * 1000) / 1000) {
      base.push(Math.round(v * 100) / 100)
    }
    const all = new Set(base)
    if (pess.par > 0) all.add(pess.par)
    if (cat.par  > 0) all.add(cat.par)
    return Array.from(all).sort((a, b) => a - b)
  })()

  // ── Сохранить в реестр ───────────────────────────
  async function saveToRegistry() {
    setSaving(true)
    const mkSc = (par: number, cov: number) => ({
      par,
      cov,
      reserve:    Math.round(Math.max(0, addReserve(par, cov))),
      adj_profit: BP > 0 ? Math.round(adjProfit(par, cov)) : null,
    })
    const sc0 = mkSc(optim.par, optim.cov)
    const sc1 = mkSc(pess.par,  pess.cov)
    const sc2 = mkSc(cat.par,   cat.cov)

    const conclusion = [
      `Дата отчётности: ${new Date(reportDate).toLocaleDateString('ru-RU')}. Горизонт: ${currentHorizon.label}.`,
      P > 0 ? `Портфель: ${fmt(P)} TJS. Текущий PAR30: ${CP}%, Coverage: ${CC}%.` : null,
      `Оптимистичный: PAR=${sc0.par.toFixed(1)}%, доп. резерв ${fmt(sc0.reserve)} TJS.`,
      `Пессимистичный: PAR=${sc1.par.toFixed(1)}%, доп. резерв ${fmt(sc1.reserve)} TJS.`,
      `Катастрофический: PAR=${sc2.par.toFixed(1)}%, доп. резерв ${fmt(sc2.reserve)} TJS${BP > 0 && sc2.adj_profit !== null ? `, скорр. прибыль ${fmt(sc2.adj_profit)} TJS` : ''}.`,
    ].filter(Boolean).join(' ')

    const { error } = await supabase.from('stress_test_registry').insert({
      risk_type: 'Кредитный риск',
      analyst_name: analystName,
      period: new Date(reportDate).toLocaleDateString('ru-RU'),
      inputs: {
        report_date: reportDate,
        horizon:     currentHorizon.label,
        portfolio:   P    || null,
        current_par: CP   || null,
        current_cov: CC   || null,
        base_profit: BP   || null,
        grow_table:  growTable,
      },
      results: {
        optimistic:   sc0,
        pessimistic:  sc1,
        catastrophic: sc2,
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
      { name: 'Оптимистичный',   ...optim },
      { name: 'Пессимистичный',  ...pess  },
      { name: 'Катастрофический',...cat   },
    ].forEach(sc => {
      const res = Math.max(0, addReserve(sc.par, sc.cov))
      const eff = -res
      rows.push([sc.name, String(sc.par), String(sc.cov), String(Math.round(res)), String(Math.round(eff)), BP > 0 ? String(Math.round(BP + eff)) : '—'])
    })
    rows.push([])
    rows.push(['МОДЕЛЬ 2 — WHAT-IF МАТРИЦА'])
    rows.push(['PAR30% / Coverage →', ...COV_COLS.map(c => `${c}%`)])
    parRows.forEach(par => {
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
            Оптимистичный = мин. прирост · Пессимистичный = средний прирост · Катастрофический = макс. прирост
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
          {/* Таблица ввода приростов по сценариям */}
          <div className="p-4 border-2 border-gray-200 bg-gray-50 rounded-xl print:hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-700">📊 Ежемесячные приросты по историческим данным за 12 мес. (%/мес)</p>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">✍️ ручной ввод</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left pb-2 pr-4 text-gray-500 font-medium">Показатель</th>
                    <th className="text-center pb-2 px-3 text-gray-500 font-medium">Текущий %</th>
                    <th className="text-center pb-2 px-3 font-bold text-green-700">
                      Мин. прирост/мес<br/><span className="font-normal text-[10px] text-green-500">Оптимистичный</span>
                    </th>
                    <th className="text-center pb-2 px-3 font-bold text-yellow-700">
                      Средний прирост/мес<br/><span className="font-normal text-[10px] text-yellow-500">Пессимистичный</span>
                    </th>
                    <th className="text-center pb-2 px-3 font-bold text-red-700">
                      Макс. прирост/мес<br/><span className="font-normal text-[10px] text-red-500">Катастрофический</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 pr-4 text-gray-600 font-medium whitespace-nowrap">PAR&gt;7 (%)</td>
                    <td className="px-2 py-2">
                      <input type="text" inputMode="decimal" value={curPar7} onChange={e => setCurPar7(e.target.value)} placeholder="4.50" className={`${inp} text-xs py-1.5`} />
                    </td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[0][0]} onChange={e => setGrow(0,0,e.target.value)} placeholder="0.05" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[0][1]} onChange={e => setGrow(0,1,e.target.value)} placeholder="0.10" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[0][2]} onChange={e => setGrow(0,2,e.target.value)} placeholder="0.20" className={`${inp} text-xs py-1.5`} /></td>
                  </tr>
                  <tr className="bg-green-50/50">
                    <td className="py-2 pr-4 font-bold text-gray-700 whitespace-nowrap">
                      PAR&gt;30 (%)<br/><span className="font-normal text-[10px] text-green-600">основной для резерва</span>
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">{CP > 0 ? `${CP}%` : '—'}</td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[1][0]} onChange={e => setGrow(1,0,e.target.value)} placeholder="0.05" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[1][1]} onChange={e => setGrow(1,1,e.target.value)} placeholder="0.10" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[1][2]} onChange={e => setGrow(1,2,e.target.value)} placeholder="0.20" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-gray-600 font-medium whitespace-nowrap">PAR&gt;90 (%)</td>
                    <td className="px-2 py-2">
                      <input type="text" inputMode="decimal" value={curPar90} onChange={e => setCurPar90(e.target.value)} placeholder="1.20" className={`${inp} text-xs py-1.5`} />
                    </td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[2][0]} onChange={e => setGrow(2,0,e.target.value)} placeholder="0.03" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[2][1]} onChange={e => setGrow(2,1,e.target.value)} placeholder="0.05" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[2][2]} onChange={e => setGrow(2,2,e.target.value)} placeholder="0.10" className={`${inp} text-xs py-1.5`} /></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-gray-600 font-medium whitespace-nowrap">PAR&gt;180 (%)</td>
                    <td className="px-2 py-2">
                      <input type="text" inputMode="decimal" value={curPar180} onChange={e => setCurPar180(e.target.value)} placeholder="0.80" className={`${inp} text-xs py-1.5`} />
                    </td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[3][0]} onChange={e => setGrow(3,0,e.target.value)} placeholder="0.02" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[3][1]} onChange={e => setGrow(3,1,e.target.value)} placeholder="0.04" className={`${inp} text-xs py-1.5`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[3][2]} onChange={e => setGrow(3,2,e.target.value)} placeholder="0.08" className={`${inp} text-xs py-1.5`} /></td>
                  </tr>
                  <tr className="bg-green-50/50">
                    <td className="py-2 pr-4 font-bold text-gray-700 whitespace-nowrap">
                      Coverage (%)<br/><span className="font-normal text-[10px] text-green-600">основной для резерва</span>
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">{CC > 0 ? `${CC}%` : '—'}</td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[4][0]} onChange={e => setGrow(4,0,e.target.value)} placeholder="0.5" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[4][1]} onChange={e => setGrow(4,1,e.target.value)} placeholder="0.3" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                    <td className="px-2 py-2"><input type="text" inputMode="decimal" value={growTable[4][2]} onChange={e => setGrow(4,2,e.target.value)} placeholder="-0.5" className={`${inp} text-xs py-1.5 border-green-300`} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Прогноз за горизонт */}
            {(CP > 0 || CC > 0) && (
              <div className="mt-3 p-3 bg-white border border-gray-100 rounded-lg">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Прогноз за {currentHorizon.label}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                    <p className="text-green-700 font-bold text-[11px] mb-1.5">📈 Оптимистичный</p>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;7:</span><span className="font-semibold">{(CP7 > 0 && growTable[0][0]) ? `${Math.round(compound(CP7, growTable[0][0])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;30:</span><span className="font-bold text-green-700">{optim.par > 0 ? `${optim.par.toFixed(2)}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;90:</span><span className="font-semibold">{(CP90 > 0 && growTable[2][0]) ? `${Math.round(compound(CP90, growTable[2][0])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;180:</span><span className="font-semibold">{(CP180 > 0 && growTable[3][0]) ? `${Math.round(compound(CP180, growTable[3][0])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between border-t border-green-100 pt-1"><span className="text-gray-400">Coverage:</span><span className="font-bold text-green-700">{optim.cov > 0 ? `${optim.cov.toFixed(1)}%` : '—'}</span></div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                    <p className="text-yellow-700 font-bold text-[11px] mb-1.5">📉 Пессимистичный</p>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;7:</span><span className="font-semibold">{(CP7 > 0 && growTable[0][1]) ? `${Math.round(compound(CP7, growTable[0][1])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;30:</span><span className="font-bold text-yellow-700">{pess.par > 0 ? `${pess.par.toFixed(2)}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;90:</span><span className="font-semibold">{(CP90 > 0 && growTable[2][1]) ? `${Math.round(compound(CP90, growTable[2][1])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;180:</span><span className="font-semibold">{(CP180 > 0 && growTable[3][1]) ? `${Math.round(compound(CP180, growTable[3][1])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between border-t border-yellow-100 pt-1"><span className="text-gray-400">Coverage:</span><span className="font-bold text-yellow-700">{pess.cov > 0 ? `${pess.cov.toFixed(1)}%` : '—'}</span></div>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <p className="text-red-700 font-bold text-[11px] mb-1.5">⚠️ Катастрофический</p>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;7:</span><span className="font-semibold">{(CP7 > 0 && growTable[0][2]) ? `${Math.round(compound(CP7, growTable[0][2])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;30:</span><span className="font-bold text-red-700">{cat.par > 0 ? `${cat.par.toFixed(2)}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;90:</span><span className="font-semibold">{(CP90 > 0 && growTable[2][2]) ? `${Math.round(compound(CP90, growTable[2][2])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">PAR&gt;180:</span><span className="font-semibold">{(CP180 > 0 && growTable[3][2]) ? `${Math.round(compound(CP180, growTable[3][2])*100)/100}%` : '—'}</span></div>
                      <div className="flex justify-between border-t border-red-100 pt-1"><span className="text-gray-400">Coverage:</span><span className="font-bold text-red-700">{cat.cov > 0 ? `${cat.cov.toFixed(1)}%` : '—'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3 карточки */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ScenCard title="Оптимистичный" icon="📈"
              color="text-green-700" bg="bg-green-50" border="border-green-200"
              par={optim.par} cov={optim.cov} />
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
                      { name: 'Оптимистичный',    icon: '📈', par: optim.par, cov: optim.cov, bg: 'bg-green-50' },
                      { name: 'Пессимистичный',   icon: '📉', par: pess.par,  cov: pess.cov,  bg: 'bg-yellow-50' },
                      { name: 'Катастрофический', icon: '⚠️', par: cat.par,   cov: cat.cov,   bg: 'bg-red-50' },
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
                    {parRows.map((par, pi) => {
                      const isCat  = par === cat.par
                      const isPess = par === pess.par && !isCat
                      const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : pi%2===0 ? 'bg-white' : 'bg-gray-50'
                      return (
                        <tr key={par} className={rowBg}>
                          <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                            {par.toFixed(2)}%
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
                <span>📧 Пессимистичный · ⚠️ Катастрофический (точное значение PAR из Модели 1)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

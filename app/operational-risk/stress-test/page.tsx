'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/supabase/client'
import { RefreshCw, Download, Printer, Save, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const fmt   = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtN  = (v: string) => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g,'')) || 0

const HORIZONS = [
  { months: 1,  label: '1 месяц'   },
  { months: 3,  label: '3 месяца'  },
  { months: 6,  label: '6 месяцев' },
  { months: 12, label: '1 год'     },
]

interface MonthlyStats {
  calendarMonths: number
  totalIncidents: number
  totalLoss: number
  totalRecovery: number
  minLossPerMonth: number
  avgLossPerMonth: number
  maxLossPerMonth: number
  minRecoveryRate: number
  avgRecoveryRate: number
  maxRecoveryRate: number
}

interface Sc { lossPerMonth: number; recoveryRate: number }

const REF_COLORS = {
  optim: { wrap: 'bg-green-50 border border-green-200',  text: 'text-green-700'  },
  pess:  { wrap: 'bg-yellow-50 border border-yellow-200', text: 'text-yellow-700' },
  cat:   { wrap: 'bg-red-50 border border-red-200',       text: 'text-red-700'    },
}

export default function OpStressTest() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]
  })
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().split('T')[0])
  const [horizonIdx, setHorizonIdx] = useState(2)
  const [baseProfit, setBaseProfit] = useState('')
  const [stats,    setStats]    = useState<MonthlyStats | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [tab,      setTab]      = useState<1|2>(1)
  const [saving,   setSaving]   = useState(false)
  const [analystName, setAnalystName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user)
        supabase.from('profiles').select('full_name').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p) setAnalystName(p.full_name || '') })
    })
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('operational_incidents')
      .select('loss_amount_tjs, recovery_amount, discovery_date')
      .gte('discovery_date', dateFrom)
      .lte('discovery_date', dateTo)

    if (data && data.length > 0) {
      const byMonth: Record<string, { loss: number; recovery: number }> = {}
      for (const inc of data) {
        const key = (inc.discovery_date as string)?.slice(0, 7) || 'unknown'
        if (!byMonth[key]) byMonth[key] = { loss: 0, recovery: 0 }
        byMonth[key].loss     += (inc.loss_amount_tjs as number) || 0
        byMonth[key].recovery += (inc.recovery_amount as number) || 0
      }
      const arr      = Object.values(byMonth)
      const lossArr  = arr.map(b => b.loss)
      const rateArr  = arr.map(b => b.loss > 0 ? (b.recovery / b.loss) * 100 : 0)
      const avg      = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
      setStats({
        calendarMonths:   arr.length,
        totalIncidents:   data.length,
        totalLoss:        data.reduce((s, i) => s + ((i.loss_amount_tjs as number) || 0), 0),
        totalRecovery:    data.reduce((s, i) => s + ((i.recovery_amount as number) || 0), 0),
        minLossPerMonth:  Math.min(...lossArr),
        avgLossPerMonth:  avg(lossArr),
        maxLossPerMonth:  Math.max(...lossArr),
        minRecoveryRate:  Math.min(...rateArr),
        avgRecoveryRate:  avg(rateArr),
        maxRecoveryRate:  Math.max(...rateArr),
      })
    } else { setStats(null) }
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Sticky header sentinel ────────────────────────────────────────────────
  const [isStuck, setIsStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const H  = HORIZONS[horizonIdx]
  const fm = H.months
  const bp = parseN(baseProfit)

  // Scenarios — data-driven, no multipliers
  const optim: Sc | null = stats ? { lossPerMonth: stats.minLossPerMonth, recoveryRate: stats.maxRecoveryRate } : null
  const pess:  Sc | null = stats ? { lossPerMonth: stats.avgLossPerMonth, recoveryRate: stats.avgRecoveryRate } : null
  const cat:   Sc | null = stats ? { lossPerMonth: stats.maxLossPerMonth, recoveryRate: stats.minRecoveryRate } : null

  const tLoss   = (sc: Sc) => sc.lossPerMonth * fm
  const tRec    = (sc: Sc) => tLoss(sc) * sc.recoveryRate / 100
  const netLoss = (sc: Sc) => tLoss(sc) - tRec(sc)
  const effP    = (sc: Sc) => -netLoss(sc)
  const adjP    = (sc: Sc) => bp + effP(sc)
  const adjRow  = (horizonLoss: number, recPct: number) =>
    bp > 0 ? bp - horizonLoss * (1 - recPct / 100) : -(horizonLoss * (1 - recPct / 100))

  // Dynamic What-If rows (horizon totals)
  const lossRows: number[] = (() => {
    if (!pess || !cat || !optim) return []
    const pT = Math.round(tLoss(pess))
    const cT = Math.round(tLoss(cat))
    const oT = Math.round(tLoss(optim))
    const lo = Math.max(0, Math.floor(Math.min(oT, pT) * 0.4 / 100000) * 100000)
    const hi = Math.ceil(cT * 1.6 / 100000) * 100000
    const rawStep = (hi - lo) / 14
    const step = Math.max(50000, Math.ceil(rawStep / 50000) * 50000)
    const rows = new Set<number>()
    for (let v = lo; v <= hi + step; v += step) rows.add(Math.round(v / step) * step)
    rows.add(oT); rows.add(pT); rows.add(cT)
    return Array.from(rows).filter(v => v >= 0).sort((a, b) => a - b)
  })()

  // Dynamic What-If columns (recovery rates)
  const recoveryCols: number[] = (() => {
    if (!pess || !cat || !optim) return [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
    const rVals = [optim.recoveryRate, pess.recoveryRate, cat.recoveryRate]
    const minR = Math.min(...rVals)
    const maxR = Math.max(...rVals)
    // Extend ±15pp snapped to nearest 5
    const lo   = Math.max(0,   Math.floor((minR - 15) / 5) * 5)
    const hi   = Math.min(100, Math.ceil( (maxR + 15) / 5) * 5)
    const rawStep = (hi - lo) / 10
    const step    = Math.max(5, Math.round(rawStep / 5) * 5)
    const cols = new Set<number>()
    for (let v = lo; v <= hi; v += step) if (v >= 0 && v <= 100) cols.add(v)
    // Inject exact scenario values (1dp precision, no further rounding)
    ;[optim.recoveryRate, pess.recoveryRate, cat.recoveryRate].forEach(r => {
      const v = parseFloat(r.toFixed(1))
      if (v >= 0 && v <= 100) cols.add(v)
    })
    return Array.from(cols).sort((a, b) => a - b)
  })()

  const chartData = optim && pess && cat ? [
    { name: 'В месяц',    'Оптимистичный': Math.round(optim.lossPerMonth), 'Пессимистичный': Math.round(pess.lossPerMonth),  'Катастрофический': Math.round(cat.lossPerMonth)  },
    { name: `На ${H.label}`, 'Оптимистичный': Math.round(tLoss(optim)),       'Пессимистичный': Math.round(tLoss(pess)),        'Катастрофический': Math.round(tLoss(cat))        },
  ] : []

  async function saveToRegistry() {
    if (!stats || !optim || !pess || !cat) return
    setSaving(true)

    const mkSc = (sc: Sc) => ({
      loss_per_month:    Math.round(sc.lossPerMonth),
      recovery_rate_pct: Math.round(sc.recoveryRate * 10) / 10,
      total_loss:        Math.round(tLoss(sc)),
      total_recovery:    Math.round(tRec(sc)),
      net_loss:          Math.round(netLoss(sc)),
      adj_profit:        bp > 0 ? Math.round(adjP(sc)) : null,
    })

    const conclusion = [
      `Период: ${dateFrom} — ${dateTo} (${stats.calendarMonths} мес.), горизонт: ${H.label}.`,
      `Инцидентов: ${stats.totalIncidents}, общий ущерб: ${fmt(stats.totalLoss)} TJS.`,
      `Оптимистичный: ущерб ${fmt(Math.round(tLoss(optim)))} TJS, чистый убыток ${fmt(Math.round(netLoss(optim)))} TJS.`,
      `Пессимистичный: ущерб ${fmt(Math.round(tLoss(pess)))} TJS, чистый убыток ${fmt(Math.round(netLoss(pess)))} TJS.`,
      `Катастрофический: ущерб ${fmt(Math.round(tLoss(cat)))} TJS, чистый убыток ${fmt(Math.round(netLoss(cat)))} TJS.`,
    ].join(' ')

    const { error } = await supabase.from('stress_test_registry').insert({
      risk_type: 'Операционный риск', analyst_name: analystName,
      period: `${dateFrom} — ${dateTo}`,
      inputs: {
        date_from:          dateFrom,
        date_to:            dateTo,
        horizon:            H.label,
        base_profit:        bp || null,
        incidents:          stats.totalIncidents,
        total_loss_hist:    Math.round(stats.totalLoss),
        calendar_months:    stats.calendarMonths,
        avg_loss_per_month: Math.round(stats.avgLossPerMonth),
      },
      results: {
        optimistic:   mkSc(optim),
        pessimistic:  mkSc(pess),
        catastrophic: mkSc(cat),
      },
      conclusion, status: 'Проведён',
    })
    setSaving(false)
    if (error) alert('Ошибка: ' + error.message)
    else alert('Стресс-тест сохранён в реестр')
  }

  function exportExcel() {
    const rows: string[][] = []
    rows.push(['СТРЕСС-ТЕСТ ОПЕРАЦИОННОГО РИСКА'])
    rows.push([`Период анализа: ${dateFrom} — ${dateTo} (${stats?.calendarMonths || '?'} мес.)`])
    rows.push([`Горизонт прогноза: ${H.label}`])
    if (bp > 0) rows.push([`Базовая прибыль: ${fmt(bp)} TJS`])
    rows.push([])
    if (stats) {
      rows.push(['ИСТОРИЧЕСКИЕ ДАННЫЕ (МЕСЯЧНЫЕ)'])
      rows.push(['Показатель', 'Мин./мес.', 'Средн./мес.', 'Макс./мес.'])
      rows.push(['Ущерб (TJS)', fmt(stats.minLossPerMonth), fmt(stats.avgLossPerMonth), fmt(stats.maxLossPerMonth)])
      rows.push(['Возвратность (%)', `${stats.minRecoveryRate.toFixed(1)}%`, `${stats.avgRecoveryRate.toFixed(1)}%`, `${stats.maxRecoveryRate.toFixed(1)}%`])
      rows.push([])
    }
    rows.push(['МОДЕЛЬ 1 — СЦЕНАРНЫЙ ПРОГНОЗ'])
    rows.push(['Сценарий','Ущерб/мес (TJS)','Возвратность (%)','Ущерб итого (TJS)','Возмещение (TJS)','Чистый убыток (TJS)', bp > 0 ? 'Скорр. прибыль (TJS)' : ''])
    if (optim && pess && cat) {
      [{ name:'Оптимистичный',sc:optim},{name:'Пессимистичный',sc:pess},{name:'Катастрофический',sc:cat}].forEach(({name,sc}) => {
        rows.push([name, String(Math.round(sc.lossPerMonth)), `${sc.recoveryRate.toFixed(1)}%`, String(Math.round(tLoss(sc))), String(Math.round(tRec(sc))), String(Math.round(netLoss(sc))), bp > 0 ? String(Math.round(adjP(sc))) : ''])
      })
    }
    if (bp > 0 && lossRows.length) {
      rows.push([])
      rows.push(['МОДЕЛЬ 2 — WHAT-IF МАТРИЦА'])
      rows.push([`Базовая прибыль: ${fmt(bp)} TJS`])
      rows.push(['Ущерб (горизонт) ↓ / Возвратность →', ...recoveryCols.map(r => Number.isInteger(r) ? `${r}%` : `${r.toFixed(1)}%`)])
      lossRows.forEach(loss => rows.push([fmt(loss), ...recoveryCols.map(r => String(Math.round(adjRow(loss, r))))]))
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`Стресс-тест_ОР_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const inp  = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl  = "block text-xs font-medium text-gray-600 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"

  const ScenCard = ({ title, icon, sc, colorKey }: { title: string; icon: string; sc: Sc; colorKey: keyof typeof REF_COLORS }) => {
    const tL = tLoss(sc), tR = tRec(sc), nL = netLoss(sc), eff = effP(sc)
    const adj = bp > 0 ? adjP(sc) : null
    const c = REF_COLORS[colorKey]
    return (
      <div className={`rounded-xl border-2 p-4 ${c.wrap}`}>
        <p className={`text-sm font-bold mb-3 ${c.text}`}>{icon} {title}</p>
        {/* Monthly reference */}
        <div className="mb-3 p-2.5 bg-white/70 rounded-lg">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">В месяц</p>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Ущерб:</span>
            <span className="font-semibold text-red-600">{fmt(sc.lossPerMonth)} TJS</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Возвратность:</span>
            <span className={`font-semibold ${c.text}`}>{sc.recoveryRate.toFixed(1)}%</span>
          </div>
        </div>
        {/* Horizon totals */}
        <div className="space-y-2 text-xs">
          <p className="text-[10px] font-semibold text-gray-400 uppercase">На горизонт ({H.label})</p>
          <div className="flex justify-between">
            <span className="text-gray-500">Ущерб:</span>
            <span className="font-semibold text-red-600">{fmt(tL)} TJS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Возмещение:</span>
            <span className="font-semibold text-green-600">{fmt(tR)} TJS</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
            <span className="font-semibold text-gray-700">Чистый убыток:</span>
            <span className="font-bold text-red-700">{fmt(nL)} TJS</span>
          </div>
          {bp > 0 && (
            <>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Эффект на П&У:</span>
                <span className="font-bold text-red-700">{fmt(eff)} TJS</span>
              </div>
              {adj !== null && (
                <div className={`flex justify-between rounded-lg p-2 mt-1 ${adj >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-bold text-gray-700">Скорр. прибыль:</span>
                  <span className={`font-bold text-sm ${adj >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(adj)} TJS</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 print:space-y-3">

      {/* Sentinel — triggers sticky shadow when scrolled past */}
      <div ref={sentinelRef} className="h-px" aria-hidden />

      {/* ── STICKY HEADER ─────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-30 bg-[#F5F8F6] pb-3 transition-shadow duration-200 print:static print:shadow-none ${isStuck ? 'shadow-[0_4px_16px_rgba(0,0,0,0.08)]' : ''}`}>

        {/* Title + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Операционный риск — Стресс-тест</h1>
            <p className="text-sm text-gray-500 mt-0.5">Сценарный прогноз на основе исторических инцидентов · горизонт: {H.label}</p>
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
            <button onClick={saveToRegistry} disabled={saving || !stats}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm hover:bg-[#166a3a] disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Сохранение...' : 'Сохранить в реестр'}
            </button>
          </div>
        </div>

        {/* Parameters */}
        <div className={`${card} print:hidden mt-3`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Параметры стресс-теста</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className={lbl}>Период анализа — от</label>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Период анализа — до</label>
            <input type="date" value={dateTo} min={dateFrom} max={new Date().toISOString().split('T')[0]}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Базовая прибыль (TJS)</label>
            <input type="text" inputMode="numeric" value={baseProfit}
              onChange={e => setBaseProfit(fmtN(e.target.value))}
              placeholder="119 884 299" className={inp} />
          </div>
          <div>
            {loading
              ? <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-600"><RefreshCw className="w-3.5 h-3.5 animate-spin"/>Загрузка...</div>
              : stats
                ? <div className="px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700">✅ {stats.totalIncidents} инц. · {stats.calendarMonths} мес. · {fmt(stats.totalLoss)} TJS</div>
                : <div className="px-3 py-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">⚠️ Нет данных за период</div>
            }
          </div>
        </div>

        {/* Horizon */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Горизонт прогноза</p>
          <div className="flex gap-2 flex-wrap">
            {HORIZONS.map((h, i) => (
              <button key={h.months} onClick={() => setHorizonIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${horizonIdx===i ? 'bg-green-50 border-[#1B8A4C] text-[#1B8A4C]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
        </div>{/* end Parameters card */}
      </div>{/* end sticky wrapper */}

      {/* Reference block — прокручивается вместе с контентом */}
      {stats && optim && pess && cat && (
        <div className={`${card} print:hidden`}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Прогноз за {H.label}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {([
              { label: '📈 Оптимистичный', sc: optim, ck: 'optim' as const },
              { label: '📉 Пессимистичный', sc: pess, ck: 'pess'  as const },
              { label: '⚠️ Катастрофический', sc: cat, ck: 'cat'   as const },
            ]).map(({ label, sc, ck }) => {
              const c = REF_COLORS[ck]
              return (
                <div key={label} className={`rounded-lg p-2.5 ${c.wrap}`}>
                  <p className={`font-bold text-[11px] mb-1.5 ${c.text}`}>{label}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-400">Ущерб/мес:</span><span className="font-semibold">{fmt(sc.lossPerMonth)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Возвратность:</span><span className={`font-semibold ${c.text}`}>{sc.recoveryRate.toFixed(1)}%</span></div>
                    <div className="flex justify-between border-t border-gray-100 pt-1"><span className="text-gray-400">Ущерб итого:</span><span className="font-bold">{fmt(tLoss(sc))}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Чистый убыток:</span><span className={`font-bold ${c.text}`}>{fmt(netLoss(sc))}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Методология:</span> Инциденты группируются по месяцам.
              Оптимистичный = мин. ущерб/мес + макс. возвратность.
              Пессимистичный = средние значения.
              Катастрофический = макс. ущерб/мес + мин. возвратность.
            </p>
          </div>
        </div>
      )}

      {/* Historical data table */}
      {stats ? (
        <div className={card}>
          <p className="text-sm font-semibold text-gray-700 mb-3">📊 История: {dateFrom} — {dateTo} ({stats.calendarMonths} мес.)</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { l:'Инцидентов',      v:`${stats.totalIncidents} шт.`,    c:'text-gray-900' },
              { l:'Общий ущерб',     v:`${fmt(stats.totalLoss)} TJS`,     c:'text-red-600'  },
              { l:'Возмещено',       v:`${fmt(stats.totalRecovery)} TJS`,  c:'text-green-600'},
              { l:'Средн. возврат.', v:`${stats.avgRecoveryRate.toFixed(1)}%`, c:'text-blue-600' },
            ].map(s => (
              <div key={s.l} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium w-40">Показатель</th>
                  <th className="px-3 py-2 text-center text-green-700 font-bold">Мин. / мес.</th>
                  <th className="px-3 py-2 text-center text-yellow-700 font-bold">Средн. / мес.</th>
                  <th className="px-3 py-2 text-center text-red-700 font-bold">Макс. / мес.</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-600">Ущерб (TJS)</td>
                  <td className="px-3 py-2 text-center font-semibold text-green-700">{fmt(stats.minLossPerMonth)}</td>
                  <td className="px-3 py-2 text-center font-semibold text-yellow-700">{fmt(stats.avgLossPerMonth)}</td>
                  <td className="px-3 py-2 text-center font-semibold text-red-700">{fmt(stats.maxLossPerMonth)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-gray-600">Возвратность (%)</td>
                  <td className="px-3 py-2 text-center font-semibold text-green-700">{stats.minRecoveryRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center font-semibold text-yellow-700">{stats.avgRecoveryRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center font-semibold text-red-700">{stats.maxRecoveryRate.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">⚠️ Нет данных об инцидентах за выбранный период. Измените диапазон дат.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 print:hidden">
        {([1,2] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t===1 ? '📈 Модель 1 — Сценарный прогноз' : '🔢 Модель 2 — What-If матрица'}
          </button>
        ))}
      </div>

      {/* ═══ MODEL 1 ═══ */}
      {tab === 1 && (
        <div className="space-y-5">
          {optim && pess && cat ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ScenCard title="Оптимистичный"    icon="📈" sc={optim} colorKey="optim" />
                <ScenCard title="Пессимистичный"   icon="📉" sc={pess}  colorKey="pess"  />
                <ScenCard title="Катастрофический" icon="⚠️" sc={cat}   colorKey="cat"   />
              </div>

              {/* Chart */}
              <div className={card}>
                <p className="text-sm font-semibold text-gray-700 mb-4">Сравнение сценариев — сумма ущерба (TJS)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => [fmt(v), '']} />
                    <Legend />
                    <Bar dataKey="Оптимистичный"    fill="#1B8A4C" radius={[4,4,0,0]} />
                    <Bar dataKey="Пессимистичный"   fill="#F59E0B" radius={[4,4,0,0]} />
                    <Bar dataKey="Катастрофический" fill="#EF4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary table */}
              <div className={card}>
                <p className="text-sm font-semibold text-gray-700 mb-4">Сравнение сценариев на горизонт: {H.label}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="px-4 py-2.5 text-left   text-xs uppercase">Сценарий</th>
                        <th className="px-4 py-2.5 text-center text-xs uppercase">Ущерб / мес.</th>
                        <th className="px-4 py-2.5 text-center text-xs uppercase">Возвратность</th>
                        <th className="px-4 py-2.5 text-center text-xs uppercase">Ущерб итого</th>
                        <th className="px-4 py-2.5 text-center text-xs uppercase">Возмещение</th>
                        <th className="px-4 py-2.5 text-center text-xs uppercase">Чистый убыток</th>
                        {bp > 0 && <th className="px-4 py-2.5 text-center text-xs uppercase">Скорр. прибыль</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name:'Оптимистичный',    icon:'📈', sc:optim, bg:'bg-green-50'  },
                        { name:'Пессимистичный',   icon:'📉', sc:pess,  bg:'bg-yellow-50' },
                        { name:'Катастрофический', icon:'⚠️', sc:cat,   bg:'bg-red-50'    },
                      ].map(({ name, icon, sc, bg }) => {
                        const adj = bp > 0 ? adjP(sc) : null
                        return (
                          <tr key={name} className={`${bg} border-b border-gray-200`}>
                            <td className="px-4 py-3 font-semibold">{icon} {name}</td>
                            <td className="px-4 py-3 text-center">{fmt(sc.lossPerMonth)}</td>
                            <td className="px-4 py-3 text-center text-green-700 font-medium">{sc.recoveryRate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-center text-red-600 font-medium">{fmt(tLoss(sc))}</td>
                            <td className="px-4 py-3 text-center text-green-600 font-medium">{fmt(tRec(sc))}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-700">{fmt(netLoss(sc))}</td>
                            {bp > 0 && <td className={`px-4 py-3 text-center font-bold ${(adj||0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(adj||0)}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl p-10 text-center text-sm text-gray-400">
              Загрузите данные за период для расчёта сценариев
            </div>
          )}
        </div>
      )}

      {/* ═══ MODEL 2 ═══ */}
      {tab === 2 && (
        <div className={card}>
          <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица</p>
          <p className="text-xs text-gray-500 mb-4">
            Эффект на чистую прибыль при различных суммах ущерба (горизонт: {H.label}) и уровнях возвратности.
            {bp > 0 && <span className="font-medium text-gray-700"> · Базовая прибыль: {fmt(bp)} TJS</span>}
          </p>

          {/* Pess / Cat summary */}
          {pess && cat && (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2.5 text-left   text-xs uppercase">Сценарий</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Ущерб итого (TJS)</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Возвратность</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Чистый убыток (TJS)</th>
                    <th className="px-4 py-2.5 text-center text-xs uppercase">Эффект на чистую прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name:'Пессимистичный',   icon:'📉', sc:pess, bg:'bg-yellow-50 border-b-2 border-yellow-200' },
                    { name:'Катастрофический', icon:'⚠️', sc:cat,  bg:'bg-red-50'                                  },
                  ].map(({ name, icon, sc, bg }) => (
                    <tr key={name} className={bg}>
                      <td className="px-4 py-3 font-semibold text-sm">{icon} {name}</td>
                      <td className="px-4 py-3 text-center">{fmt(tLoss(sc))}</td>
                      <td className="px-4 py-3 text-center font-medium text-green-700">{sc.recoveryRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center font-medium text-red-600">{fmt(netLoss(sc))}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-700 text-base">({fmt(netLoss(sc))})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!stats ? (
            <div className="p-8 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-700">Загрузите данные за период для построения матрицы</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-white px-3 py-2 text-left whitespace-nowrap sticky left-0">
                        Ущерб (TJS) / Возвратность →
                      </th>
                      {recoveryCols.map(r => {
                        const isCR = !!cat   && Math.abs(r - cat.recoveryRate)   < 0.05
                        const isPR = !!pess  && Math.abs(r - pess.recoveryRate)  < 0.05 && !isCR
                        const isOR = !!optim && Math.abs(r - optim.recoveryRate) < 0.05 && !isCR && !isPR
                        return (
                          <th key={r} className={`px-3 py-2 text-center whitespace-nowrap text-white
                            ${isCR ? 'bg-red-700' : isPR ? 'bg-yellow-600' : isOR ? 'bg-green-700' : 'bg-gray-800'}`}>
                            {isCR ? '⚠️ ' : isPR ? '📉 ' : isOR ? '📈 ' : ''}
                            {Number.isInteger(r) ? `${r}%` : `${r.toFixed(1)}%`}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {lossRows.map((loss, li) => {
                      const pT = pess ? Math.round(tLoss(pess)) : -1
                      const cT = cat  ? Math.round(tLoss(cat))  : -1
                      const oT = optim? Math.round(tLoss(optim)): -1
                      const isCat   = loss === cT
                      const isPess  = loss === pT && !isCat
                      const isOptim = loss === oT && !isCat && !isPess
                      const rowBg   = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isOptim ? 'bg-green-50/60' : li%2===0 ? 'bg-white' : 'bg-gray-50'
                      return (
                        <tr key={loss} className={rowBg}>
                          <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                            {fmt(loss)}
                            {isCat   && <span className="ml-1 text-[10px] text-red-500">⚠️</span>}
                            {isPess  && <span className="ml-1 text-[10px] text-yellow-500">📉</span>}
                            {isOptim && <span className="ml-1 text-[10px] text-green-500">📈</span>}
                          </td>
                          {recoveryCols.map(rec => {
                            const val         = adjRow(loss, rec)
                            const isNeg       = val < 0
                            const isLow       = bp > 0 && val >= 0 && val < bp * 0.9
                            const isRecCat    = !!cat   && Math.abs(rec - cat.recoveryRate)   < 0.05
                            const isRecPess   = !!pess  && Math.abs(rec - pess.recoveryRate)  < 0.05 && !isRecCat
                            const isCatCell   = isCat  && isRecCat
                            const isPessCell  = isPess && isRecPess
                            return (
                              <td key={rec} className={`px-2 py-1.5 text-center whitespace-nowrap
                                ${isCatCell  ? 'font-extrabold ring-2 ring-inset ring-red-600'    : ''}
                                ${isPessCell ? 'font-extrabold ring-2 ring-inset ring-yellow-500'  : 'font-medium'}
                                ${isNeg ? 'text-red-700 bg-red-100' : isLow ? 'text-yellow-700 bg-yellow-50' : 'text-green-700'}`}>
                                {isCatCell ? '⚠️ ' : isPessCell ? '📉 ' : ''}
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
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block"/> &gt;90% базовой прибыли</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block"/> 0–90% базовой прибыли</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block"/> Убыток</span>
                <span>📈 Оптимистичный · 📉 Пессимистичный · ⚠️ Катастрофический — точные строки и столбцы из Модели 1 (без округления)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

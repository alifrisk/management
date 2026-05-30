'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { RefreshCw, Download, Printer } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts'

const fmt  = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g,'')) || 0
const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const COEFF = {
  pessimistic:   { incidents: 1.5, loss: 2.0, recovery: 0.10 },
  catastrophic:  { incidents: 2.5, loss: 5.0, recovery: 0.05 },
}

const LOSS_ROWS    = [400000,800000,1000000,1400000,1600000,2000000,2500000,3000000,3500000,4000000,4500000,5000000]
const RECOVERY_COLS = [0.10,0.20,0.25,0.30,0.40,0.50,0.60,0.70,0.80,0.90]

interface HistData {
  totalIncidents: number
  totalLoss: number
  totalRecovery: number
  recoveryRate: number
  months: number
  avgIncidentsPerMonth: number
  avgLossPerMonth: number
}

export default function OpStressTest() {
  // ── Период истории ───────────────────────────────
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  // ── Горизонт прогноза ────────────────────────────
  const [forecastMonths, setForecastMonths] = useState(6)
  // ── Данные ───────────────────────────────────────
  const [hist, setHist] = useState<HistData | null>(null)
  const [loading, setLoading] = useState(false)
  // ── Бюджетный ввод ───────────────────────────────
  const [bInc, setBInc] = useState('')
  const [bLoss, setBLoss] = useState('')
  const [bRec, setBRec] = useState('')
  // ── Базовая прибыль ──────────────────────────────
  const [baseProfit, setBaseProfit] = useState('')
  // ── Активная вкладка ─────────────────────────────
  const [tab, setTab] = useState<1|2>(1)

  const fetchHist = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('operational_incidents')
      .select('loss_amount_tjs, recovery_amount, discovery_date')
      .gte('discovery_date', dateFrom)
      .lte('discovery_date', dateTo)
    if (data && data.length > 0) {
      const totalLoss     = data.reduce((s,i) => s + (i.loss_amount_tjs||0), 0)
      const totalRecovery = data.reduce((s,i) => s + (i.recovery_amount||0), 0)
      const d1 = new Date(dateFrom), d2 = new Date(dateTo)
      const months = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000*60*60*24*30)))
      setHist({
        totalIncidents: data.length, totalLoss, totalRecovery,
        recoveryRate: totalLoss > 0 ? totalRecovery / totalLoss : 0,
        months,
        avgIncidentsPerMonth: data.length / months,
        avgLossPerMonth:      totalLoss / months,
      })
    } else { setHist(null) }
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchHist() }, [fetchHist])

  // ── Сценарии ─────────────────────────────────────
  const budget = {
    incPerMonth: bInc  ? parseN(bInc) / forecastMonths : hist?.avgIncidentsPerMonth || 0,
    lossPerMonth: bLoss ? parseN(bLoss) / forecastMonths : hist?.avgLossPerMonth || 0,
    recovery:    bRec  ? parseN(bRec) / 100             : hist?.recoveryRate || 0,
  }
  const pess = hist ? {
    incPerMonth:  hist.avgIncidentsPerMonth * COEFF.pessimistic.incidents,
    lossPerMonth: hist.avgLossPerMonth      * COEFF.pessimistic.loss,
    recovery:     COEFF.pessimistic.recovery,
  } : null
  const cat = hist ? {
    incPerMonth:  hist.avgIncidentsPerMonth * COEFF.catastrophic.incidents,
    lossPerMonth: hist.avgLossPerMonth      * COEFF.catastrophic.loss,
    recovery:     COEFF.catastrophic.recovery,
  } : null

  const totalFor = (sc: typeof budget) => ({
    incidents: Math.round(sc.incPerMonth  * forecastMonths),
    loss:      sc.lossPerMonth * forecastMonths,
    netLoss:   sc.lossPerMonth * forecastMonths * (1 - sc.recovery),
    recovery:  sc.recovery,
  })

  // ── График по месяцам ────────────────────────────
  const chartData = Array.from({ length: forecastMonths }, (_, i) => {
    const d = new Date(dateTo); d.setMonth(d.getMonth() + i + 1)
    return {
      name: MONTHS_RU[d.getMonth()],
      'Бюджетный (ущерб)':         Math.round(budget.lossPerMonth),
      'Пессимистичный (ущерб)':    pess ? Math.round(pess.lossPerMonth) : 0,
      'Катастрофический (ущерб)':  cat  ? Math.round(cat.lossPerMonth)  : 0,
      'Бюджетный (инц.)':          Math.round(budget.incPerMonth),
      'Пессимистичный (инц.)':     pess ? Math.round(pess.incPerMonth)  : 0,
      'Катастрофический (инц.)':   cat  ? Math.round(cat.incPerMonth)   : 0,
    }
  })

  // ── What-If ──────────────────────────────────────
  const bp = parseN(baseProfit)
  const adjProfit = (loss: number, rec: number) => bp - loss * (1 - rec)

  // ── Excel экспорт ────────────────────────────────
  function exportExcel() {
    const rows: string[][] = []
    rows.push(['СТРЕСС-ТЕСТ ОПЕРАЦИОННОГО РИСКА'])
    rows.push([`Исторический период: ${dateFrom} — ${dateTo}`])
    rows.push([`Горизонт прогноза: ${forecastMonths} мес.`])
    rows.push([])
    rows.push(['МОДЕЛЬ 1 — СЦЕНАРНЫЙ ПРОГНОЗ'])
    rows.push(['Сценарий','Инциденты (шт.)','Ущерб (TJS)','Возвратность (%)','Чистый ущерб (TJS)','Эффект на П&У (TJS)'])
    const scns = [
      { name: 'Бюджетный',       sc: totalFor(budget) },
      ...(pess ? [{ name: 'Пессимистичный', sc: totalFor(pess) }] : []),
      ...(cat  ? [{ name: 'Катастрофический',sc: totalFor(cat)  }] : []),
    ]
    scns.forEach(({ name, sc }) => {
      const eff = bp > 0 ? -(sc.netLoss) : 0
      rows.push([name, String(sc.incidents), String(Math.round(sc.loss)), `${(sc.recovery*100).toFixed(0)}%`, String(Math.round(sc.netLoss)), bp > 0 ? String(Math.round(eff)) : '—'])
    })
    if (bp > 0) {
      rows.push([])
      rows.push(['МОДЕЛЬ 2 — WHAT-IF МАТРИЦА'])
      rows.push(['Базовая прибыль:', String(bp)])
      rows.push(['Ущерб ↓ / Возвратность →', ...RECOVERY_COLS.map(r => `${(r*100).toFixed(0)}%`)])
      LOSS_ROWS.forEach(loss => {
        rows.push([fmt(loss), ...RECOVERY_COLS.map(r => String(Math.round(adjProfit(loss, r))))])
      })
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `Стресс-тест_ОР_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const inp  = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl  = "block text-xs font-medium text-gray-600 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"

  const ScenCard = ({ title, icon, color, bg, border, sc }: {
    title: string; icon: string; color: string; bg: string; border: string
    sc: ReturnType<typeof totalFor>
  }) => {
    const eff = bp > 0 ? -(sc.netLoss) : null
    const adj = bp > 0 ? bp + (eff!) : null
    return (
      <div className={`rounded-xl border-2 ${border} ${bg} p-4`}>
        <p className={`text-sm font-bold ${color} mb-3`}>{icon} {title}</p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Инцидентов:</span><span className="font-semibold">{sc.incidents} шт.</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Ущерб:</span><span className="font-semibold text-red-600">{fmt(sc.loss)} TJS</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Возвратность:</span><span className="font-semibold text-green-600">{(sc.recovery*100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Возмещено:</span><span className="font-semibold text-green-600">{fmt(sc.loss * sc.recovery)} TJS</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
            <span className="font-semibold text-gray-700">Чистый ущерб:</span>
            <span className="font-bold text-red-700">{fmt(sc.netLoss)} TJS</span>
          </div>
          {eff !== null && (
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Эффект на П&У:</span>
              <span className="font-bold text-red-700">{fmt(eff)} TJS</span>
            </div>
          )}
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
          <h1 className="text-xl font-semibold text-gray-900">Операционный риск — Стресс-тест</h1>
          <p className="text-sm text-gray-500 mt-0.5">Сценарный прогноз и What-If анализ влияния на прибыль и убыток</p>
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
        </div>
      </div>

      {/* Параметры */}
      <div className={`${card} print:hidden`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Параметры стресс-теста</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className={lbl}>Период истории — от</label>
            <input type="date" value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Период истории — до</label>
            <input type="date" value={dateTo}
              min={dateFrom}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
          </div>
          <div>
            <label className={lbl}>Горизонт прогноза (мес.)</label>
            <select value={forecastMonths} onChange={e => setForecastMonths(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
              {[3,6,9,12].map(m => <option key={m} value={m}>{m} мес.</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Базовая прибыль (TJS)</label>
            <input type="text" inputMode="numeric" value={baseProfit}
              onChange={e => setBaseProfit(fmtN(e.target.value))}
              placeholder="119 884 299" className={inp} />
          </div>
          <div className="flex items-center gap-2">
            {loading
              ? <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Загрузка...</div>
              : hist
                ? <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700">✅ Данные загружены ({hist.totalIncidents} инц.)</div>
                : <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">⚠️ Нет данных за период</div>
            }
          </div>
        </div>
      </div>

      {/* Исторические данные */}
      {hist ? (
        <div className={card}>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            📊 История: {dateFrom} — {dateTo} ({hist.months} мес.)
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { l: 'Инцидентов',     v: `${hist.totalIncidents} шт.`,                       c: 'text-gray-900' },
              { l: 'Общий ущерб',    v: `${fmt(hist.totalLoss)} TJS`,                        c: 'text-red-600'  },
              { l: 'Возмещено',      v: `${fmt(hist.totalRecovery)} TJS`,                    c: 'text-green-600'},
              { l: 'Возвратность',   v: `${(hist.recoveryRate*100).toFixed(1)}%`,             c: 'text-blue-600' },
              { l: 'В среднем / мес',v: `${Math.round(hist.avgIncidentsPerMonth)} инц. · ${fmt(hist.avgLossPerMonth)} TJS`, c: 'text-gray-700' },
            { l: 'Период (мес.)',     v: `${hist.months} мес.`,                                              c: 'text-gray-500' },
            ].map(s => (
              <div key={s.l} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Как работает:</span> Система берёт среднее по месяцу из выбранного периода и умножает на горизонт прогноза.
              Пессимистичный = среднее × (инциденты: 1.5×, ущерб: 2.0×, возвратность фиксирована: 10%).
              Катастрофический = среднее × (инциденты: 2.5×, ущерб: 5.0×, возвратность фиксирована: 5%).
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">⚠️ Нет данных за выбранный период. Введите бюджетные значения вручную.</p>
        </div>
      )}

      {/* Вкладки */}
      <div className="flex border-b border-gray-200 print:hidden">
        {([1,2] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t===1 ? '📈 Модель 1 — Сценарный прогноз' : '🔢 Модель 2 — What-If матрица'}
          </button>
        ))}
      </div>

      {/* ═══ МОДЕЛЬ 1 ═══ */}
      {(tab === 1) && (
        <div className="space-y-5">
          {/* Бюджетный ввод */}
          <div className="p-4 border-2 border-green-200 bg-green-50 rounded-xl print:hidden">
            <p className="text-xs font-bold text-green-700 mb-3">📈 Бюджетный сценарий — ввод вручную (итого за {forecastMonths} мес.)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Кол-во инцидентов</label>
                <input type="text" inputMode="numeric" value={bInc}
                  onChange={e => setBInc(e.target.value.replace(/\D/g,''))}
                  placeholder={hist ? String(Math.round(hist.avgIncidentsPerMonth * forecastMonths)) : '0'} className={inp} />
              </div>
              <div>
                <label className={lbl}>Сумма ущерба (TJS)</label>
                <input type="text" inputMode="numeric" value={bLoss}
                  onChange={e => setBLoss(fmtN(e.target.value))}
                  placeholder={hist ? fmt(hist.avgLossPerMonth * forecastMonths) : '0'} className={inp} />
              </div>
              <div>
                <label className={lbl}>Возвратность (%)</label>
                <input type="text" inputMode="numeric" value={bRec}
                  onChange={e => setBRec(e.target.value.replace(/\D/g,''))}
                  placeholder={hist ? `${(hist.recoveryRate*100).toFixed(0)}` : '0'} className={inp} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">💡 Оставьте пустым — подставятся исторические данные автоматически</p>
          </div>

          {/* 3 карточки */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ScenCard title="Бюджетный" icon="📈" color="text-green-700" bg="bg-green-50" border="border-green-200" sc={totalFor(budget)} />
            {pess
              ? <ScenCard title="Пессимистичный" icon="📉" color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200" sc={totalFor(pess)} />
              : <div className="rounded-xl border-2 border-dashed border-yellow-200 bg-yellow-50 p-6 flex items-center justify-center"><p className="text-xs text-yellow-600 text-center">Загрузите исторические данные</p></div>}
            {cat
              ? <ScenCard title="Катастрофический" icon="⚠️" color="text-red-700" bg="bg-red-50" border="border-red-200" sc={totalFor(cat)} />
              : <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-6 flex items-center justify-center"><p className="text-xs text-red-600 text-center">Загрузите исторические данные</p></div>}
          </div>

          {/* График ущерб */}
          <div className={card}>
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Прогноз ущерба по месяцам — следующие {forecastMonths} мес.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Бюджетный (ущерб)"        fill="#1B8A4C" radius={[3,3,0,0]}>
                  <LabelList dataKey="Бюджетный (ущерб)"        position="top" style={{ fontSize: 9, fill: '#1B8A4C' }} formatter={(v: number) => v > 0 ? fmt(v) : ''} />
                </Bar>
                <Bar dataKey="Пессимистичный (ущерб)"   fill="#F59E0B" radius={[3,3,0,0]}>
                  <LabelList dataKey="Пессимистичный (ущерб)"   position="top" style={{ fontSize: 9, fill: '#BF8F00' }} formatter={(v: number) => v > 0 ? fmt(v) : ''} />
                </Bar>
                <Bar dataKey="Катастрофический (ущерб)" fill="#EF4444" radius={[3,3,0,0]}>
                  <LabelList dataKey="Катастрофический (ущерб)" position="top" style={{ fontSize: 9, fill: '#C00000' }} formatter={(v: number) => v > 0 ? fmt(v) : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* График инциденты */}
          <div className={card}>
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Прогноз количества инцидентов по месяцам
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="Бюджетный (инц.)"        stroke="#1B8A4C" strokeWidth={2} dot={{ r: 4 }} />
                <Line dataKey="Пессимистичный (инц.)"   stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                <Line dataKey="Катастрофический (инц.)" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              <span className="font-semibold">Логика:</span> Пессимистичный = история × (инциденты: 1.5×, ущерб: 2.0×, возвратность: 0.7×) ·
              Катастрофический = история × (инциденты: 2.5×, ущерб: 5.0×, возвратность: 0.5×)
            </p>
          </div>
        </div>
      )}

      {/* ═══ МОДЕЛЬ 2 ═══ */}
      {(tab === 2) && (
        <div className={card}>
          <p className="text-base font-semibold text-gray-900 mb-1">What-If матрица</p>
          <p className="text-xs text-gray-500 mb-4">
            Скорректированная прибыль при различных комбинациях ущерба и возвратности.
            Строки 📉 и ⚠️ — автоматически из рассчитанных сценариев.
            {bp > 0 && <span className="font-medium text-gray-700"> · Базовая прибыль: {fmt(bp)} TJS</span>}
          </p>
          {/* ✅ Сводная таблица сценариев */}
          {pess && cat && (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">Сценарий</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide">Сумма ущерба (TJS)</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide">Возвратность</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide">Чистый ущерб (TJS)</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide">Эффект на чистую прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const pessTotal = totalFor(pess)
                    const catTotal  = totalFor(cat)
                    const pessRec = 0.10
                    const catRec  = 0.05
                    const pessNet = pessTotal.loss * (1 - pessRec)
                    const catNet  = catTotal.loss  * (1 - catRec)
                    return (
                      <>
                        <tr className="bg-yellow-50 border-b-2 border-yellow-200">
                          <td className="px-4 py-3 font-semibold text-yellow-800 text-sm">📉 Пессимистичный сценарий</td>
                          <td className="px-4 py-3 text-center text-sm">{fmt(pessTotal.loss)}</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-green-700">{(pessRec*100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-red-600">{fmt(pessNet)}</td>
                          <td className="px-4 py-3 text-center font-bold text-red-700 text-base">({fmt(Math.round(pessNet))})</td>
                        </tr>
                        <tr className="bg-red-50">
                          <td className="px-4 py-3 font-semibold text-red-800 text-sm">⚠️ Катастрофический сценарий</td>
                          <td className="px-4 py-3 text-center text-sm">{fmt(catTotal.loss)}</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-green-700">{(catRec*100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-red-600">{fmt(catNet)}</td>
                          <td className="px-4 py-3 text-center font-bold text-red-700 text-base">({fmt(Math.round(catNet))})</td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {bp === 0 ? (
            <div className="p-8 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-700">Введите базовую прибыль в параметрах выше</p>
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
                      {RECOVERY_COLS.map(r => (
                        <th key={r} className="bg-gray-800 text-white px-3 py-2 text-center whitespace-nowrap">
                          {(r*100).toFixed(0)}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LOSS_ROWS.map((loss, li) => {
                      const isPess = pess && Math.abs(loss - totalFor(pess).loss) < 300000
                      const isCat  = cat  && Math.abs(loss - totalFor(cat).loss)  < 300000
                      const isBudg = Math.abs(loss - totalFor(budget).loss) < 300000
                      const rowBg  = isCat ? 'bg-red-50' : isPess ? 'bg-yellow-50' : isBudg ? 'bg-green-50' : li%2===0 ? 'bg-white' : 'bg-gray-50'
                      return (
                        <tr key={loss} className={rowBg}>
                          <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 sticky left-0 bg-inherit">
                            {fmt(loss)}
                            {isCat  && <span className="ml-1 text-[10px] text-red-500">⚠️</span>}
                            {isPess && !isCat  && <span className="ml-1 text-[10px] text-yellow-500">📉</span>}
                            {isBudg && !isPess && !isCat && <span className="ml-1 text-[10px] text-green-500">📈</span>}
                          </td>
                          {RECOVERY_COLS.map(rec => {
                            const adj = adjProfit(loss, rec)
                            const pct = adj / bp
                            return (
                              <td key={rec} className={`px-2 py-1.5 text-center font-medium whitespace-nowrap
                                ${adj < 0       ? 'text-red-700 bg-red-100'    :
                                  pct < 0.9     ? 'text-yellow-700 bg-yellow-50' :
                                                  'text-green-700'}`}>
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
              {/* Сценарии в матрице */}
              {(pess || cat) && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {pess && (() => {
                    const pessLoss = totalFor(pess).loss
                    const pessRec  = totalFor(pess).recovery
                    const pessAdj  = adjProfit(pessLoss, pessRec)
                    const pessEff  = pessAdj - bp
                    return (
                      <div className="p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                        <p className="text-xs font-bold text-yellow-700 mb-2">📉 Пессимистичный (ущерб: {fmt(pessLoss)} · возвратность: {(pessRec*100).toFixed(0)}%)</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Ущерб:</span><span className="font-medium">{fmt(pessLoss)} TJS</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Возвратность:</span><span className="font-medium">{(pessRec*100).toFixed(0)}%</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Скорр. прибыль:</span><span className={`font-bold ${pessAdj >= 0 ? 'text-yellow-700' : 'text-red-700'}`}>{fmt(pessAdj)} TJS</span></div>
                          <div className="flex justify-between border-t border-yellow-200 pt-1 mt-1"><span className="font-semibold text-gray-700">Эффект на П&У:</span><span className={`font-bold ${pessEff >= 0 ? 'text-green-700' : 'text-red-700'}`}>{pessEff >= 0 ? '+' : ''}{fmt(pessEff)} TJS</span></div>
                        </div>
                      </div>
                    )
                  })()}
                  {cat && (() => {
                    const catLoss = totalFor(cat).loss
                    const catRec  = totalFor(cat).recovery
                    const catAdj  = adjProfit(catLoss, catRec)
                    const catEff  = catAdj - bp
                    return (
                      <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl">
                        <p className="text-xs font-bold text-red-700 mb-2">⚠️ Катастрофический (ущерб: {fmt(catLoss)} · возвратность: {(catRec*100).toFixed(0)}%)</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Ущерб:</span><span className="font-medium">{fmt(catLoss)} TJS</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Возвратность:</span><span className="font-medium">{(catRec*100).toFixed(0)}%</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Скорр. прибыль:</span><span className={`font-bold ${catAdj >= 0 ? 'text-orange-700' : 'text-red-700'}`}>{fmt(catAdj)} TJS</span></div>
                          <div className="flex justify-between border-t border-red-200 pt-1 mt-1"><span className="font-semibold text-gray-700">Эффект на П&У:</span><span className={`font-bold ${catEff >= 0 ? 'text-green-700' : 'text-red-700'}`}>{catEff >= 0 ? '+' : ''}{fmt(catEff)} TJS</span></div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block"/> &gt;90% базовой прибыли</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block"/> 0–90% базовой прибыли</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block"/> Убыток</span>
                <span className="flex items-center gap-1"><span className="text-yellow-500">📉</span> Пессимистичный</span>
                <span className="flex items-center gap-1"><span className="text-red-500">⚠️</span> Катастрофический</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

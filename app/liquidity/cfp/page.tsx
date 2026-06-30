'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, ShieldAlert, CheckCircle, Download } from 'lucide-react'
import { statusCar11, statusCar12, statusCar13, statusK21, normLabel, EWI_EMOJI, type EwiStatus } from '@/lib/cfpCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_MONTHS_FULL  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const ALL_MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
const GAP_ASSETS = ['Денежные средства', 'Ограниченные ден. ср-ва', 'Кредиты выданные']
const GAP_LIAB   = ['Счета клиентов', 'Привлечённые займы', 'Субординированный займ']

// ── Types ─────────────────────────────────────────────────────────────────────
interface FinancingSource {
  priority: number
  source: string
  status: 'available' | 'conditional' | 'unavailable'
  currency: 'TJS' | 'USD' | 'EUR'
  amount: string
  cost: string
  term: string
}

type GapMatrix = string[][]

interface CfpReport {
  id: string
  created_at: string
  report_name: string
  plan_period: string | null
  plan_date: string | null
  car11: number | null
  car12: number | null
  car13: number | null
  k21: number | null
  outflows_data: { rows: number[][]; type?: string } | null
  cfp_results: { buffer?: { cash_equivalents: number; cash_only: number } } | null
  funding_sources: FinancingSource[] | null
  ai_conclusion: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inp     = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white'
const lbl     = 'block text-xs font-medium text-gray-600 mb-1'
const parseN  = (v: string) => Number(String(v).replace(/[^\d.]/g, '')) || 0
const EMPTY_GAP = (): GapMatrix => Array(6).fill(null).map(() => Array(6).fill(''))

const STATUS_COLORS: Record<EwiStatus, string> = {
  green:  'text-[#1B8A4C] bg-green-50 border-green-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  red:    'text-red-700 bg-red-50 border-red-200',
}
const SRC_STATUS_LABEL: Record<string, string> = {
  available: 'Доступен', conditional: 'Условный', unavailable: 'Недоступен',
}
const SRC_STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-100 text-[#1B8A4C]',
  conditional: 'bg-yellow-100 text-yellow-700',
  unavailable: 'bg-red-100 text-red-700',
}

// ── Half-year helper ─────────────────────────────────────────────────────────
function getHalfYearInfo(now: number) {
  const d    = new Date(now)
  const year = d.getFullYear()
  const half = d.getMonth() < 6 ? 1 : 2
  const key  = `H${half}-${year}`
  const end  = new Date(half === 1 ? `${year}-06-30T23:59:59` : `${year}-12-31T23:59:59`)
  const daysLeft = Math.ceil((end.getTime() - now) / 86_400_000)
  return { key, half, year, daysLeft }
}

// ── NormRow ───────────────────────────────────────────────────────────────────
function NormRow({ code, norm, value, status, onChange }: {
  code: string; norm: string; value: string; status: EwiStatus | null; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 px-4">
      <div className="w-16 text-sm font-semibold text-gray-800 flex-shrink-0">{code}</div>
      <div className="w-16 text-xs text-gray-400 flex-shrink-0">{norm}</div>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="text" inputMode="decimal" value={value}
          onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
          placeholder="0.00"
          className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
        />
        <span className="text-base">{value ? (status ? EWI_EMOJI[status] : '○') : '—'}</span>
        {value && status && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_COLORS[status]}`}>
            {normLabel(status)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CfpPage() {
  // list state
  const [reports,     setReports]     = useState<CfpReport[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [viewing,     setViewing]     = useState<CfpReport | null>(null)

  // form fields
  const [planPeriod,   setPlanPeriod]   = useState('')
  const [planDate,     setPlanDate]     = useState('')
  const [car11,        setCar11]        = useState('')
  const [car12,        setCar12]        = useState('')
  const [car13,        setCar13]        = useState('')
  const [k21,          setK21]          = useState('')
  const [gapMatrix,    setGapMatrix]    = useState<GapMatrix>(EMPTY_GAP())
  const [sources,      setSources]      = useState<FinancingSource[]>([
    { priority: 1, source: '', status: 'available', currency: 'TJS', amount: '', cost: '', term: '' },
  ])
  const [bufferCashEq, setBufferCashEq] = useState('')
  const [bufferCash,   setBufferCash]   = useState('')

  // generation
  const [generating,   setGenerating]   = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(() => {
    try { return localStorage.getItem('cfp_draft') } catch { return null }
  })
  const [error,        setError]        = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)

  // half-year alert
  const [hyDismissed, setHyDismissed] = useState<Record<string, boolean>>({})
  const [nowMs,       setNowMs]       = useState(Date.now())

  // computed statuses
  const s11  = car11 ? statusCar11(parseN(car11)) : null
  const s12  = car12 ? statusCar12(parseN(car12)) : null
  const s13  = car13 ? statusCar13(parseN(car13)) : null
  const sk21 = k21   ? statusK21(parseN(k21))     : null

  // ── GAP computed rows ─────────────────────────────────────────────────────
  const colSum = (rowStart: number, rowEnd: number) =>
    Array(6).fill(0).map((_, ci) =>
      gapMatrix.slice(rowStart, rowEnd).reduce((s, r) => s + parseN(r[ci]), 0)
    )
  const assetTotals = colSum(0, 3)
  const liabTotals  = colSum(3, 6)
  const gapRow      = assetTotals.map((a, i) => a - liabTotals[i])

  // ── Dynamic GAP month labels ──────────────────────────────────────────────
  const _gapStart   = planDate ? (new Date(planDate + 'T00:00:00').getMonth() + 1) % 12 : 6
  const gapMonthsFull  = Array.from({ length: 6 }, (_, i) => ALL_MONTHS_FULL[(_gapStart + i) % 12])
  const gapMonthsShort = Array.from({ length: 6 }, (_, i) => ALL_MONTHS_SHORT[(_gapStart + i) % 12])

  // ── Load reports ──────────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    setLoadingList(true)
    const { data } = await supabase.from('cfp_reports').select('*').order('created_at', { ascending: false })
    setReports(data || [])
    setLoadingList(false)
  }, [])
  useEffect(() => { loadReports() }, [loadReports])
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cfp_hy_dismissed')
      if (stored) setHyDismissed(JSON.parse(stored))
    } catch {}
  }, [])
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── GAP cell update ───────────────────────────────────────────────────────
  function setGapCell(row: number, col: number, val: string) {
    setGapMatrix(prev => prev.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? val : c) : r))
  }

  // ── Half-year alert logic ─────────────────────────────────────────────────
  function dismissHY(key: string) {
    const next = { ...hyDismissed, [key]: true }
    setHyDismissed(next)
    localStorage.setItem('cfp_hy_dismissed', JSON.stringify(next))
  }
  const hyInfo = getHalfYearInfo(nowMs)
  const hasPlanForHY = reports.some(r => {
    const ds = r.plan_date || r.created_at
    if (!ds) return false
    const d = new Date(ds)
    return d.getFullYear() === hyInfo.year && (d.getMonth() < 6 ? 1 : 2) === hyInfo.half
  })
  const showHyAlert = !hasPlanForHY && !hyDismissed[hyInfo.key]

  // ── Sources management ────────────────────────────────────────────────────
  function addSource() {
    setSources(prev => [...prev, { priority: prev.length + 1, source: '', status: 'available', currency: 'TJS', amount: '', cost: '', term: '' }])
  }
  function removeSource(idx: number) {
    setSources(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, priority: i + 1 })))
  }
  function updateSource(idx: number, field: keyof FinancingSource, val: string) {
    setSources(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setError(null); setGenerating(true)
    try {
      const body = {
        plan_period: planPeriod,
        plan_date: planDate,
        car11: parseN(car11) || null,
        car12: parseN(car12) || null,
        car13: parseN(car13) || null,
        k21:   parseN(k21)   || null,
        gap_data: { rows: gapMatrix.map(r => r.map(parseN)) },
        financing_sources: sources.filter(s => s.source.trim()),
        liquidity_buffer: { cash_equivalents: parseN(bufferCashEq), cash_only: parseN(bufferCash) },
      }
      const res  = await apiFetch('/api/liquidity/cfp', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGeneratedDoc(data.sections)
      try { localStorage.setItem('cfp_draft', data.sections) } catch { /* ignore */ }
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setGenerating(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!generatedDoc) return
    setSaving(true); setError(null)
    try {
      const name = planPeriod
        ? `CFP · ${planPeriod}`
        : `CFP · ${planDate || new Date().toISOString().slice(0, 10)}`
      const payload = {
        report_name:   name,
        plan_period:   planPeriod   || null,
        plan_date:     planDate     || null,
        car11:         parseN(car11)  || null,
        car12:         parseN(car12)  || null,
        car13:         parseN(car13)  || null,
        k21:           parseN(k21)    || null,
        outflows_data:   { rows: gapMatrix.map(r => r.map(parseN)), type: 'gap' },
        cfp_results:     { buffer: { cash_equivalents: parseN(bufferCashEq), cash_only: parseN(bufferCash) } },
        funding_sources: sources.filter(s => s.source.trim()),
        ai_conclusion:   generatedDoc,
      }
      const { error: dbErr } = await supabase.from('cfp_reports').insert(payload)
      if (dbErr) throw new Error(dbErr.message)
      // reset form
      try { localStorage.removeItem('cfp_draft') } catch { /* ignore */ }
      setGeneratedDoc(null); setPlanPeriod(''); setPlanDate('')
      setCar11(''); setCar12(''); setCar13(''); setK21('')
      setGapMatrix(EMPTY_GAP())
      setSources([{ priority: 1, source: '', status: 'available', currency: 'TJS', amount: '', cost: '', term: '' }])
      setBufferCashEq(''); setBufferCash('')
      loadReports()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Удалить CFP-план?')) return
    await supabase.from('cfp_reports').delete().eq('id', id)
    loadReports()
  }

  // ── Download Word ─────────────────────────────────────────────────────────
  async function downloadWord(r: CfpReport) {
    try {
      const res = await fetch('/api/liquidity/cfp/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: r }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `CFP_${r.report_name}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">План финансирования на ЧС (CFP)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Инструкция №247 НБТ РТ · Contingency Funding Plan</p>
      </div>

      {/* Half-year NBT alert */}
      {showHyAlert && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
          hyInfo.daysLeft <= 7
            ? 'bg-red-50 border-red-300 text-red-800 animate-pulse'
            : hyInfo.daysLeft <= 30
            ? 'bg-orange-50 border-orange-200 text-orange-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <ShieldAlert className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            hyInfo.daysLeft <= 7 ? 'text-red-600' : hyInfo.daysLeft <= 30 ? 'text-orange-500' : 'text-amber-600'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              НБТ: CFP за {hyInfo.half === 1 ? 'I' : 'II'} полугодие {hyInfo.year} не сформирован
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {hyInfo.daysLeft > 0
                ? `До конца полугодия осталось ${hyInfo.daysLeft} ${hyInfo.daysLeft === 1 ? 'день' : hyInfo.daysLeft < 5 ? 'дня' : 'дней'} · Требование Инструкции №247 НБТ РТ`
                : 'Срок полугодия истёк — срочно сформируйте CFP-план согласно Инструкции №247 НБТ РТ'}
            </p>
          </div>
          <button onClick={() => dismissHY(hyInfo.key)}
            className="text-xs underline opacity-60 hover:opacity-100 whitespace-nowrap flex-shrink-0 mt-0.5">
            Понял, не забуду
          </button>
        </div>
      )}

      {/* ── FORM ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

        {/* Period + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Период плана</label>
            <input type="text" value={planPeriod} onChange={e => setPlanPeriod(e.target.value)}
              placeholder="II полугодие 2026" className={inp} />
          </div>
          <div>
            <label className={lbl}>Дата составления</label>
            <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className={inp} />
          </div>
        </div>

        {/* Normatives */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Нормативы капитала и ликвидности</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <NormRow code="CAR 1.1" norm="≥ 12%" value={car11} status={s11}  onChange={setCar11} />
            <NormRow code="CAR 1.2" norm="≥ 10%" value={car12} status={s12}  onChange={setCar12} />
            <NormRow code="CAR 1.3" norm="≥ 10%" value={car13} status={s13}  onChange={setCar13} />
            <NormRow code="К2-1"    norm="≥ 30%" value={k21}   status={sk21} onChange={setK21}   />
          </div>
        </div>

        {/* GAP Table */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ГЭП-таблица (млн TJS) · {gapMonthsFull[0]}–{gapMonthsFull[5]}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-600 font-medium border border-gray-200" style={{ minWidth: 200 }}>Статья</th>
                  {gapMonthsShort.map(m => (
                    <th key={m} className="px-2 py-2 text-gray-600 font-medium text-center border border-gray-200" style={{ minWidth: 76 }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-blue-50/60">
                  <td colSpan={7} className="px-3 py-1.5 text-[11px] font-bold text-blue-700 uppercase tracking-wide border border-gray-200">
                    Активы
                  </td>
                </tr>
                {GAP_ASSETS.map((name, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    <td className="px-3 py-1 text-gray-700 border border-gray-200 bg-white">{name}</td>
                    {Array(6).fill(0).map((_, ci) => (
                      <td key={ci} className="px-1 py-1 border border-gray-200 bg-white">
                        <input type="text" inputMode="decimal" value={gapMatrix[ri][ci]}
                          onChange={e => setGapCell(ri, ci, e.target.value.replace(/[^\d.]/g, ''))}
                          onFocus={() => { const v = parseN(gapMatrix[ri][ci]); setGapCell(ri, ci, v > 0 ? String(v) : '') }}
                          onBlur={() => { const v = Math.round(parseN(gapMatrix[ri][ci])); setGapCell(ri, ci, v > 0 ? v.toLocaleString('ru-RU') : '') }}
                          placeholder="0"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-blue-50/40">
                  <td className="px-3 py-1.5 text-xs font-semibold text-blue-700 border border-gray-200">Итого активы</td>
                  {assetTotals.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-center text-xs font-bold text-blue-700 border border-gray-200">
                      {v > 0 ? v.toLocaleString('ru-RU') : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-red-50/60">
                  <td colSpan={7} className="px-3 py-1.5 text-[11px] font-bold text-red-700 uppercase tracking-wide border border-gray-200">
                    Обязательства
                  </td>
                </tr>
                {GAP_LIAB.map((name, ri) => (
                  <tr key={ri + 3}>
                    <td className="px-3 py-1 text-gray-700 border border-gray-200 bg-white">{name}</td>
                    {Array(6).fill(0).map((_, ci) => (
                      <td key={ci} className="px-1 py-1 border border-gray-200 bg-white">
                        <input type="text" inputMode="decimal" value={gapMatrix[ri + 3][ci]}
                          onChange={e => setGapCell(ri + 3, ci, e.target.value.replace(/[^\d.]/g, ''))}
                          onFocus={() => { const v = parseN(gapMatrix[ri + 3][ci]); setGapCell(ri + 3, ci, v > 0 ? String(v) : '') }}
                          onBlur={() => { const v = Math.round(parseN(gapMatrix[ri + 3][ci])); setGapCell(ri + 3, ci, v > 0 ? v.toLocaleString('ru-RU') : '') }}
                          placeholder="0"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-red-50/40">
                  <td className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-gray-200">Итого обязательства</td>
                  {liabTotals.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-center text-xs font-bold text-red-700 border border-gray-200">
                      {v > 0 ? v.toLocaleString('ru-RU') : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Financing Sources */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Источники финансирования</p>
            <button onClick={addSource}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1B8A4C]/10 text-[#1B8A4C] rounded-lg hover:bg-[#1B8A4C]/20 font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Добавить строку
            </button>
          </div>
          <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-[11px] text-blue-600">Пожалуйста, используйте сокращённые названия источников: «МБК», «НБТ», «Кредитная линия», «Депозит» и т.д.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'Источник', 'Статус', 'Валюта', 'Сумма (млн)', 'Стоимость', 'Срок', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap border border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((s, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-1 text-gray-400 text-center w-6 border border-gray-200 bg-white">{s.priority}</td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <input type="text" value={s.source} onChange={e => updateSource(idx, 'source', e.target.value)}
                        placeholder="Название источника"
                        className={`w-full min-w-[150px] px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-white ${/алиф|alif|бонк/i.test(s.source) ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50' : 'border-gray-200 focus:ring-[#1B8A4C]'}`} />
                      {/алиф|alif|бонк/i.test(s.source) && (
                        <p className="text-[10px] text-blue-500 mt-0.5">Используйте сокращение</p>
                      )}
                    </td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <select value={s.status} onChange={e => updateSource(idx, 'status', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white">
                        <option value="available">Доступен</option>
                        <option value="conditional">Условный</option>
                        <option value="unavailable">Недоступен</option>
                      </select>
                    </td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <select value={s.currency} onChange={e => updateSource(idx, 'currency', e.target.value)}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white">
                        <option value="TJS">TJS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <input type="text" inputMode="numeric" value={s.amount}
                        onChange={e => updateSource(idx, 'amount', e.target.value.replace(/\D/g, ''))}
                        placeholder="0"
                        className="w-24 px-2 py-1.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                    </td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <input type="text" value={s.cost} onChange={e => updateSource(idx, 'cost', e.target.value)}
                        placeholder="8%"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                    </td>
                    <td className="px-1 py-1 border border-gray-200 bg-white">
                      <input type="text" value={s.term} onChange={e => updateSource(idx, 'term', e.target.value)}
                        placeholder="30 дней"
                        className="w-24 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                    </td>
                    <td className="px-2 py-1 text-center border border-gray-200 bg-white">
                      <button onClick={() => removeSource(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Liquidity Buffer */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Буфер ликвидности (млн TJS)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Денежные средства и эквиваленты</label>
              <input type="text" inputMode="numeric" value={bufferCashEq}
                onChange={e => setBufferCashEq(e.target.value.replace(/\D/g, ''))}
                placeholder="0" className={inp + ' text-right'} />
            </div>
            <div>
              <label className={lbl}>Только денежные средства</label>
              <input type="text" inputMode="numeric" value={bufferCash}
                onChange={e => setBufferCash(e.target.value.replace(/\D/g, ''))}
                placeholder="0" className={inp + ' text-right'} />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
        )}

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1B8A4C] text-white rounded-xl text-sm font-semibold hover:bg-[#177040] disabled:opacity-50 transition-colors">
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация CFP...</>
            : <><ShieldAlert className="w-4 h-4" /> Сгенерировать CFP</>}
        </button>
      </div>

      {/* ── Generated Document ──────────────────────────────────────────────── */}
      {generatedDoc && (
        <div className="bg-white rounded-2xl border border-[#1B8A4C]/20 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-green-50/40">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#1B8A4C]" />
              <div>
                <p className="text-sm font-semibold text-gray-900">CFP сгенерирован — 6 разделов</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Инструкция №247 НБТ РТ</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50 transition-colors">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
                : <><CheckCircle className="w-4 h-4" /> Сохранить CFP</>}
            </button>
          </div>
          <div className="p-6">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{generatedDoc}</div>
          </div>
        </div>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">История CFP-планов</h2>
          <p className="text-xs text-gray-400 mt-0.5">{reports.length} сохранено</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Период плана', 'Дата', 'CAR 1.1', 'К2-1', 'Действия'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loadingList
                ? <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300" /></td></tr>
                : reports.length === 0
                ? <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Нет сохранённых CFP-планов</td></tr>
                : reports.map(r => {
                    const rs11  = r.car11 != null ? statusCar11(r.car11) : null
                    const rsk21 = r.k21   != null ? statusK21(r.k21)     : null
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.plan_period || r.report_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {r.plan_date ? new Date(r.plan_date + 'T00:00:00').toLocaleDateString('ru-RU') : new Date(r.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {rs11 ? <span className="font-medium">{r.car11}% {EWI_EMOJI[rs11]}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {rsk21 ? <span className="font-medium">{r.k21}% {EWI_EMOJI[rsk21]}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewing(r)} title="Просмотр"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => downloadWord(r)} title="Скачать Word"
                              className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(r.id)} title="Удалить"
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">{viewing.plan_period || viewing.report_name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {viewing.plan_date
                    ? new Date(viewing.plan_date + 'T00:00:00').toLocaleDateString('ru-RU') + ' · '
                    : ''}
                  Составлен {new Date(viewing.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Normatives */}
              {(viewing.car11 != null || viewing.k21 != null) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Нормативы</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { code: 'CAR 1.1', val: viewing.car11, st: viewing.car11 != null ? statusCar11(viewing.car11) : null },
                      { code: 'CAR 1.2', val: viewing.car12, st: viewing.car12 != null ? statusCar12(viewing.car12) : null },
                      { code: 'CAR 1.3', val: viewing.car13, st: viewing.car13 != null ? statusCar13(viewing.car13) : null },
                      { code: 'К2-1',   val: viewing.k21,   st: viewing.k21   != null ? statusK21(viewing.k21)     : null },
                    ].filter(x => x.val != null && x.st != null).map(({ code, val, st }) => (
                      <div key={code} className={`flex items-center justify-between p-3 rounded-lg border ${STATUS_COLORS[st!]}`}>
                        <div>
                          <p className="text-xs font-medium opacity-70">{code}</p>
                          <p className="text-lg font-bold">{val}%</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl">{EWI_EMOJI[st!]}</div>
                          <p className="text-xs font-semibold mt-0.5">{normLabel(st!)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financing sources */}
              {viewing.funding_sources && viewing.funding_sources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Источники финансирования</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          {['#', 'Источник', 'Статус', 'Валюта', 'Сумма млн', 'Стоимость', 'Срок'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium border border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewing.funding_sources.map((s, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-400 border border-gray-200">{s.priority}</td>
                            <td className="px-3 py-2 font-medium text-gray-700 border border-gray-200">{s.source}</td>
                            <td className="px-3 py-2 border border-gray-200">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${SRC_STATUS_COLOR[s.status] || ''}`}>
                                {SRC_STATUS_LABEL[s.status] || s.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 border border-gray-200">{s.currency}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700 border border-gray-200">{s.amount}</td>
                            <td className="px-3 py-2 text-gray-600 border border-gray-200">{s.cost}</td>
                            <td className="px-3 py-2 text-gray-600 border border-gray-200">{s.term}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Buffer */}
              {viewing.cfp_results?.buffer && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Буфер ликвидности</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-500">ДС и эквиваленты</p>
                      <p className="text-lg font-bold text-[#1B8A4C] mt-0.5">
                        {viewing.cfp_results.buffer.cash_equivalents.toLocaleString('ru-RU')} млн TJS
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-500">Только ДС</p>
                      <p className="text-lg font-bold text-[#1B8A4C] mt-0.5">
                        {viewing.cfp_results.buffer.cash_only.toLocaleString('ru-RU')} млн TJS
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Document */}
              {viewing.ai_conclusion && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" /> CFP · Инструкция №247 НБТ РТ
                  </p>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.ai_conclusion}</div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => downloadWord(viewing!)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <Download className="w-4 h-4" /> Скачать Word
              </button>
              <button onClick={() => setViewing(null)}
                className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

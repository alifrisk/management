'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, ShieldAlert, CheckCircle, Edit2, Download, Filter } from 'lucide-react'
import { statusCar11, statusCar12, statusCar13, statusK21, normLabel, EWI_EMOJI, type EwiStatus } from '@/lib/cfpCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const CFP_BUCKETS = ['Текущая дата', '1–30 дн.', '31–90 дн.', '91–180 дн.', '181–365 дн.', '1–3 года', 'свыше 3 лет']
const CFP_BUCKETS_SHORT = ['Тек.', '1–30', '31–90', '91–180', '181–365', '1–3г', '>3г']

const OUTFLOW_ROWS = [
  'Текущие счета / до востребования',
  'Срочные депозиты физлиц (погашение)',
  'Срочные депозиты юрлиц (погашение)',
  'МБК привлечённые (погашение)',
  'Внебалансовые обязательства',
  'Прочие оттоки',
]
const INFLOW_ROWS = [
  'Наличность и кор. счета НБТ',
  'РЕПО / реализация ценных бумаг',
  'Кредитные линии НБТ',
  'Привлечение новых МБК',
  'Возврат выданных кредитов',
  'Прочие поступления',
]

// ── Types ─────────────────────────────────────────────────────────────────────
type Matrix = string[][]

interface CfpBucket {
  label: string; outflow: number; inflow: number; net: number
  cumulative_net: number; coverage_ratio: number | null; status: EwiStatus
}

interface StoredCfpBucket {
  label: string; outflow: number; inflow: number; net: number
  cumulative_net: number; coverage_ratio: number | null; status: EwiStatus
}

interface CfpReport {
  id: string; report_name: string; analyst_name?: string
  plan_period?: string; plan_date?: string
  car11?: number; car12?: number; car13?: number; k21?: number
  outflows_data?: { rows: number[][] }
  inflows_data?:  { rows: number[][] }
  cfp_results?:   { buckets: StoredCfpBucket[] }
  n1?: number; lcr?: number
  liabilities?: { term_deposits: number; current_accounts: number; interbank: number; other: number }
  funding_sources?: { name: string; amount: number; access_term: string; status: string }[]
  ai_conclusion: string; created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_MATRIX = (): Matrix => Array(6).fill(null).map(() => Array(7).fill(''))
const parseN = (v: string) => Number(String(v).replace(/\s/g, '').replace(/ /g, '')) || 0
const fmtN   = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const fmt    = (n: number) => n !== 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct    = (v: string) => v.replace(/[^\d.,]/g, '').replace(',', '.')
const r50    = (n: number) => Math.round(n / 50) * 50
const fmtM   = (n: number) => n !== 0 ? (n > 0 ? '+' : '') + (n / 1_000_000).toFixed(1) + 'M' : '0'

const inp    = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white'
const inpNum = inp + ' text-right'
const lbl    = 'block text-xs font-medium text-gray-600 mb-1'

const STATUS_COLORS: Record<EwiStatus, string> = {
  green:  'text-[#1B8A4C] bg-green-50 border-green-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  red:    'text-red-700 bg-red-50 border-red-200',
}
const STATUS_STYLE: Record<EwiStatus, { text: string; badge: string; dot: string }> = {
  green:  { text: 'text-[#1B8A4C]', badge: 'bg-green-100 text-[#1B8A4C]',   dot: 'bg-green-500' },
  yellow: { text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  red:    { text: 'text-red-700',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
}
const STATUS_LABEL: Record<EwiStatus, string> = { green: 'Профицит', yellow: 'Внимание', red: 'Дефицит' }
const STATUS_COLOR_HEX: Record<EwiStatus, string> = { green: '#1B8A4C', yellow: '#D97706', red: '#DC2626' }

function calcCfpStatus(net: number, outflow: number): EwiStatus {
  if (net >= 0) return 'green'
  if (outflow > 0 && Math.abs(net) <= outflow * 0.2) return 'yellow'
  return 'red'
}

function calcCfp(outflows: Matrix, inflows: Matrix): CfpBucket[] {
  const buckets = CFP_BUCKETS.map((label, b) => {
    const totalOut = outflows.reduce((s, row) => s + parseN(row[b] || ''), 0)
    const totalIn  = inflows.reduce((s, row) => s + parseN(row[b] || ''), 0)
    const net = totalIn - totalOut
    return { label, outflow: totalOut, inflow: totalIn, net, cumulative_net: 0,
      coverage_ratio: totalOut > 0 ? (totalIn / totalOut) * 100 : null,
      status: calcCfpStatus(net, totalOut) }
  })
  let cum = 0
  return buckets.map(b => { cum += b.net; return { ...b, cumulative_net: cum } })
}

// ── Sub-components ────────────────────────────────────────────────────────────
function NormRow({ code, formula, norm, value, status, onChange }: {
  code: string; formula: string; norm: string; value: string; status: EwiStatus | null; onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 border-b border-gray-100 last:border-0">
      <div className="col-span-4">
        <p className="text-sm font-semibold text-gray-800">{code}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{formula}</p>
      </div>
      <div className="col-span-2 text-xs text-gray-500 font-medium">{norm}</div>
      <div className="col-span-3">
        <div className="flex items-center gap-1.5">
          <input type="text" inputMode="decimal" value={value} onChange={e => onChange(pct(e.target.value))}
            placeholder="0.00" className={inpNum + ' flex-1'} />
          <span className="text-base flex-shrink-0">{value ? (status ? EWI_EMOJI[status] : '○') : '—'}</span>
        </div>
      </div>
      <div className="col-span-3">
        {value && status && (
          <span className={`inline-flex items-center px-2 py-1 rounded-lg border text-xs font-medium ${STATUS_COLORS[status]}`}>
            {normLabel(status)}
          </span>
        )}
      </div>
    </div>
  )
}

function NormBadge({ code, value, status }: { code: string; value: number; status: EwiStatus }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${STATUS_COLORS[status]}`}>
      <div>
        <p className="text-xs font-medium opacity-70">{code}</p>
        <p className="text-lg font-bold">{value}%</p>
      </div>
      <div className="text-right">
        <div className="text-xl">{EWI_EMOJI[status]}</div>
        <p className="text-xs font-semibold mt-0.5">{normLabel(status)}</p>
      </div>
    </div>
  )
}

function CfpInputTable({ rows, matrix, setMatrix, headerColor, totalColor, totalLabel }: {
  rows: string[]; matrix: Matrix; setMatrix: (m: Matrix) => void
  headerColor: string; totalColor: string; totalLabel: string
}) {
  function setCell(ri: number, bi: number, val: string) {
    setMatrix(matrix.map((r, i) => i === ri ? r.map((c, j) => j === bi ? fmtN(val) : c) : r))
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className={headerColor}>
            <th className="text-left px-3 py-2.5 text-gray-700 font-semibold" style={{ minWidth: 200 }}>Статья</th>
            {CFP_BUCKETS.map(b => (
              <th key={b} className="px-1 py-2.5 text-gray-600 font-medium whitespace-nowrap text-center" style={{ minWidth: 90 }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((label, ri) => (
            <tr key={ri} className="hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-gray-700 font-medium">{label}</td>
              {CFP_BUCKETS.map((_, bi) => (
                <td key={bi} className="px-1 py-1">
                  <input type="text" inputMode="numeric" value={matrix[ri][bi]}
                    onChange={e => setCell(ri, bi, e.target.value)} placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                </td>
              ))}
            </tr>
          ))}
          <tr className={`font-semibold ${totalColor}`}>
            <td className="px-3 py-2.5 whitespace-nowrap">{totalLabel}</td>
            {CFP_BUCKETS.map((_, bi) => {
              const total = matrix.reduce((s, row) => s + parseN(row[bi] || ''), 0)
              return <td key={bi} className="px-2 py-2.5 text-center font-bold">{total > 0 ? fmt(total) : '—'}</td>
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CfpResultsTable({ computed }: { computed: CfpBucket[] }) {
  const rows = [
    { label: 'Оттоки (млн TJS)',             vals: computed.map(c => fmt(c.outflow)),         color: 'out',   bold: false },
    { label: 'Поступления (млн TJS)',         vals: computed.map(c => fmt(c.inflow)),           color: 'in',    bold: false },
    { label: 'Чистая позиция (млн TJS)',      vals: computed.map(c => (c.net >= 0 ? '+' : '') + fmt(c.net)),  color: 'net',   bold: true },
    { label: 'Накопленная позиция (млн TJS)', vals: computed.map(c => (c.cumulative_net >= 0 ? '+' : '') + fmt(c.cumulative_net)), color: 'cumul', bold: true },
    { label: 'Покрытие (%)',                  vals: computed.map(c => c.coverage_ratio != null ? c.coverage_ratio.toFixed(1) + '%' : '—'), color: '', bold: false },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-3 py-2.5 font-medium text-gray-500" style={{ minWidth: 200 }}>Показатель</th>
            {CFP_BUCKETS.map(b => <th key={b} className="px-2 py-2.5 font-medium text-gray-500 whitespace-nowrap text-center" style={{ minWidth: 90 }}>{b}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.label} className={row.bold ? 'bg-gray-50/60' : ''}>
              <td className={`px-3 py-2 ${row.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{row.label}</td>
              {computed.map((c, i) => {
                const cls = row.color === 'net'   ? STATUS_STYLE[c.status].text
                  : row.color === 'cumul' ? (c.cumulative_net >= 0 ? 'text-[#1B8A4C]' : 'text-red-600')
                  : row.color === 'out'   ? 'text-red-600'
                  : row.color === 'in'    ? 'text-[#1B8A4C]'
                  : 'text-gray-700'
                return <td key={i} className={`px-2 py-2 text-center font-medium ${cls}`}>{row.vals[i]}</td>
              })}
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2 text-gray-500">Статус</td>
            {computed.map((c, i) => (
              <td key={i} className="px-2 py-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[c.status].badge}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CfpBarChart({ buckets }: { buckets: CfpBucket[] | StoredCfpBucket[] }) {
  const PAD = 10, BAR_W = 44, BAR_G = 14, HALF_H = 90, LBL_H = 20, VAL_H = 14
  const totalW = PAD * 2 + buckets.length * (BAR_W + BAR_G) - BAR_G
  const totalH = VAL_H + HALF_H * 2 + LBL_H
  const midY   = VAL_H + HALF_H
  const maxAbs = Math.max(...buckets.map(b => Math.abs(b.cumulative_net)), 1)
  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full" style={{ height: 200 }}>
      <line x1={0} y1={midY} x2={totalW} y2={midY} stroke="#E5E7EB" strokeWidth={1.5} />
      {buckets.map((b, i) => {
        const val = b.cumulative_net
        const h   = Math.max(Math.abs(val) / maxAbs * (HALF_H - 10), val !== 0 ? 3 : 0)
        const isP = val >= 0
        const x   = PAD + i * (BAR_W + BAR_G)
        const y   = isP ? midY - h : midY
        const col = STATUS_COLOR_HEX[b.status]
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={h} fill={col} rx={3} opacity={0.85} />
            <text x={x + BAR_W / 2} y={totalH - 2} textAnchor="middle" fontSize={8} fill="#9CA3AF">{CFP_BUCKETS_SHORT[i]}</text>
            {val !== 0 && (
              <text x={x + BAR_W / 2} y={isP ? y - 3 : y + h + 11} textAnchor="middle" fontSize={8} fill={col} fontWeight="bold">
                {fmtM(val)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
      {([['#1B8A4C','Профицит ликвидности'],['#D97706','Дефицит ≤ 20% оттоков'],['#DC2626','Дефицит > 20% оттоков']] as [string,string][]).map(([c,l]) => (
        <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CfpPage() {
  const [reports,      setReports]      = useState<CfpReport[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [viewing,      setViewing]      = useState<CfpReport | null>(null)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [tab,          setTab]          = useState(1)
  const [generating,   setGenerating]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [showWarning,  setShowWarning]  = useState(false)
  const [filterYear,   setFilterYear]   = useState('')
  const [filterMonth,  setFilterMonth]  = useState('')

  const [form, setForm] = useState({ report_name:'', analyst_name:'', plan_period:'', plan_date:'', car11:'', car12:'', car13:'', k21:'' })
  const [outflows, setOutflows] = useState<Matrix>(EMPTY_MATRIX())
  const [inflows,  setInflows]  = useState<Matrix>(EMPTY_MATRIX())

  const setF  = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fp    = (k: keyof typeof form) => Number(form[k]) || 0
  const computed = calcCfp(outflows, inflows)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('cfp_reports').select('*').order('created_at', { ascending: false })
    if (filterYear) {
      const m = filterMonth ? filterMonth.padStart(2, '0') : null
      query = m
        ? query.gte('created_at', `${filterYear}-${m}-01`).lte('created_at', `${filterYear}-${m}-31`)
        : query.gte('created_at', `${filterYear}-01-01`).lte('created_at', `${filterYear}-12-31`)
    }
    const { data } = await query
    setReports(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])
  useEffect(() => { fetch_() }, [fetch_])

  function resetModal() {
    setForm({ report_name:'', analyst_name:'', plan_period:'', plan_date:'', car11:'', car12:'', car13:'', k21:'' })
    setOutflows(EMPTY_MATRIX()); setInflows(EMPTY_MATRIX())
    setEditingId(null); setTab(1); setGeneratedDoc(null); setError(null)
  }

  function handleEdit(r: CfpReport) {
    setEditingId(r.id)
    setForm({
      report_name: r.report_name||'', analyst_name: r.analyst_name||'',
      plan_period: r.plan_period||'', plan_date: r.plan_date||'',
      car11: r.car11 != null ? String(r.car11) : '',
      car12: r.car12 != null ? String(r.car12) : '',
      car13: r.car13 != null ? String(r.car13) : '',
      k21:   r.k21   != null ? String(r.k21)   : '',
    })
    setOutflows(r.outflows_data?.rows ? r.outflows_data.rows.map(row => row.map(v => v ? fmtN(String(v)) : '')) : EMPTY_MATRIX())
    setInflows(r.inflows_data?.rows   ? r.inflows_data.rows.map(row => row.map(v => v ? fmtN(String(v)) : '')) : EMPTY_MATRIX())
    setGeneratedDoc(r.ai_conclusion || null)
    setTab(1); setError(null); setShowModal(true)
  }

  function handleGenerate() {
    if (!form.report_name.trim()) { setError('Введите название плана'); return }
    setError(null); setShowWarning(true)
  }

  async function confirmGenerate() {
    setShowWarning(false); setGenerating(true); setError(null)
    try {
      const res = await apiFetch('/api/liquidity/cfp', {
        method: 'POST',
        body: JSON.stringify({
          report_name: form.report_name, analyst_name: form.analyst_name,
          plan_period: form.plan_period, plan_date: form.plan_date,
          car11: fp('car11'), car12: fp('car12'), car13: fp('car13'), k21: fp('k21'),
          outflows_data: { rows: outflows.map(row => row.map(parseN)) },
          inflows_data:  { rows: inflows.map(row => row.map(parseN)) },
          cfp_buckets: computed.map(c => ({ label: c.label, outflow: c.outflow, inflow: c.inflow, net: c.net, cumulative_net: c.cumulative_net, status: c.status })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGeneratedDoc(data.conclusion); setTab(5)
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function handleSave() {
    if (!generatedDoc) return
    setSaving(true)
    try {
      const buckets: StoredCfpBucket[] = computed.map(c => ({
        label: c.label, outflow: c.outflow, inflow: c.inflow, net: c.net,
        cumulative_net: c.cumulative_net, coverage_ratio: c.coverage_ratio, status: c.status,
      }))
      const payload = {
        report_name: form.report_name, analyst_name: form.analyst_name,
        plan_period: form.plan_period, plan_date: form.plan_date,
        car11: fp('car11'), car12: fp('car12'), car13: fp('car13'), k21: fp('k21'),
        outflows_data: { rows: outflows.map(row => row.map(parseN)) },
        inflows_data:  { rows: inflows.map(row => row.map(parseN)) },
        cfp_results: { buckets },
        ai_conclusion: generatedDoc,
      }
      const { error: dbErr } = editingId
        ? await supabase.from('cfp_reports').update(payload).eq('id', editingId)
        : await supabase.from('cfp_reports').insert(payload)
      if (dbErr) throw new Error(dbErr.message)
      setShowModal(false); resetModal(); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить CFP-план?')) return
    await supabase.from('cfp_reports').delete().eq('id', id); fetch_()
  }

  async function downloadWord(r: CfpReport) {
    try {
      const res = await fetch('/api/liquidity/cfp/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: r }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `CFP_${r.report_name}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  const s11  = form.car11 ? statusCar11(fp('car11')) : null
  const s12  = form.car12 ? statusCar12(fp('car12')) : null
  const s13  = form.car13 ? statusCar13(fp('car13')) : null
  const sk21 = form.k21   ? statusK21(fp('k21'))     : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">План финансирования на ЧС (CFP)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contingency Funding Plan · Срочные корзины · Инструкция НБТ №247</p>
        </div>
        <button onClick={() => { resetModal(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый CFP
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Всего планов', value: reports.length, c: 'text-gray-900' },
          { label: 'Нормативы соблюдены', value: reports.filter(r => r.car11 != null && [statusCar11(r.car11), statusCar12(r.car12||0), statusCar13(r.car13||0), statusK21(r.k21||0)].every(s => s !== 'red')).length, c: 'text-[#1B8A4C]' },
          { label: 'Нарушение нормативов', value: reports.filter(r => r.car11 != null && [statusCar11(r.car11), statusCar12(r.car12||0), statusCar13(r.car13||0), statusK21(r.k21||0)].includes('red')).length, c: 'text-red-600' },
          { label: 'Дефицит по корзинам', value: reports.filter(r => r.cfp_results?.buckets?.some(b => b.status === 'red')).length, c: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
          <option value="">Все годы</option>
          {[2024,2025,2026,2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!filterYear}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] disabled:opacity-40">
          <option value="">Все месяцы</option>
          {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth('') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Название плана','Аналитик','Период','CAR 1.1','К2-1','CFP по корзинам','Дата',''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
                : reports.length === 0
                ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Нет CFP-планов</p>
                  </td></tr>
                : reports.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-semibold text-gray-900">{r.report_name}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.analyst_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.plan_period || '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {r.car11 != null ? <><span className="font-medium">{r.car11}%</span><span className="ml-1">{EWI_EMOJI[statusCar11(r.car11)]}</span></> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {r.k21 != null ? <><span className="font-medium">{r.k21}%</span><span className="ml-1">{EWI_EMOJI[statusK21(r.k21)]}</span></> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {r.cfp_results?.buckets ? (
                        <div className="flex items-center gap-0.5">
                          {r.cfp_results.buckets.map((b, i) => (
                            <div key={i} title={`${CFP_BUCKETS[i]}: ${STATUS_LABEL[b.status]}`}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white ${STATUS_STYLE[b.status].dot}`}>
                              {i + 1}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-gray-300 text-xs">нет данных</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Просмотр"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Изменить"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadWord(r)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg" title="Скачать Word"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Modal ─────────────────────────────────────────────────────────── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">{viewing.report_name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  {viewing.analyst_name && <span>{viewing.analyst_name}</span>}
                  {viewing.plan_period  && <span>· {viewing.plan_period}</span>}
                  {viewing.plan_date    && <span>· {viewing.plan_date}</span>}
                </div>
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {viewing.car11 != null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Нормативы НБТ</p>
                  <div className="grid grid-cols-2 gap-3">
                    <NormBadge code="CAR 1.1 = Кр / Ар × 100%"  value={viewing.car11||0} status={statusCar11(viewing.car11||0)} />
                    <NormBadge code="CAR 1.2 = Кр / А × 100%"   value={viewing.car12||0} status={statusCar12(viewing.car12||0)} />
                    <NormBadge code="CAR 1.3 = Чок / Ар × 100%" value={viewing.car13||0} status={statusCar13(viewing.car13||0)} />
                    <NormBadge code="К2-1 = ЛАТ / ОВТ × 100%"   value={viewing.k21||0}  status={statusK21(viewing.k21||0)}  />
                  </div>
                </div>
              )}
              {viewing.cfp_results?.buckets && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">CFP — позиция по временным корзинам</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                      <thead><tr className="bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500" style={{ minWidth: 180 }}>Показатель</th>
                        {CFP_BUCKETS.map(b => <th key={b} className="px-2 py-2.5 font-medium text-gray-500 whitespace-nowrap text-center" style={{ minWidth: 86 }}>{b}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { label: 'Оттоки (TJS)',             vals: viewing.cfp_results.buckets.map(b => fmt(b.outflow)),         cls: () => 'text-red-600',   bold: false },
                          { label: 'Поступления (TJS)',         vals: viewing.cfp_results.buckets.map(b => fmt(b.inflow)),           cls: () => 'text-[#1B8A4C]', bold: false },
                          { label: 'Чистая позиция (TJS)',      vals: viewing.cfp_results.buckets.map(b => (b.net >= 0 ? '+' : '') + fmt(b.net)), cls: (b: StoredCfpBucket) => STATUS_STYLE[b.status].text, bold: true },
                          { label: 'Накопленная позиция (TJS)', vals: viewing.cfp_results.buckets.map(b => (b.cumulative_net >= 0 ? '+' : '') + fmt(b.cumulative_net)), cls: (b: StoredCfpBucket) => b.cumulative_net >= 0 ? 'text-[#1B8A4C]' : 'text-red-600', bold: true },
                          { label: 'Покрытие (%)',              vals: viewing.cfp_results.buckets.map(b => b.coverage_ratio != null ? b.coverage_ratio.toFixed(1) + '%' : '—'), cls: () => 'text-gray-700', bold: false },
                        ].map(row => (
                          <tr key={row.label} className={row.bold ? 'bg-gray-50/60' : ''}>
                            <td className={`px-3 py-2 ${row.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{row.label}</td>
                            {viewing.cfp_results!.buckets.map((b, i) => (
                              <td key={i} className={`px-2 py-2 text-center font-medium ${row.cls(b)}`}>{row.vals[i]}</td>
                            ))}
                          </tr>
                        ))}
                        <tr>
                          <td className="px-3 py-2 text-gray-500">Статус</td>
                          {viewing.cfp_results.buckets.map((b, i) => (
                            <td key={i} className="px-2 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[b.status].badge}`}>{STATUS_LABEL[b.status]}</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Накопленная позиция CFP</p>
                    <CfpBarChart buckets={viewing.cfp_results.buckets} />
                    <ChartLegend />
                  </div>
                </div>
              )}
              {viewing.ai_conclusion && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" /> CFP — Инструкция НБТ №247
                  </p>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.ai_conclusion}</div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Warning Modal ──────────────────────────────────────────────────────── */}
      {showWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Данные, передаваемые ИИ</h3>
              <p className="text-xs text-gray-500 mt-1">Суммы округлены до ближайших 50 млн TJS.</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Нормативы (точные, %)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{code:'CAR 1.1',val:form.car11,norm:'≥12%'},{code:'CAR 1.2',val:form.car12,norm:'≥10%'},{code:'CAR 1.3',val:form.car13,norm:'≥10%'},{code:'К2-1',val:form.k21,norm:'≥30%'}].map(({ code, val, norm }) => (
                    <div key={code} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-500">{code} <span className="text-gray-400">({norm})</span></span>
                      <span className="text-xs font-semibold">{val || '—'}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {computed.some(b => b.outflow > 0 || b.inflow > 0) && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">CFP по корзинам (округлено ~50 млн)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                      <thead><tr className="bg-gray-50">
                        <th className="text-left px-2 py-1.5 text-gray-500">Корзина</th>
                        <th className="px-2 py-1.5 text-gray-500 text-center">Оттоки</th>
                        <th className="px-2 py-1.5 text-gray-500 text-center">Поступления</th>
                        <th className="px-2 py-1.5 text-gray-500 text-center">Чистая</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {computed.map((b, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{CFP_BUCKETS_SHORT[i]}</td>
                            <td className="px-2 py-1.5 text-center text-red-600">~{fmt(r50(b.outflow))}</td>
                            <td className="px-2 py-1.5 text-center text-[#1B8A4C]">~{fmt(r50(b.inflow))}</td>
                            <td className={`px-2 py-1.5 text-center font-medium ${STATUS_STYLE[b.status].text}`}>
                              {(b.net >= 0 ? '+' : '') + fmt(r50(b.net))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-100 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-green-800 space-y-0.5">
                  <p className="font-semibold">Защита данных</p>
                  <p>Название и реквизиты банка не передаются.</p>
                  <p>Суммы округлены до ±50 млн TJS.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowWarning(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={confirmGenerate} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                <ShieldAlert className="w-4 h-4" /> Подтвердить и сгенерировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">{editingId ? 'Изменить CFP' : 'Новый CFP'} · Инструкция НБТ №247</h2>
                <p className="text-xs text-gray-500 mt-0.5">Анализ ликвидности по временным корзинам</p>
              </div>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex border-b border-gray-100 px-5 gap-0 overflow-x-auto">
              {[{n:1,t:'Нормативы'},{n:2,t:'Оттоки'},{n:3,t:'Поступления'},{n:4,t:'Результаты'},{n:5,t:'CFP-документ'}].map(t => (
                <button key={t.n} onClick={() => setTab(t.n)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.n}. {t.t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              {tab === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Название плана *</label><input type="text" value={form.report_name} onChange={e => setF('report_name', e.target.value)} placeholder="CFP 2026" className={inp} /></div>
                    <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                    <div><label className={lbl}>Период действия</label><input type="text" value={form.plan_period} onChange={e => setF('plan_period', e.target.value)} placeholder="2026–2027" className={inp} /></div>
                    <div><label className={lbl}>Дата составления</label><input type="date" value={form.plan_date} onChange={e => setF('plan_date', e.target.value)} className={inp} /></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Обязательные нормативы НБТ</p>
                    <p className="text-[11px] text-gray-400 mb-3">Инструкция №176 (достаточность капитала) · Инструкция №247 (ликвидность)</p>
                    <div className="grid grid-cols-12 gap-3 px-1 mb-1">
                      <div className="col-span-4 text-[10px] font-medium text-gray-400 uppercase">Норматив / Формула</div>
                      <div className="col-span-2 text-[10px] font-medium text-gray-400 uppercase">Норма НБТ</div>
                      <div className="col-span-3 text-[10px] font-medium text-gray-400 uppercase">Значение %</div>
                      <div className="col-span-3 text-[10px] font-medium text-gray-400 uppercase">Статус</div>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                      <NormRow code="CAR 1.1" formula="Кр / Ар × 100%"   norm="≥ 12%" value={form.car11} status={s11}  onChange={v => setF('car11', v)} />
                      <NormRow code="CAR 1.2" formula="Кр / А × 100%"    norm="≥ 10%" value={form.car12} status={s12}  onChange={v => setF('car12', v)} />
                      <NormRow code="CAR 1.3" formula="Чок / Ар × 100%"  norm="≥ 10%" value={form.car13} status={s13}  onChange={v => setF('car13', v)} />
                      <NormRow code="К2-1"    formula="ЛАТ / ОВТ × 100%" norm="≥ 30%" value={form.k21}   status={sk21} onChange={v => setF('k21',   v)} />
                    </div>
                  </div>
                </>
              )}

              {tab === 2 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Потребности в финансировании / Оттоки (млн TJS)</p>
                  <p className="text-[11px] text-gray-400 mb-3">Распределите обязательства по срокам погашения.</p>
                  <CfpInputTable rows={OUTFLOW_ROWS} matrix={outflows} setMatrix={setOutflows}
                    headerColor="bg-red-50/50" totalColor="bg-red-50/40 text-red-700" totalLabel="ИТОГО ОТТОКИ" />
                </div>
              )}

              {tab === 3 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Источники финансирования / Поступления (млн TJS)</p>
                  <p className="text-[11px] text-gray-400 mb-3">Распределите доступные источники ликвидности по корзинам.</p>
                  <CfpInputTable rows={INFLOW_ROWS} matrix={inflows} setMatrix={setInflows}
                    headerColor="bg-[#1B8A4C]/8" totalColor="bg-[#1B8A4C]/5 text-[#1B8A4C]" totalLabel="ИТОГО ПОСТУПЛЕНИЯ" />
                </div>
              )}

              {tab === 4 && (
                <div className="space-y-5">
                  <CfpResultsTable computed={computed} />
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Накопленная позиция CFP по временным корзинам</p>
                    <CfpBarChart buckets={computed} />
                    <ChartLegend />
                  </div>
                </div>
              )}

              {tab === 5 && (
                <div>
                  {!generatedDoc ? (
                    <div className="text-center py-16 text-gray-400">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">CFP-документ ещё не сгенерирован</p>
                      <p className="text-xs mt-1">Перейдите на вкладку «Результаты» и нажмите «Сгенерировать»</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" /> ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧС · Инструкция НБТ №247
                      </p>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{generatedDoc}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); resetModal() }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <div className="flex items-center gap-2">
                {tab > 1 && <button onClick={() => setTab(tab - 1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}
                {tab < 4 && <button onClick={() => setTab(tab + 1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>}
                {tab === 4 && (
                  <button onClick={handleGenerate} disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</> : <><ShieldAlert className="w-4 h-4" /> {editingId ? 'Перегенерировать CFP' : 'Сгенерировать CFP'}</>}
                  </button>
                )}
                {tab === 5 && generatedDoc && (
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</> : <><CheckCircle className="w-4 h-4" /> {editingId ? 'Сохранить изменения' : 'Сохранить CFP'}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

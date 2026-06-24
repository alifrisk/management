'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Eye, Trash2, X, Loader2, CheckCircle, GitMerge, Download, Filter } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const BUCKETS = ['до 1 дня', '2–7 дней', '8–30 дней', '31–90 дней', '91–180 дней', '181–365 дней', 'свыше 1 года']
const BUCKETS_SHORT = ['≤1д', '2–7д', '8–30д', '31–90д', '91–180д', '181–365д', '>1г']

const ASSET_ROWS = [
  'Наличность и кор.счета',
  'Краткосрочные МБК размещённые',
  'Ценные бумаги НБТ/ГКО',
  'Кредиты юрлицам',
  'Кредиты физлицам',
  'Прочие активы',
]

const LIABILITY_ROWS = [
  'Текущие счета клиентов',
  'Срочные депозиты физлиц',
  'Срочные депозиты юрлиц',
  'МБК привлечённые',
  'Выпущенные долговые бумаги',
  'Прочие обязательства',
]

type EwiStatus = 'green' | 'yellow' | 'red'
type Matrix = string[][]

const EMPTY_MATRIX = (): Matrix => Array(6).fill(null).map(() => Array(7).fill(''))

// ── Types ──────────────────────────────────────────────────────────────────────
interface StoredBucket {
  label: string
  assets: number
  liabilities: number
  gap: number
  cumulative_gap: number
  liquidity_ratio: number | null
  status: EwiStatus
}

interface GapReport {
  id: string
  created_at: string
  analyst_name: string
  period_date: string
  assets_data: { rows: number[][] }
  liabilities_data: { rows: number[][] }
  gap_results: { buckets: StoredBucket[] }
}

interface ComputedBucket {
  label: string
  assets: number
  liabilities: number
  gap: number
  cumulative_gap: number
  ratio: number | null
  status: EwiStatus
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const parseN  = (v: string) => Number(v.replace(/\s/g, '')) || 0
const fmtN    = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const fmt     = (n: number) => n !== 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtM    = (n: number) => n !== 0 ? (n > 0 ? '+' : '') + (n / 1_000_000).toFixed(1) + 'M' : '0'

const STATUS_STYLE: Record<EwiStatus, { text: string; badge: string }> = {
  green:  { text: 'text-[#1B8A4C]', badge: 'bg-green-100 text-[#1B8A4C]'   },
  yellow: { text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  red:    { text: 'text-red-700',    badge: 'bg-red-100 text-red-700'       },
}
const STATUS_LABEL: Record<EwiStatus, string> = { green: 'Норма', yellow: 'Внимание', red: 'Дефицит' }
const STATUS_COLOR: Record<EwiStatus, string>  = { green: '#1B8A4C', yellow: '#D97706', red: '#DC2626' }

function calcGapStatus(gap: number, liabilities: number): EwiStatus {
  if (gap >= 0) return 'green'
  if (Math.abs(gap) <= liabilities * 0.1) return 'yellow'
  return 'red'
}

function calcGap(assets: Matrix, liabilities: Matrix): ComputedBucket[] {
  const buckets = BUCKETS.map((label, b) => {
    const totalA = assets.reduce((s, row) => s + parseN(row[b] || ''), 0)
    const totalL = liabilities.reduce((s, row) => s + parseN(row[b] || ''), 0)
    const gap    = totalA - totalL
    return { label, assets: totalA, liabilities: totalL, gap, ratio: totalL > 0 ? (totalA / totalL) * 100 : null, status: calcGapStatus(gap, totalL) }
  })
  let cumulative = 0
  return buckets.map(b => { cumulative += b.gap; return { ...b, cumulative_gap: cumulative } })
}

// ── Bar Chart ──────────────────────────────────────────────────────────────────
function GapBarChart({ buckets }: { buckets: { gap: number; cumulative_gap: number; status: EwiStatus }[] }) {
  const PAD    = 10
  const BAR_W  = 44
  const BAR_G  = 14
  const HALF_H = 90
  const LBL_H  = 20
  const VAL_H  = 14
  const totalW = PAD * 2 + buckets.length * (BAR_W + BAR_G) - BAR_G
  const totalH = VAL_H + HALF_H * 2 + LBL_H
  const midY   = VAL_H + HALF_H
  const maxAbs = Math.max(...buckets.map(b => Math.abs(b.cumulative_gap)), 1)

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full" style={{ height: 200 }}>
      <line x1={0} y1={midY} x2={totalW} y2={midY} stroke="#E5E7EB" strokeWidth={1.5} />
      {buckets.map((b, i) => {
        const val  = b.cumulative_gap
        const h    = Math.max(Math.abs(val) / maxAbs * (HALF_H - 10), val !== 0 ? 3 : 0)
        const isP  = val >= 0
        const x    = PAD + i * (BAR_W + BAR_G)
        const y    = isP ? midY - h : midY
        const col  = STATUS_COLOR[b.status]
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={h} fill={col} rx={3} opacity={0.85} />
            <text x={x + BAR_W / 2} y={totalH - 2} textAnchor="middle" fontSize={8} fill="#9CA3AF">{BUCKETS_SHORT[i]}</text>
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

// ── Input table ────────────────────────────────────────────────────────────────
function InputTable({
  rows, matrix, setMatrix, headerColor, totalColor, totalLabel,
}: {
  rows: string[]
  matrix: Matrix
  setMatrix: (m: Matrix) => void
  headerColor: string
  totalColor: string
  totalLabel: string
}) {
  function setCell(ri: number, bi: number, val: string) {
    setMatrix(matrix.map((r, i) => i === ri ? r.map((c, j) => j === bi ? fmtN(val) : c) : r))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className={headerColor}>
            <th className="text-left px-3 py-2.5 text-gray-700 font-semibold" style={{ minWidth: 190 }}>Статья</th>
            {BUCKETS.map(b => (
              <th key={b} className="px-1 py-2.5 text-gray-600 font-medium whitespace-nowrap text-center" style={{ minWidth: 92 }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((label, ri) => (
            <tr key={ri} className="hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">{label}</td>
              {BUCKETS.map((_, bi) => (
                <td key={bi} className="px-1 py-1">
                  <input
                    type="text" inputMode="numeric"
                    value={matrix[ri][bi]}
                    onChange={e => setCell(ri, bi, e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white"
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className={`font-semibold ${totalColor}`}>
            <td className="px-3 py-2.5 whitespace-nowrap">{totalLabel}</td>
            {BUCKETS.map((_, bi) => {
              const total = matrix.reduce((s, row) => s + parseN(row[bi] || ''), 0)
              return <td key={bi} className="px-2 py-2.5 text-center font-bold">{total > 0 ? fmt(total) : '—'}</td>
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Results Table ──────────────────────────────────────────────────────────────
function ResultsTable({ computed }: { computed: ComputedBucket[] }) {
  const rows = [
    { label: 'Активы (TJS)',             vals: computed.map(c => fmt(c.assets)),          color: '' },
    { label: 'Обязательства (TJS)',       vals: computed.map(c => fmt(c.liabilities)),     color: '' },
    { label: 'ГЭП (TJS)',                 vals: computed.map(c => (c.gap >= 0 ? '+' : '') + fmt(c.gap)),             color: 'status', bold: true },
    { label: 'Накопленный ГЭП (TJS)',     vals: computed.map(c => (c.cumulative_gap >= 0 ? '+' : '') + fmt(c.cumulative_gap)), color: 'cumul',  bold: true },
    { label: 'Коэф. ликвидности (%)',     vals: computed.map(c => c.ratio != null ? c.ratio.toFixed(1) + '%' : '—'), color: '' },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-3 py-2.5 font-medium text-gray-500" style={{ minWidth: 190 }}>Показатель</th>
            {BUCKETS.map(b => <th key={b} className="px-2 py-2.5 font-medium text-gray-500 whitespace-nowrap text-center" style={{ minWidth: 88 }}>{b}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.label} className={row.bold ? 'bg-gray-50/60' : ''}>
              <td className={`px-3 py-2 ${row.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{row.label}</td>
              {computed.map((c, i) => {
                const cls = row.color === 'status' ? STATUS_STYLE[c.status].text
                  : row.color === 'cumul' ? (c.cumulative_gap >= 0 ? 'text-[#1B8A4C]' : 'text-red-600')
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

// ── Legend ─────────────────────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
      {([['#1B8A4C', 'Положительный ГЭП'], ['#D97706', 'Внимание (≤10% обяз.)'], ['#DC2626', 'Дефицит (>10% обяз.)']] as [string, string][]).map(([c, l]) => (
        <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c }} />
          {l}
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function GapAnalysisPage() {
  const [reports,  setReports]  = useState<GapReport[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewing,  setViewing]  = useState<GapReport | null>(null)
  const [tab,      setTab]      = useState<'assets' | 'liabilities' | 'results'>('assets')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [filterYear,  setFilterYear]  = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  // Form state
  const [analystName, setAnalystName] = useState('')
  const [periodDate,  setPeriodDate]  = useState('')
  const [assets,      setAssets]      = useState<Matrix>(EMPTY_MATRIX())
  const [liabilities, setLiabilities] = useState<Matrix>(EMPTY_MATRIX())

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('gap_analysis').select('*').order('created_at', { ascending: false })
    if (filterYear) {
      const m = filterMonth ? filterMonth.padStart(2, '0') : null
      if (m) {
        query = query.gte('period_date', `${filterYear}-${m}-01`).lte('period_date', `${filterYear}-${m}-31`)
      } else {
        query = query.gte('period_date', `${filterYear}-01-01`).lte('period_date', `${filterYear}-12-31`)
      }
    }
    const { data } = await query
    setReports(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])
  useEffect(() => { fetch_() }, [fetch_])

  async function downloadWord(r: GapReport) {
    try {
      const res = await fetch('/api/liquidity/gap/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: r }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      const period = r.period_date ? new Date(r.period_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : 'period'
      a.download = `GAP_${period}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  function resetModal() {
    setAnalystName(''); setPeriodDate('')
    setAssets(EMPTY_MATRIX()); setLiabilities(EMPTY_MATRIX())
    setTab('assets'); setError(null)
  }

  const computed = calcGap(assets, liabilities)

  async function handleSave() {
    if (!periodDate) { setError('Укажите дату периода'); return }
    setSaving(true); setError(null)
    try {
      const assetsNum = assets.map(row => row.map(parseN))
      const liabNum   = liabilities.map(row => row.map(parseN))
      const buckets: StoredBucket[] = computed.map(c => ({
        label: c.label, assets: c.assets, liabilities: c.liabilities,
        gap: c.gap, cumulative_gap: c.cumulative_gap,
        liquidity_ratio: c.ratio, status: c.status,
      }))
      const { error: dbErr } = await supabase.from('gap_analysis').insert({
        analyst_name: analystName, period_date: periodDate,
        assets_data:      { rows: assetsNum },
        liabilities_data: { rows: liabNum },
        gap_results:      { buckets },
      })
      if (dbErr) throw new Error(dbErr.message)
      setShowModal(false); resetModal(); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить ГЭП-анализ?')) return
    await supabase.from('gap_analysis').delete().eq('id', id)
    fetch_()
  }

  const fmtPeriod = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '—'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">ГЭП-анализ ликвидности</h1>
          <p className="text-sm text-gray-500 mt-0.5">Разрывы ликвидности по временным корзинам · Инструкция НБТ №247</p>
        </div>
        <button onClick={() => { resetModal(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый анализ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Всего анализов',   value: reports.length, c: 'text-gray-900' },
          { label: 'Все корзины в норме', value: reports.filter(r => r.gap_results?.buckets?.every(b => b.status === 'green')).length, c: 'text-[#1B8A4C]' },
          { label: 'Есть внимание',    value: reports.filter(r => r.gap_results?.buckets?.some(b => b.status === 'yellow') && !r.gap_results?.buckets?.some(b => b.status === 'red')).length, c: 'text-yellow-600' },
          { label: 'Критический ГЭП', value: reports.filter(r => r.gap_results?.buckets?.some(b => b.status === 'red')).length, c: 'text-red-600' },
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
                {['Период', 'Аналитик', 'Создан', ...BUCKETS_SHORT.map(b => `ГЭП ${b}`), 'Накопл. ГЭП', ''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? <tr><td colSpan={13} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
                : reports.length === 0
                ? <tr><td colSpan={13} className="text-center py-12 text-gray-400">
                    <GitMerge className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Нет ГЭП-анализов</p>
                  </td></tr>
                : reports.map(r => {
                  const buckets  = r.gap_results?.buckets || []
                  const lastCum  = buckets[buckets.length - 1]?.cumulative_gap ?? 0
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">{fmtPeriod(r.period_date)}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{r.analyst_name || '—'}</td>
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                      {buckets.map((b, i) => (
                        <td key={i} className="px-3 py-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[b.status].badge}`}>
                            {fmtM(b.gap)}
                          </span>
                        </td>
                      ))}
                      <td className={`px-3 py-3 text-xs font-bold ${lastCum >= 0 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                        {fmtM(lastCum)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewing(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Просмотр"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => downloadWord(r)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg" title="Скачать Word"><Download className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* ── View Modal ──────────────────────────────────────────────────────────── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">ГЭП-анализ ликвидности</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtPeriod(viewing.period_date)}{viewing.analyst_name ? ` · ${viewing.analyst_name}` : ''}
                </p>
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Summary table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2.5 font-medium text-gray-500" style={{ minWidth: 190 }}>Показатель</th>
                      {BUCKETS.map(b => <th key={b} className="px-2 py-2.5 font-medium text-gray-500 whitespace-nowrap text-center" style={{ minWidth: 88 }}>{b}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { label: 'Активы (TJS)',         vals: viewing.gap_results.buckets.map(b => fmt(b.assets)),            cls: () => 'text-gray-700', bold: false },
                      { label: 'Обязательства (TJS)',  vals: viewing.gap_results.buckets.map(b => fmt(b.liabilities)),       cls: () => 'text-gray-700', bold: false },
                      { label: 'ГЭП (TJS)',            vals: viewing.gap_results.buckets.map(b => (b.gap >= 0 ? '+' : '') + fmt(b.gap)), cls: (b: StoredBucket) => STATUS_STYLE[b.status].text, bold: true },
                      { label: 'Накопленный ГЭП (TJS)', vals: viewing.gap_results.buckets.map(b => (b.cumulative_gap >= 0 ? '+' : '') + fmt(b.cumulative_gap)), cls: (b: StoredBucket) => b.cumulative_gap >= 0 ? 'text-[#1B8A4C]' : 'text-red-600', bold: true },
                      { label: 'Коэф. ликвидности (%)', vals: viewing.gap_results.buckets.map(b => b.liquidity_ratio != null ? b.liquidity_ratio.toFixed(1) + '%' : '—'), cls: () => 'text-gray-700', bold: false },
                    ].map(row => (
                      <tr key={row.label} className={row.bold ? 'bg-gray-50/60' : ''}>
                        <td className={`px-3 py-2 ${row.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{row.label}</td>
                        {viewing.gap_results.buckets.map((b, i) => (
                          <td key={i} className={`px-2 py-2 text-center font-medium ${row.cls(b)}`}>{row.vals[i]}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-2 text-gray-500">Статус</td>
                      {viewing.gap_results.buckets.map((b, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[b.status].badge}`}>
                            {STATUS_LABEL[b.status]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Chart */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Накопленный ГЭП по временным корзинам</p>
                <GapBarChart buckets={viewing.gap_results.buckets.map(b => ({ gap: b.gap, cumulative_gap: b.cumulative_gap, status: b.status }))} />
                <ChartLegend />
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-100">
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">

            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">Новый ГЭП-анализ · Инструкция НБТ №247</h2>
                <p className="text-xs text-gray-500 mt-0.5">Все расчёты на клиенте — данные только в Supabase</p>
              </div>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 gap-1">
              {([
                { k: 'assets'      as const, label: '1. Активы' },
                { k: 'liabilities' as const, label: '2. Обязательства' },
                { k: 'results'     as const, label: '3. Результаты' },
              ]).map(t => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.k ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              {/* Common fields — always visible */}
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Дата периода *</label>
                  <input type="date" value={periodDate} onChange={e => setPeriodDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Аналитик</label>
                  <input type="text" value={analystName} onChange={e => setAnalystName(e.target.value)}
                    placeholder="ФИО" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                </div>
              </div>

              {/* Tab: Assets */}
              {tab === 'assets' && (
                <InputTable
                  rows={ASSET_ROWS} matrix={assets} setMatrix={setAssets}
                  headerColor="bg-[#1B8A4C]/8"
                  totalColor="bg-[#1B8A4C]/5 text-[#1B8A4C]"
                  totalLabel="ИТОГО АКТИВЫ"
                />
              )}

              {/* Tab: Liabilities */}
              {tab === 'liabilities' && (
                <InputTable
                  rows={LIABILITY_ROWS} matrix={liabilities} setMatrix={setLiabilities}
                  headerColor="bg-red-50/50"
                  totalColor="bg-red-50/40 text-red-700"
                  totalLabel="ИТОГО ОБЯЗАТЕЛЬСТВА"
                />
              )}

              {/* Tab: Results */}
              {tab === 'results' && (
                <div className="space-y-5">
                  <ResultsTable computed={computed} />
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Накопленный ГЭП по временным корзинам</p>
                    <GapBarChart buckets={computed.map(c => ({ gap: c.gap, cumulative_gap: c.cumulative_gap, status: c.status }))} />
                    <ChartLegend />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); resetModal() }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <div className="flex items-center gap-2">
                {tab === 'assets' && (
                  <button onClick={() => setTab('liabilities')}
                    className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                    Далее → Обязательства
                  </button>
                )}
                {tab === 'liabilities' && (
                  <>
                    <button onClick={() => setTab('assets')} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      ← Назад
                    </button>
                    <button onClick={() => setTab('results')}
                      className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                      Далее → Результаты
                    </button>
                  </>
                )}
                {tab === 'results' && (
                  <>
                    <button onClick={() => setTab('liabilities')} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      ← Назад
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
                        : <><CheckCircle className="w-4 h-4" /> Сохранить анализ</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

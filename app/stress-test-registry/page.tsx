'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/supabase/client'
import { FlaskConical, Search, Filter, X, ChevronDown, Download, Calendar, User, Tag, Eye } from 'lucide-react'

type RiskType = 'Операционный риск' | 'Кредитный риск' | 'Рыночный риск' | 'Риск ликвидности'

interface RegistryEntry {
  id: string
  created_at: string
  risk_type: RiskType
  analyst_name: string | null
  period: string | null
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  conclusion: string | null
  status: string
}

const RISK_COLORS: Record<RiskType, { bg: string; text: string; dot: string }> = {
  'Операционный риск': { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  'Кредитный риск':   { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500' },
  'Рыночный риск':    { bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-500' },
  'Риск ликвидности': { bg: 'bg-cyan-50',    text: 'text-cyan-700',   dot: 'bg-cyan-500' },
}

const RISK_TYPES: RiskType[] = ['Операционный риск', 'Кредитный риск', 'Рыночный риск', 'Риск ликвидности']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Recursive value renderer — never produces [object Object]
function renderJsonValue(v: unknown, depth = 0): JSX.Element | null {
  if (v === null || v === undefined) {
    return <span className="text-gray-400 italic text-[11px]">—</span>
  }

  if (typeof v !== 'object') {
    return <span className="text-xs font-medium text-gray-800">{String(v)}</span>
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-gray-400 italic text-[11px]">—</span>

    // Array of plain objects → mini-table
    if (v.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) {
      const cols = Array.from(new Set(v.flatMap(item => Object.keys(item as object))))
      return (
        <div className="mt-1.5 overflow-x-auto rounded border border-gray-200">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-200">
                {cols.map(c => (
                  <th key={c} className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(v as Record<string, unknown>[]).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {cols.map(c => (
                    <td key={c} className="px-2.5 py-1.5 text-gray-700 whitespace-nowrap border-t border-gray-100">
                      {renderJsonValue(row[c], depth + 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // Array of primitives / mixed
    return (
      <span className="text-xs text-gray-700">
        {v.map((item, i) => (
          <span key={i}>{i > 0 ? ', ' : ''}{typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)}</span>
        ))}
      </span>
    )
  }

  // Plain object
  const entries = Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== null && val !== undefined)
  if (!entries.length) return null

  return (
    <div className={`space-y-1.5 ${depth > 0 ? 'mt-1 ml-1 pl-2.5 border-l-2 border-gray-200' : ''}`}>
      {entries.map(([k, val]) => {
        const isComplex = val !== null && typeof val === 'object'
        return (
          <div key={k}>
            {isComplex ? (
              <div>
                <span className="text-[11px] font-semibold text-gray-500">{k}:</span>
                {renderJsonValue(val, depth + 1)}
              </div>
            ) : (
              <div className="flex gap-2 items-baseline">
                <span className="text-[11px] text-gray-400 shrink-0 w-40 truncate">{k}</span>
                <span className="text-xs font-medium text-gray-800 break-all">{String(val)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  if (!Object.keys(data).length) return null
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h4>
      <div className="bg-gray-50 rounded-lg p-3">
        {renderJsonValue(data, 0)}
      </div>
    </div>
  )
}

function DetailModal({ entry, onClose }: { entry: RegistryEntry; onClose: () => void }) {
  const colors = RISK_COLORS[entry.risk_type] ?? { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' }
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Стресс-тест — ${entry.risk_type} — ${entry.period ?? ''}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
        h1{font-size:16px;margin-bottom:4px}
        h3{font-size:13px;margin:16px 0 6px;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
        h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:12px 0 4px}
        .meta{color:#6b7280;font-size:11px;margin-bottom:16px}
        .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;background:#e0f2fe;color:#0369a1}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        td{padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px}
        td:first-child{color:#6b7280;width:45%}
        .conclusion{background:#f9fafb;border-radius:6px;padding:10px;font-size:12px;line-height:1.6}
        @media print{body{margin:12px}}
      </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{entry.risk_type}</h2>
              <p className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B8A4C] text-white text-xs font-medium rounded-lg hover:bg-[#16703d] transition-colors">
              <Download className="w-3.5 h-3.5" /> Экспорт PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div ref={printRef}>
            {/* Print header */}
            <h1 className="hidden print:block text-base font-bold mb-1">{entry.risk_type} — Стресс-тест</h1>
            <div className="hidden print:block text-xs text-gray-500 mb-4">
              Аналитик: {entry.analyst_name ?? '—'} · Период: {entry.period ?? '—'} · Дата: {formatDateTime(entry.created_at)} · Статус: {entry.status}
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { icon: <User className="w-3 h-3" />, text: entry.analyst_name ?? '—' },
                { icon: <Calendar className="w-3 h-3" />, text: entry.period ?? '—' },
                { icon: <Tag className="w-3 h-3" />, text: entry.status },
              ].map((b, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600">
                  {b.icon} {b.text}
                </span>
              ))}
            </div>

            {/* Inputs */}
            {entry.inputs && Object.keys(entry.inputs).length > 0 && (
              <JsonBlock label="Входные данные" data={entry.inputs} />
            )}

            {/* Results */}
            {entry.results && Object.keys(entry.results).length > 0 && (
              <div className="mt-4">
                <JsonBlock label="Результаты" data={entry.results} />
              </div>
            )}

            {/* Conclusion */}
            {entry.conclusion && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Заключение</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {entry.conclusion}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StressTestRegistryPage() {
  const [entries, setEntries] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RegistryEntry | null>(null)

  const [filterRisk, setFilterRisk] = useState<string>('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAnalyst, setFilterAnalyst] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('stress_test_registry')
        .select('*')
        .order('created_at', { ascending: false })
      setEntries((data as RegistryEntry[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = entries.filter(e => {
    if (filterRisk && e.risk_type !== filterRisk) return false
    if (filterFrom && e.created_at < filterFrom) return false
    if (filterTo && e.created_at > filterTo + 'T23:59:59') return false
    if (filterAnalyst && !(e.analyst_name ?? '').toLowerCase().includes(filterAnalyst.toLowerCase())) return false
    return true
  })

  const hasFilters = filterRisk || filterFrom || filterTo || filterAnalyst

  function clearFilters() {
    setFilterRisk(''); setFilterFrom(''); setFilterTo(''); setFilterAnalyst('')
  }

  const counts: Record<string, number> = {}
  for (const e of entries) counts[e.risk_type] = (counts[e.risk_type] ?? 0) + 1

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1B8A4C]/10 rounded-xl flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-[#1B8A4C]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Реестр стресс-тестов</h1>
          <p className="text-xs text-gray-400">История проведённых стресс-тестов по всем видам риска</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {RISK_TYPES.map(rt => {
          const c = RISK_COLORS[rt]
          const n = counts[rt] ?? 0
          return (
            <button key={rt} onClick={() => setFilterRisk(filterRisk === rt ? '' : rt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${filterRisk === rt ? `${c.bg} ${c.text} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {rt} <span className="opacity-60">({n})</span>
            </button>
          )
        })}
        <span className="flex items-center px-3 py-1.5 text-xs text-gray-400">
          Всего: {entries.length}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1.5">
              <Filter className="inline w-3 h-3 mr-1" />Вид риска
            </label>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]/30">
              <option value="">Все виды</option>
              {RISK_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1.5">
              <Calendar className="inline w-3 h-3 mr-1" />Дата от
            </label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]/30" />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1.5">
              <Calendar className="inline w-3 h-3 mr-1" />Дата до
            </label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]/30" />
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-gray-500 mb-1.5">
              <User className="inline w-3 h-3 mr-1" />Аналитик
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Имя аналитика..." value={filterAnalyst} onChange={e => setFilterAnalyst(e.target.value)}
                className="w-full pl-8 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]/30" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-6 h-6 border-2 border-[#1B8A4C]/30 border-t-[#1B8A4C] rounded-full animate-spin mr-3" />
            Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FlaskConical className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">{hasFilters ? 'Ничего не найдено по фильтрам' : 'Реестр пуст'}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-2 text-xs text-[#1B8A4C] hover:underline">Сбросить фильтры</button>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Дата', 'Вид риска', 'Аналитик', 'Период', 'Статус', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(entry => {
                const colors = RISK_COLORS[entry.risk_type] ?? { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' }
                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                    onClick={() => setSelected(entry)}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {entry.risk_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{entry.analyst_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{entry.period ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[11px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-[#1B8A4C] transition-colors ml-auto">
                        <Eye className="w-3.5 h-3.5" /> Детали
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400">
            Показано {filtered.length} из {entries.length} записей
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/supabase/client'
import { FlaskConical, Search, Filter, X, Download, Calendar, User, Tag, Eye, Trash2 } from 'lucide-react'
import { labelField, formatFieldValue, FIELD_LABELS } from '@/lib/stress-test-labels'

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

const SCENARIO_META = {
  optimistic:   { label: 'Оптимистичный',   icon: '📈', bg: 'bg-green-50',  border: 'border-green-200',  title: 'text-green-700',  val: 'text-green-800' },
  pessimistic:  { label: 'Пессимистичный',  icon: '📉', bg: 'bg-yellow-50', border: 'border-yellow-200', title: 'text-yellow-700', val: 'text-yellow-800' },
  catastrophic: { label: 'Катастрофический',icon: '⚠️', bg: 'bg-red-50',    border: 'border-red-200',    title: 'text-red-700',    val: 'text-red-800' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Inputs block: flat key-value with FIELD_LABELS, skip grow_table (renders as note) ──
function InputsBlock({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k, v]) => v !== null && v !== undefined)
  if (!entries.length) return null

  const flat = entries.filter(([k]) => k !== 'grow_table')
  const hasGrowTable = 'grow_table' in data && Array.isArray(data.grow_table)

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Входные данные</h4>
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
        {flat.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <span className="text-[11px] text-gray-400 shrink-0 w-48 truncate">{labelField(k)}</span>
            <span className="text-xs font-medium text-gray-800">{formatFieldValue(k, v)}</span>
          </div>
        ))}
        {hasGrowTable && (
          <div className="mt-1 pt-1.5 border-t border-gray-200">
            <span className="text-[11px] text-gray-400">{FIELD_LABELS['grow_table']}</span>
            <span className="ml-2 text-[11px] text-gray-500 italic">таблица прогнозных коэффициентов</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single scenario card ────────────────────────────────────────────────────
function ScenarioCard({ scenKey, scenData }: { scenKey: string; scenData: Record<string, unknown> }) {
  const meta = SCENARIO_META[scenKey as keyof typeof SCENARIO_META]
  if (!meta) return null

  const entries = Object.entries(scenData).filter(([, v]) => v !== null && v !== undefined)

  return (
    <div className={`rounded-xl border-2 ${meta.border} ${meta.bg} p-3`}>
      <p className={`text-xs font-bold ${meta.title} mb-2.5`}>{meta.icon} {meta.label}</p>
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between items-baseline gap-1">
            <span className="text-[11px] text-gray-500 truncate">{labelField(k)}</span>
            <span className={`text-xs font-semibold ${meta.val} shrink-0`}>{formatFieldValue(k, v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Market risk: FX-effect table ───────────────────────────────────────────
const regFmt = new Intl.NumberFormat('ru-RU')

type FxScenarioData = {
  cvar_pct: number; total_short: number; total_long: number
  rows: Array<{ month: string; reg_cap: number; open_pos: number; fx_shock_pct: number; pnl_short: number; pnl_long: number }>
}

function FxEffectBlock({ data }: { data: Record<string, unknown> }) {
  const period    = String(data.period    || '—')
  const posLimPct = Number(data.pos_limit_pct || 0)
  const scenarios: Array<{ label: string; hdrBg: string; sc: FxScenarioData }> = []
  if (data.pessimistic)  scenarios.push({ label: 'Пессимистичный (CVaR95)',  hdrBg: 'bg-yellow-600', sc: data.pessimistic  as FxScenarioData })
  if (data.catastrophic) scenarios.push({ label: 'Катастрофический (CVaR99)', hdrBg: 'bg-red-700',    sc: data.catastrophic as FxScenarioData })

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        Эффект на прибыль — Открытая валютная позиция
      </h4>
      <p className="text-[11px] text-gray-400 mb-3">Период: {period} · Лимит ОВП: {posLimPct}%</p>
      <div className="space-y-3">
        {scenarios.map(({ label, hdrBg, sc }) => (
          <div key={label} className="rounded-xl overflow-hidden border border-gray-200">
            <div className={`${hdrBg} px-3 py-1.5 flex items-center justify-between`}>
              <span className="text-white text-xs font-semibold">{label} — FX шок {sc.cvar_pct}%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {['Месяц','Рег. капитал','ОВП','FX шок%','P&L SHORT','P&L LONG'].map(h => (
                      <th key={h} className="px-3 py-1.5 text-right first:text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sc.rows.map((row, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-1.5 font-semibold text-gray-700">{row.month}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{row.reg_cap > 0 ? regFmt.format(row.reg_cap) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-gray-800 font-medium">{row.open_pos > 0 ? regFmt.format(row.open_pos) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{row.fx_shock_pct.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-red-600">{row.open_pos > 0 ? `−${regFmt.format(Math.abs(row.pnl_short))}` : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-green-600">{row.open_pos > 0 ? `+${regFmt.format(row.pnl_long)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800">
                    <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-300">Total Effect</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-red-300">
                      {sc.total_short < 0 ? `−${regFmt.format(Math.abs(sc.total_short))}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-green-300">
                      {sc.total_long > 0 ? `+${regFmt.format(sc.total_long)}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Market risk: Monte Carlo block ──────────────────────────────────────────
function MonteCarloBlock({ data }: { data: Record<string, unknown> }) {
  const rows: [string, string][] = [
    ['Валюта',                    String(data.currency || '—')],
    ['Среднее μ (%)',             data.mean     != null ? `${data.mean}%`     : '—'],
    ['Откл. σ (%)',               data.std_dev  != null ? `${data.std_dev}%`  : '—'],
    ['Горизонт (дней)',           data.horizon_days != null ? String(data.horizon_days) : '—'],
    ['VaR 95% (ист.)',            data.var95_hist  != null ? `${data.var95_hist}%`  : '—'],
    ['VaR 99% (ист.)',            data.var99_hist  != null ? `${data.var99_hist}%`  : '—'],
    ['CVaR 95%',                  data.cvar95      != null ? `${data.cvar95}%`      : '—'],
    ['CVaR 99%',                  data.cvar99      != null ? `${data.cvar99}%`      : '—'],
    ['Ожидаемое (%)',             data.expected    != null ? `${data.expected}%`    : '—'],
    ['Медиана (%)',               data.median      != null ? `${data.median}%`      : '—'],
    ['Вер-ть укрепления (%)',     data.appreciation_pct != null ? `${data.appreciation_pct}%` : '—'],
    ['Вер-ть ослабления (%)',     data.depreciation_pct != null ? `${data.depreciation_pct}%` : '—'],
  ]
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Monte Carlo — Методологическая база
      </h4>
      <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
            <span className="text-sm font-semibold text-gray-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Market risk: Model 2 block ──────────────────────────────────────────────
function Model2Block({ data }: { data: Record<string, unknown> }) {
  const fmtTJS = (n: unknown) => n != null && Number(n) > 0 ? regFmt.format(Number(n)) + ' TJS' : '—'
  const fmtPct = (n: unknown) => n != null ? Number(n).toFixed(2) + '%' : '—'

  type ScData = { gdp_growth_pct: number; remit_share_pct: number; forecast_income: number; delta: number }
  const pess = data.scenario_pessimistic  as ScData | undefined
  const cat  = data.scenario_catastrophic as ScData | undefined

  const baseRows: [string, string][] = [
    ['ВВП базового периода',         fmtTJS(data.gdp_base)],
    ['Прогноз роста ВВП',            fmtPct(data.gdp_growth_pct)],
    ['Доля переводов в ВВП',         fmtPct(data.remit_share_pct)],
    ['Бюджет переводов Банка',       fmtTJS(data.bank_budget)],
    ['Доля Банка (авт.)',            fmtPct(data.bank_share_pct)],
    ['Маржа (авт.)',                 Number(data.margin_pct || 0).toFixed(4) + '%'],
    ['Ожидаемый ВВП',                fmtTJS(data.expected_gdp)],
    ['Прогноз переводов в РТ',       fmtTJS(data.forecast_remit_rt)],
    ['Прогнозный доход (ост. пер.)', fmtTJS(data.forecast_income_h2)],
    ['Факт. объём переводов H1',     fmtTJS(data.actual_vol_h1)],
    ['Факт. доход от переводов H1',  fmtTJS(data.actual_income_h1)],
  ]

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Модель 2 — Каскадная модель денежных переводов
      </h4>
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3">
        {baseRows.filter(([, v]) => v !== '—').map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className="text-[11px] text-gray-400 shrink-0 w-52 truncate">{label}</span>
            <span className="text-xs font-medium text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      {(pess || cat) && (
        <div className="grid grid-cols-2 gap-2">
          {pess && (
            <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-3">
              <p className="text-xs font-bold text-yellow-700 mb-2">📉 Пессимистичный</p>
              {([['Рост ВВП', fmtPct(pess.gdp_growth_pct)],['Доля переводов', fmtPct(pess.remit_share_pct)],['Прогнозный доход', fmtTJS(pess.forecast_income)],['Эффект (δ)', (pess.delta >= 0 ? '+' : '') + fmtTJS(pess.delta)]] as [string,string][]).map(([l,v]) => (
                <div key={l} className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">{l}</span>
                  <span className={`font-semibold ${l === 'Эффект (δ)' ? (pess.delta >= 0 ? 'text-green-700' : 'text-red-700') : 'text-yellow-700'}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {cat && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-700 mb-2">⚠️ Катастрофический</p>
              {([['Рост ВВП', fmtPct(cat.gdp_growth_pct)],['Доля переводов', fmtPct(cat.remit_share_pct)],['Прогнозный доход', fmtTJS(cat.forecast_income)],['Эффект (δ)', (cat.delta >= 0 ? '+' : '') + fmtTJS(cat.delta)]] as [string,string][]).map(([l,v]) => (
                <div key={l} className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">{l}</span>
                  <span className={`font-semibold ${l === 'Эффект (δ)' ? (cat.delta >= 0 ? 'text-green-700' : 'text-red-700') : 'text-red-700'}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Market risk: combined results block (new 3-block format + old flat compat) ──
function MarketRiskResultsBlock({ data }: { data: Record<string, unknown> }) {
  const isNewFormat = 'fx_effect' in data || 'monte_carlo' in data || 'model2' in data

  if (!isNewFormat) {
    // Backward compatibility: old flat format (var95_hist, cvar95, etc.)
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
    return (
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Результаты</h4>
        <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">{labelField(k)}</span>
              <span className="text-sm font-semibold text-gray-800">{formatFieldValue(k, v)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const fxEffect   = data.fx_effect   as Record<string, unknown> | null
  const monteCarlo = data.monte_carlo as Record<string, unknown> | null
  const model2     = data.model2      as Record<string, unknown> | null

  return (
    <div className="space-y-4">
      {fxEffect
        ? <FxEffectBlock data={fxEffect} />
        : <p className="text-xs text-gray-400 italic">Блок открытой валютной позиции не заполнен</p>}
      {monteCarlo
        ? <MonteCarloBlock data={monteCarlo} />
        : <p className="text-xs text-gray-400 italic">Монте Карло не запускался</p>}
      {model2 && <Model2Block data={model2} />}
    </div>
  )
}

// ── Results block: scenarios → cards, flat → labeled grid ──────────────────
function ResultsBlock({ riskType, data }: { riskType: RiskType; data: Record<string, unknown> }) {
  if (!Object.keys(data).length) return null

  if (riskType === 'Рыночный риск') {
    return <MarketRiskResultsBlock data={data} />
  }

  const hasScenarios =
    riskType === 'Кредитный риск' || riskType === 'Операционный риск'

  if (hasScenarios) {
    const scenKeys: (keyof typeof SCENARIO_META)[] = ['optimistic', 'pessimistic', 'catastrophic']
    const scenariosPresent = scenKeys.filter(k => k in data && data[k] !== null)
    const extra = Object.entries(data).filter(([k]) => !scenKeys.includes(k as keyof typeof SCENARIO_META) && data[k] !== null)

    return (
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Результаты по сценариям</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {scenariosPresent.map(k => (
            <ScenarioCard
              key={k}
              scenKey={k}
              scenData={data[k] as Record<string, unknown>}
            />
          ))}
        </div>
        {extra.length > 0 && (
          <div className="mt-2.5 bg-gray-50 rounded-xl p-3 space-y-1.5">
            {extra.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <span className="text-[11px] text-gray-400 w-48 shrink-0 truncate">{labelField(k)}</span>
                <span className="text-xs font-medium text-gray-800">{formatFieldValue(k, v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Flat results (liquidity, etc.)
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Результаты</h4>
      <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{labelField(k)}</span>
            <span className="text-sm font-semibold text-gray-800">{formatFieldValue(k, v)}</span>
          </div>
        ))}
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
              <InputsBlock data={entry.inputs} />
            )}

            {/* Results */}
            {entry.results && Object.keys(entry.results).length > 0 && (
              <div className="mt-4">
                <ResultsBlock riskType={entry.risk_type} data={entry.results} />
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
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm('Удалить запись из реестра? Это действие необратимо.')) return
    setDeletingId(id)
    const { error } = await supabase.from('stress_test_registry').delete().eq('id', id)
    if (error) {
      alert('Ошибка удаления: ' + error.message)
    } else {
      setEntries(prev => prev.filter(e => e.id !== id))
      if (selected?.id === id) setSelected(null)
    }
    setDeletingId(null)
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
                      <div className="flex items-center justify-end gap-2">
                        <button className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-[#1B8A4C] transition-colors">
                          <Eye className="w-3.5 h-3.5" /> Детали
                        </button>
                        <button
                          onClick={e => handleDelete(e, entry.id)}
                          disabled={deletingId === entry.id}
                          className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Удалить запись">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

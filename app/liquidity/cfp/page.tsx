'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, ShieldAlert, CheckCircle } from 'lucide-react'
import {
  statusCar11, statusCar12, statusCar13, statusK21, normLabel,
  ewiN1, ewiLcr, ewiOutflow, ewiTop5, overallEwi,
  calcSurvivalHorizon, calcReserveCoverage,
  EWI_EMOJI, EWI_LABEL, READINESS_LEVELS, type EwiStatus,
} from '@/lib/cfpCalculations'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FundingSource { name: string; amount: string; access_term: string; status: string }

interface CfpReport {
  id: string
  report_name: string
  analyst_name?: string
  plan_period?: string
  plan_date?: string
  // new format fields
  car11?: number; car12?: number; car13?: number; k21?: number
  liabilities?: { term_deposits: number; current_accounts: number; interbank: number; other: number }
  funding_sources?: { name: string; amount: number; access_term: string; status: string }[]
  // old format fields (backward compat)
  n1?: number; lcr?: number; deposit_outflow_7d?: number; top5_share?: number
  hqla_l1?: number; hqla_l2a?: number; hqla_l2b?: number
  ob_interbank?: number; ob_current?: number; ob_savings?: number; ob_term?: number; ob_credit_lines?: number
  reserve_sources?: { name: string; amount: number; status: string; access_term: string }[]
  readiness_level?: number
  survival_horizon?: number; reserve_coverage?: number; overall_status?: string
  ai_conclusion: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_SRC: FundingSource = { name: '', amount: '', access_term: '', status: 'Доступен' }
const SRC_STATUSES = ['Доступен', 'Условно доступен', 'Ограничен']

const fmt  = (n: number) => n ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/[\s ]/g, '').replace(/ /g, '')) || 0
const pct  = (v: string) => v.replace(/[^\d.,]/g, '').replace(',', '.')

const inp    = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white'
const inpNum = inp + ' text-right'
const lbl    = 'block text-xs font-medium text-gray-600 mb-1'

const STATUS_COLORS: Record<EwiStatus, string> = {
  green:  'text-[#1B8A4C] bg-green-50 border-green-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  red:    'text-red-700 bg-red-50 border-red-200',
}

// ── NormRow: одна строка норматива ────────────────────────────────────────────
function NormRow({
  code, formula, norm, value, status, onChange,
}: {
  code: string; formula: string; norm: string
  value: string; status: EwiStatus | null; onChange: (v: string) => void
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
          <input
            type="text" inputMode="decimal"
            value={value}
            onChange={e => onChange(pct(e.target.value))}
            placeholder="0.00"
            className={inpNum + ' flex-1'}
          />
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

// ── NormBadge: для просмотра ──────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CfpPage() {
  const [reports,    setReports]    = useState<CfpReport[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [viewing,    setViewing]    = useState<CfpReport | null>(null)
  const [tab,        setTab]        = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  // Form state
  const [form, setForm] = useState({
    report_name: '', analyst_name: '',
    plan_period: '', plan_date: '',
    car11: '', car12: '', car13: '', k21: '',
    liab_term: '', liab_current: '', liab_interbank: '', liab_other: '',
  })
  const [sources, setSources] = useState<FundingSource[]>([{ ...EMPTY_SRC }])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fp   = (k: keyof typeof form) => Number(form[k]) || 0

  // Fetch reports
  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cfp_reports').select('*').order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch_() }, [fetch_])

  function resetModal() {
    setForm({ report_name: '', analyst_name: '', plan_period: '', plan_date: '', car11: '', car12: '', car13: '', k21: '', liab_term: '', liab_current: '', liab_interbank: '', liab_other: '' })
    setSources([{ ...EMPTY_SRC }])
    setTab(1); setGeneratedDoc(null); setError(null)
  }

  // Generate
  async function handleGenerate() {
    if (!form.report_name.trim()) { setError('Введите название плана'); return }
    setGenerating(true); setError(null)
    try {
      const res = await apiFetch('/api/liquidity/cfp', {
        method: 'POST',
        body: JSON.stringify({
          report_name:  form.report_name,
          analyst_name: form.analyst_name,
          plan_period:  form.plan_period,
          plan_date:    form.plan_date,
          car11: fp('car11'), car12: fp('car12'), car13: fp('car13'), k21: fp('k21'),
          liabilities: {
            term_deposits:    parseN(form.liab_term),
            current_accounts: parseN(form.liab_current),
            interbank:        parseN(form.liab_interbank),
            other:            parseN(form.liab_other),
          },
          funding_sources: sources.filter(s => s.name.trim()).map(s => ({
            name: s.name, amount: parseN(s.amount), access_term: s.access_term, status: s.status,
          })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGeneratedDoc(data.conclusion)
      setTab(2)
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  // Save
  async function handleSave() {
    if (!generatedDoc) return
    setSaving(true)
    try {
      const { error: dbErr } = await supabase.from('cfp_reports').insert({
        report_name:  form.report_name,
        analyst_name: form.analyst_name,
        plan_period:  form.plan_period,
        plan_date:    form.plan_date,
        car11: fp('car11'), car12: fp('car12'), car13: fp('car13'), k21: fp('k21'),
        liabilities: {
          term_deposits:    parseN(form.liab_term),
          current_accounts: parseN(form.liab_current),
          interbank:        parseN(form.liab_interbank),
          other:            parseN(form.liab_other),
        },
        funding_sources: sources.filter(s => s.name.trim()).map(s => ({
          name: s.name, amount: parseN(s.amount), access_term: s.access_term, status: s.status,
        })),
        ai_conclusion: generatedDoc,
      })
      if (dbErr) throw new Error(dbErr.message)
      setShowModal(false); resetModal(); fetch_()
    } catch (err: unknown) {
      setError('Ошибка сохранения: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить CFP-отчёт?')) return
    await supabase.from('cfp_reports').delete().eq('id', id)
    fetch_()
  }

  // Live statuses
  const s11  = form.car11  ? statusCar11(fp('car11'))  : null
  const s12  = form.car12  ? statusCar12(fp('car12'))  : null
  const s13  = form.car13  ? statusCar13(fp('car13'))  : null
  const sk21 = form.k21    ? statusK21(fp('k21'))      : null

  const totalLiab = parseN(form.liab_term) + parseN(form.liab_current) + parseN(form.liab_interbank) + parseN(form.liab_other)
  const totalFunding = sources.reduce((s, r) => s + parseN(r.amount), 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">План финансирования на ЧС (CFP)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contingency Funding Plan · Инструкция НБТ №247 · ОАО «Алиф Банк»</p>
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
          { label: 'Нормативы соблюдены',  value: reports.filter(r => r.car11 != null && statusCar11(r.car11) !== 'red' && statusCar12(r.car12 || 0) !== 'red' && statusCar13(r.car13 || 0) !== 'red' && statusK21(r.k21 || 0) !== 'red').length, c: 'text-[#1B8A4C]' },
          { label: 'Нарушение нормативов', value: reports.filter(r => r.car11 != null && [statusCar11(r.car11 || 0), statusCar12(r.car12 || 0), statusCar13(r.car13 || 0), statusK21(r.k21 || 0)].includes('red')).length, c: 'text-red-600' },
          { label: 'Старый формат',        value: reports.filter(r => r.car11 == null && r.n1 != null).length, c: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Название плана', 'Аналитик', 'Период', 'CAR 1.1', 'CAR 1.2', 'CAR 1.3', 'К2-1', 'Источников', 'Дата', ''].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? <tr><td colSpan={10} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
              : reports.length === 0
              ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Нет CFP-отчётов</p>
                </td></tr>
              : reports.map(r => {
                const isNew = r.car11 != null
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-semibold text-gray-900">{r.report_name}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.analyst_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.plan_period || '—'}</td>
                    {isNew ? (
                      <>
                        <td className="px-3 py-3 text-xs">
                          <span className="font-medium">{r.car11}%</span>
                          <span className="ml-1">{EWI_EMOJI[statusCar11(r.car11 || 0)]}</span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className="font-medium">{r.car12}%</span>
                          <span className="ml-1">{EWI_EMOJI[statusCar12(r.car12 || 0)]}</span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className="font-medium">{r.car13}%</span>
                          <span className="ml-1">{EWI_EMOJI[statusCar13(r.car13 || 0)]}</span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className="font-medium">{r.k21}%</span>
                          <span className="ml-1">{EWI_EMOJI[statusK21(r.k21 || 0)]}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{r.funding_sources?.length || 0} источн.</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-xs text-gray-400" colSpan={3}>{EWI_EMOJI[(r.overall_status || 'green') as EwiStatus]} Н1={r.n1}% LCR={r.lcr}%</td>
                        <td className="px-3 py-3 text-xs text-gray-400">—</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{r.reserve_sources?.length || 0} источн.</td>
                      </>
                    )}
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>

      {/* ── View Modal ────────────────────────────────────────────────────────── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
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

              {viewing.car11 != null ? (
                /* ── Новый формат: CAR / K2-1 ── */
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Нормативы НБТ (Инструкция №176 / №247)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <NormBadge code="CAR 1.1 = Кр / Ар × 100%"    value={viewing.car11 || 0} status={statusCar11(viewing.car11 || 0)} />
                      <NormBadge code="CAR 1.2 = Кр / А × 100%"     value={viewing.car12 || 0} status={statusCar12(viewing.car12 || 0)} />
                      <NormBadge code="CAR 1.3 = Чок / Ар × 100%"   value={viewing.car13 || 0} status={statusCar13(viewing.car13 || 0)} />
                      <NormBadge code="К2-1 = ЛАТ / ОВТ × 100%"     value={viewing.k21   || 0} status={statusK21(viewing.k21   || 0)} />
                    </div>
                  </div>
                  {viewing.liabilities && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Структура обязательств</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Срочные депозиты физлиц', v: viewing.liabilities.term_deposits },
                          { label: 'Текущие счета',           v: viewing.liabilities.current_accounts },
                          { label: 'МБК',                     v: viewing.liabilities.interbank },
                          { label: 'Прочие обязательства',    v: viewing.liabilities.other },
                        ].map(({ label, v }) => (
                          <div key={label} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                            <span className="text-xs text-gray-500">{label}</span>
                            <span className="text-xs font-semibold text-gray-900">{fmt(v)} млн TJS</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(viewing.funding_sources?.length || 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Источники финансирования</p>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>{['Источник', 'Сумма (млн TJS)', 'Срок доступа', 'Статус'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {viewing.funding_sources!.map((s, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                                <td className="px-3 py-2">{fmt(s.amount)}</td>
                                <td className="px-3 py-2 text-gray-500">{s.access_term}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.status === 'Доступен' ? 'bg-green-100 text-green-700' : s.status === 'Условно доступен' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ── Старый формат: EWI / HQLA ── */
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { status: ewiN1(viewing.n1 || 0),             code: 'Н1 (достаточность капитала)',      value: viewing.n1 || 0 },
                    { status: ewiLcr(viewing.lcr || 0),           code: 'LCR (краткосрочная ликвидность)',  value: viewing.lcr || 0 },
                    { status: ewiOutflow(viewing.deposit_outflow_7d || 0), code: 'Отток депозитов 7д', value: viewing.deposit_outflow_7d || 0 },
                    { status: ewiTop5(viewing.top5_share || 0),   code: 'Доля топ-5 депозиторов',         value: viewing.top5_share || 0 },
                  ].map(b => (
                    <div key={b.code} className={`flex items-center justify-between p-3 rounded-lg border ${STATUS_COLORS[b.status as EwiStatus]}`}>
                      <div>
                        <p className="text-xs font-medium opacity-70">{b.code}</p>
                        <p className="text-lg font-bold">{b.value}%</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl">{EWI_EMOJI[b.status as EwiStatus]}</div>
                        <p className="text-xs font-semibold mt-0.5">{EWI_LABEL[b.status as EwiStatus]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Conclusion */}
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

      {/* ── Form Modal ────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">Новый CFP · Инструкция НБТ №247</h2>
                <p className="text-xs text-gray-500 mt-0.5">План финансирования на случай чрезвычайных ситуаций · ОАО «Алиф Банк»</p>
              </div>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 gap-1">
              {[
                { n: 1, t: 'Показатели и обязательства' },
                { n: 2, t: 'CFP-документ' },
              ].map(t => (
                <button key={t.n} onClick={() => setTab(t.n)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.n}. {t.t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              {/* ── Tab 1: Form ──────────────────────────────────────────────── */}
              {tab === 1 && (
                <>
                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Название плана *</label>
                      <input type="text" value={form.report_name} onChange={e => setF('report_name', e.target.value)}
                        placeholder="CFP Алиф Банк 2026" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Аналитик</label>
                      <input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)}
                        placeholder="ФИО" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Период действия плана</label>
                      <input type="text" value={form.plan_period} onChange={e => setF('plan_period', e.target.value)}
                        placeholder="2026–2027" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Дата составления</label>
                      <input type="date" value={form.plan_date} onChange={e => setF('plan_date', e.target.value)}
                        className={inp} />
                    </div>
                  </div>

                  {/* CAR / K2-1 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Обязательные нормативы НБТ
                    </p>
                    <p className="text-[11px] text-gray-400 mb-3">Инструкция №176 (достаточность капитала) · Инструкция №247 (ликвидность). Введите текущие значения в %.</p>

                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-3 px-1 mb-1">
                      <div className="col-span-4 text-[10px] font-medium text-gray-400 uppercase">Норматив / Формула</div>
                      <div className="col-span-2 text-[10px] font-medium text-gray-400 uppercase">Норма НБТ</div>
                      <div className="col-span-3 text-[10px] font-medium text-gray-400 uppercase">Значение %</div>
                      <div className="col-span-3 text-[10px] font-medium text-gray-400 uppercase">Статус</div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                      <NormRow code="CAR 1.1" formula="Кр / Ар × 100%"      norm="≥ 12%"  value={form.car11} status={s11}  onChange={v => setF('car11', v)} />
                      <NormRow code="CAR 1.2" formula="Кр / А × 100%"       norm="≥ 10%"  value={form.car12} status={s12}  onChange={v => setF('car12', v)} />
                      <NormRow code="CAR 1.3" formula="Чок / Ар × 100%"     norm="≥ 10%"  value={form.car13} status={s13}  onChange={v => setF('car13', v)} />
                      <NormRow code="К2-1"    formula="ЛАТ / ОВТ × 100%"   norm="≥ 30%"  value={form.k21}   status={sk21} onChange={v => setF('k21',   v)} />
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Структура обязательств (млн TJS)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { k: 'liab_term',      label: 'Срочные депозиты физлиц' },
                        { k: 'liab_current',   label: 'Текущие счета' },
                        { k: 'liab_interbank', label: 'МБК (межбанковские)' },
                        { k: 'liab_other',     label: 'Прочие обязательства' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric"
                            value={form[f.k as keyof typeof form]}
                            onChange={e => setF(f.k, fmtN(e.target.value))}
                            placeholder="0" className={inpNum} />
                        </div>
                      ))}
                    </div>
                    {totalLiab > 0 && (
                      <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg flex justify-between text-xs">
                        <span className="text-gray-500">Итого обязательства:</span>
                        <span className="font-semibold text-gray-900">{fmt(totalLiab)} млн TJS</span>
                      </div>
                    )}
                  </div>

                  {/* Funding Sources */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Доступные источники финансирования</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Укажите конкретные источники банка; AI дополнит стандартным перечнем по №247</p>
                      </div>
                      <button onClick={() => setSources(p => [...p, { ...EMPTY_SRC }])}
                        className="flex items-center gap-1 text-xs text-[#1B8A4C] hover:text-[#177040] font-medium">
                        <Plus className="w-3.5 h-3.5" /> Добавить
                      </button>
                    </div>

                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-2 px-3 mb-1">
                      {['Источник финансирования', 'Сумма (млн TJS)', 'Статус', 'Срок доступа', ''].map((h, i) => (
                        <div key={i} className={`text-[10px] font-medium text-gray-400 uppercase ${i === 0 ? 'col-span-4' : i === 1 ? 'col-span-2' : i === 2 ? 'col-span-3' : i === 3 ? 'col-span-2' : 'col-span-1'}`}>{h}</div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      {sources.map((s, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                          <div className="col-span-4">
                            <input type="text" value={s.name}
                              onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                              placeholder="Кредитная линия НБТ" className={inp} />
                          </div>
                          <div className="col-span-2">
                            <input type="text" inputMode="numeric" value={s.amount}
                              onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, amount: fmtN(e.target.value) } : r))}
                              placeholder="0" className={inpNum} />
                          </div>
                          <div className="col-span-3">
                            <select value={s.status}
                              onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                              className={inp}>
                              {SRC_STATUSES.map(st => <option key={st}>{st}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input type="text" value={s.access_term}
                              onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, access_term: e.target.value } : r))}
                              placeholder="24ч" className={inp} />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {sources.length > 1 && (
                              <button onClick={() => setSources(prev => prev.filter((_, j) => j !== i))}
                                className="p-1 text-gray-300 hover:text-red-500">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalFunding > 0 && (
                      <div className="mt-2 px-3 py-2 bg-[#1B8A4C]/8 rounded-lg flex justify-between text-xs">
                        <span className="text-gray-500">Итого доступных источников:</span>
                        <span className="font-semibold text-[#1B8A4C]">{fmt(totalFunding)} млн TJS</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Tab 2: Generated Document ─────────────────────────────────── */}
              {tab === 2 && (
                <div>
                  {!generatedDoc ? (
                    <div className="text-center py-16 text-gray-400">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">CFP-документ ещё не сгенерирован</p>
                      <p className="text-xs mt-1">Заполните данные на вкладке «Показатели» и нажмите «Сгенерировать CFP»</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" />
                        ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ · Инструкция НБТ №247
                      </p>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{generatedDoc}</div>
                    </div>
                  )}
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
                {tab === 2 && (
                  <button onClick={() => setTab(1)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ← Назад к форме
                  </button>
                )}
                {tab === 1 && (
                  <button onClick={handleGenerate} disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                    {generating
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</>
                      : <><ShieldAlert className="w-4 h-4" /> Сгенерировать CFP</>}
                  </button>
                )}
                {tab === 2 && generatedDoc && (
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</> : <><CheckCircle className="w-4 h-4" /> Сохранить CFP</>}
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

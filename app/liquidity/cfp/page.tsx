'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, AlertTriangle, CheckCircle, ShieldAlert, ChevronRight } from 'lucide-react'
import {
  ewiN1, ewiLcr, ewiOutflow, ewiTop5, overallEwi,
  calcSurvivalHorizon, calcReserveCoverage,
  EWI_EMOJI, EWI_LABEL, READINESS_LEVELS, type EwiStatus,
} from '@/lib/cfpCalculations'

interface ReserveSource { name: string; amount: string; status: string; access_term: string }

interface CfpReport {
  id: string; report_name: string; analyst_name: string
  n1: number; lcr: number; deposit_outflow_7d: number; top5_share: number
  hqla_l1: number; hqla_l2a: number; hqla_l2b: number
  ob_interbank: number; ob_current: number; ob_savings: number; ob_term: number; ob_credit_lines: number
  reserve_sources: { name: string; amount: number; status: string; access_term: string }[]
  readiness_level: number
  survival_horizon: number; reserve_coverage: number; overall_status: string
  ai_conclusion: string; created_at: string
}

const EMPTY_SOURCE: ReserveSource = { name: '', amount: '', status: 'Доступен', access_term: '' }

const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g, '')) || 0
const pct = (v: string) => { const c = v.replace(/[^\d.,]/g, '').replace(',', '.'); return c }

const STATUS_COLORS: Record<string, string> = {
  green: 'text-[#1B8A4C] bg-green-50 border-green-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  red: 'text-red-700 bg-red-50 border-red-200',
}
const STATUS_BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
}
const ewiColor = (s: EwiStatus) => STATUS_COLORS[s] || STATUS_COLORS.green
const badgeColor = (s: EwiStatus) => STATUS_BADGE[s] || STATUS_BADGE.green

const RESERVE_STATUSES = ['Доступен', 'Условно доступен', 'Ограничен']

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
const inpNum = inp + " text-right"
const lbl = "block text-xs font-medium text-gray-600 mb-1"

// ── EWI Badge ─────────────────────────────────────────────────────────────────
function EwiBadge({ status, label, value, unit }: { status: EwiStatus; label: string; value: number; unit?: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${ewiColor(status)}`}>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold">{fmt(value)}{unit || '%'}</p>
      </div>
      <div className="text-right">
        <div className="text-xl">{EWI_EMOJI[status]}</div>
        <p className="text-xs font-semibold mt-0.5">{EWI_LABEL[status]}</p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CfpPage() {
  const [reports, setReports] = useState<CfpReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewing, setViewing] = useState<CfpReport | null>(null)
  const [tab, setTab] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<{ conclusion: string; survival_horizon: number; reserve_coverage: number; overall_status: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState<Record<string, string>>({
    report_name: '', analyst_name: '',
    n1: '', lcr: '', deposit_outflow_7d: '', top5_share: '',
    hqla_l1: '', hqla_l2a: '', hqla_l2b: '',
    ob_interbank: '', ob_current: '', ob_savings: '', ob_term: '', ob_credit_lines: '',
    readiness_level: '1',
  })
  const [sources, setSources] = useState<ReserveSource[]>([{ ...EMPTY_SOURCE }])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const n = (k: string) => parseN(form[k] || '')
  const p = (k: string) => Number(form[k] || '') || 0

  const hqlaTotal = n('hqla_l1') + n('hqla_l2a') + n('hqla_l2b')
  const totalDeposits = n('ob_current') + n('ob_savings') + n('ob_term')
  const totalObligations = n('ob_interbank') + totalDeposits + n('ob_credit_lines')
  const reserveTotal = sources.reduce((s, r) => s + (Number(r.amount.replace(/\D/g, '')) || 0), 0)
  const survivalHorizon = calcSurvivalHorizon(hqlaTotal, totalDeposits, p('deposit_outflow_7d'))
  const pessimisticOutflow = totalDeposits * (p('deposit_outflow_7d') / 100)
  const reserveCoverage = calcReserveCoverage(reserveTotal, pessimisticOutflow)

  const s_n1 = ewiN1(p('n1'))
  const s_lcr = ewiLcr(p('lcr'))
  const s_out = ewiOutflow(p('deposit_outflow_7d'))
  const s_top5 = ewiTop5(p('top5_share'))
  const overall = overallEwi([s_n1, s_lcr, s_out, s_top5])

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cfp_reports').select('*').order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  function resetModal() {
    setForm({ report_name: '', analyst_name: '', n1: '', lcr: '', deposit_outflow_7d: '', top5_share: '', hqla_l1: '', hqla_l2a: '', hqla_l2b: '', ob_interbank: '', ob_current: '', ob_savings: '', ob_term: '', ob_credit_lines: '', readiness_level: '1' })
    setSources([{ ...EMPTY_SOURCE }])
    setTab(1); setGenerated(null); setError(null)
  }

  async function handleGenerate() {
    if (!form.report_name.trim()) { setError('Введите название отчёта'); setTab(1); return }
    setGenerating(true); setError(null)
    try {
      const res = await apiFetch('/api/liquidity/cfp', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          n1: p('n1'), lcr: p('lcr'), deposit_outflow_7d: p('deposit_outflow_7d'), top5_share: p('top5_share'),
          hqla_l1: n('hqla_l1'), hqla_l2a: n('hqla_l2a'), hqla_l2b: n('hqla_l2b'),
          ob_interbank: n('ob_interbank'), ob_current: n('ob_current'), ob_savings: n('ob_savings'), ob_term: n('ob_term'), ob_credit_lines: n('ob_credit_lines'),
          reserve_sources: sources.map(s => ({ ...s, amount: Number(s.amount.replace(/\D/g, '')) || 0 })),
          readiness_level: Number(form.readiness_level) || 1,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGenerated(data)
      setTab(4)
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function handleSave() {
    if (!generated) return
    setSaving(true)
    try {
      const { error: dbErr } = await supabase.from('cfp_reports').insert({
        report_name: form.report_name, analyst_name: form.analyst_name,
        n1: p('n1'), lcr: p('lcr'), deposit_outflow_7d: p('deposit_outflow_7d'), top5_share: p('top5_share'),
        hqla_l1: n('hqla_l1'), hqla_l2a: n('hqla_l2a'), hqla_l2b: n('hqla_l2b'),
        ob_interbank: n('ob_interbank'), ob_current: n('ob_current'), ob_savings: n('ob_savings'), ob_term: n('ob_term'), ob_credit_lines: n('ob_credit_lines'),
        reserve_sources: sources.map(s => ({ ...s, amount: Number(s.amount.replace(/\D/g, '')) || 0 })),
        readiness_level: Number(form.readiness_level) || 1,
        survival_horizon: generated.survival_horizon,
        reserve_coverage: generated.reserve_coverage,
        overall_status: generated.overall_status,
        ai_conclusion: generated.conclusion,
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

  const tabs = [
    { n: 1, t: 'EWI & Показатели' },
    { n: 2, t: 'HQLA & Обязательства' },
    { n: 3, t: 'Резервные источники' },
    { n: 4, t: 'CFP-заключение' },
  ]

  const rl = READINESS_LEVELS[Number(form.readiness_level) || 1]

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">План финансирования на ЧС (CFP)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contingency Funding Plan · EWI мониторинг · Survival Horizon · Резервные источники</p>
        </div>
        <button onClick={() => { resetModal(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый CFP
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Всего отчётов', value: reports.length, c: 'text-gray-900' },
          { label: 'Норма', value: reports.filter(r => r.overall_status === 'green').length, c: 'text-[#1B8A4C]' },
          { label: 'Бдительность', value: reports.filter(r => r.overall_status === 'yellow').length, c: 'text-yellow-600' },
          { label: 'Кризис', value: reports.filter(r => r.overall_status === 'red').length, c: 'text-red-600' },
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
              {['Отчёт','Аналитик','EWI','Н1','LCR','Отток 7д','Survival','Покрытие','Готовность','Дата',''].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? <tr><td colSpan={11} className="text-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : reports.length === 0
              ? <tr><td colSpan={11} className="text-center py-12 text-gray-400"><ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Нет CFP-отчётов</p></td></tr>
              : reports.map(r => {
                const os = (r.overall_status || 'green') as EwiStatus
                const rlv = READINESS_LEVELS[r.readiness_level] || READINESS_LEVELS[1]
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-semibold text-gray-900">{r.report_name}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.analyst_name || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ewiColor(os)}`}>
                        {EWI_EMOJI[os]} {EWI_LABEL[os]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium">{r.n1}%</td>
                    <td className="px-3 py-3 text-xs font-medium">{r.lcr}%</td>
                    <td className="px-3 py-3 text-xs font-medium">{r.deposit_outflow_7d}%</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-bold ${(r.survival_horizon || 0) >= 30 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                        {r.survival_horizon === 999 ? '∞' : `${r.survival_horizon} дн.`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-bold ${(r.reserve_coverage || 0) >= 100 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                        {r.reserve_coverage}%
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rlv.bg} ${rlv.color}`}>
                        Ур.{r.readiness_level}
                      </span>
                    </td>
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

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">{viewing.report_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ewiColor((viewing.overall_status || 'green') as EwiStatus)}`}>
                    {EWI_EMOJI[(viewing.overall_status || 'green') as EwiStatus]} {EWI_LABEL[(viewing.overall_status || 'green') as EwiStatus]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).bg} ${(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).color}`}>
                    {(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* EWI Grid */}
              <div className="grid grid-cols-2 gap-3">
                <EwiBadge status={ewiN1(viewing.n1)} label="Н1 (достаточность капитала)" value={viewing.n1} />
                <EwiBadge status={ewiLcr(viewing.lcr)} label="LCR (краткосрочная ликвидность)" value={viewing.lcr} />
                <EwiBadge status={ewiOutflow(viewing.deposit_outflow_7d)} label="Отток депозитов 7 дней" value={viewing.deposit_outflow_7d} />
                <EwiBadge status={ewiTop5(viewing.top5_share)} label="Доля топ-5 депозиторов" value={viewing.top5_share} />
              </div>
              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border-2 text-center ${viewing.survival_horizon >= 30 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Survival Horizon</p>
                  <p className={`text-2xl font-bold ${viewing.survival_horizon >= 30 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                    {viewing.survival_horizon === 999 ? '∞' : `${viewing.survival_horizon} дн.`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{viewing.survival_horizon >= 30 ? '✓ цель ≥30 дней достигнута' : '✗ ниже цели 30 дней'}</p>
                </div>
                <div className={`p-4 rounded-xl border-2 text-center ${viewing.reserve_coverage >= 100 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Покрытие резервами</p>
                  <p className={`text-2xl font-bold ${viewing.reserve_coverage >= 100 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>{viewing.reserve_coverage}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">{viewing.reserve_coverage >= 100 ? '✓ отток покрыт' : '✗ недостаточно'}</p>
                </div>
                <div className={`p-4 rounded-xl border-2 text-center ${(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).border} ${(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).bg}`}>
                  <p className="text-xs text-gray-500 mb-1">Готовность</p>
                  <p className={`text-2xl font-bold ${(READINESS_LEVELS[viewing.readiness_level] || READINESS_LEVELS[1]).color}`}>Ур. {viewing.readiness_level}</p>
                  <p className="text-xs text-gray-400 mt-0.5">из 4</p>
                </div>
              </div>
              {/* Reserve sources */}
              {viewing.reserve_sources?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Резервные источники фондирования</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Источник','Сумма (млн TJS)','Статус','Срок доступа'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewing.reserve_sources.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                            <td className="px-3 py-2">{fmt(s.amount)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.status === 'Доступен' ? 'bg-green-100 text-green-700' : s.status === 'Условно доступен' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{s.access_term}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* AI Conclusion */}
              {viewing.ai_conclusion && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" /> CFP-заключение
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

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">Новый CFP-отчёт</h2>
                <p className="text-xs text-gray-500 mt-0.5">Contingency Funding Plan · Алиф Банк</p>
              </div>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 gap-1">
              {tabs.map(t => (
                <button key={t.n} onClick={() => setTab(t.n)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.n}. {t.t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              {/* Tab 1: EWI */}
              {tab === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Название отчёта *</label><input type="text" value={form.report_name} onChange={e => setF('report_name', e.target.value)} placeholder="CFP Июнь 2026" className={inp} /></div>
                    <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">EWI-индикаторы раннего предупреждения</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { k: 'n1', label: 'Н1 — Достаточность капитала (%)', hint: 'Жёлтый <45% | Красный <40%' },
                        { k: 'lcr', label: 'LCR — Краткосрочная ликвидность (%)', hint: 'Жёлтый <100% | Красный <80%' },
                        { k: 'deposit_outflow_7d', label: 'Отток депозитов 7 дней (%)', hint: 'Жёлтый >3% | Красный >7%' },
                        { k: 'top5_share', label: 'Доля топ-5 депозиторов (%)', hint: 'Жёлтый >15% | Красный >20%' },
                      ].map(f => {
                        const val = Number(form[f.k]) || 0
                        const st = f.k === 'n1' ? ewiN1(val) : f.k === 'lcr' ? ewiLcr(val) : f.k === 'deposit_outflow_7d' ? ewiOutflow(val) : ewiTop5(val)
                        return (
                          <div key={f.k}>
                            <label className={lbl}>{f.label}</label>
                            <div className="flex items-center gap-2">
                              <input type="text" inputMode="decimal" value={form[f.k]} onChange={e => setF(f.k, pct(e.target.value))} placeholder="0" className={inpNum + ' flex-1'} />
                              <span className="text-lg flex-shrink-0">{form[f.k] ? EWI_EMOJI[st] : '○'}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Live EWI preview */}
                  {(form.n1 || form.lcr || form.deposit_outflow_7d || form.top5_share) && (
                    <div className="grid grid-cols-2 gap-2">
                      {p('n1') > 0 && <EwiBadge status={s_n1} label="Н1" value={p('n1')} />}
                      {p('lcr') > 0 && <EwiBadge status={s_lcr} label="LCR" value={p('lcr')} />}
                      {p('deposit_outflow_7d') > 0 && <EwiBadge status={s_out} label="Отток 7д" value={p('deposit_outflow_7d')} />}
                      {p('top5_share') > 0 && <EwiBadge status={s_top5} label="Топ-5" value={p('top5_share')} />}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Текущий уровень готовности</p>
                    <div className="grid grid-cols-4 gap-2">
                      {([1, 2, 3, 4] as const).map(l => {
                        const lvl = READINESS_LEVELS[l]
                        const active = Number(form.readiness_level) === l
                        return (
                          <button key={l} onClick={() => setF('readiness_level', String(l))}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${active ? `${lvl.bg} ${lvl.border} ${lvl.color}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            <p className="text-base font-bold">{l}</p>
                            <p className="text-[10px] font-medium leading-tight mt-0.5">{lvl.label.replace(`Уровень ${l} — `, '')}</p>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{rl.desc}</p>
                  </div>
                </>
              )}

              {/* Tab 2: HQLA & Obligations */}
              {tab === 2 && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">HQLA — Высококачественные ликвидные активы (млн TJS)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { k: 'hqla_l1', label: 'Уровень 1 (L1)', hint: 'Нет haircut (наличные, ГЦБ)' },
                        { k: 'hqla_l2a', label: 'Уровень 2A (L2A)', hint: 'Haircut 15% (корп. облигации AA-)' },
                        { k: 'hqla_l2b', label: 'Уровень 2B (L2B)', hint: 'Haircut 50% (акции, MBS)' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric" value={form[f.k]} onChange={e => setF(f.k, fmtN(e.target.value))} placeholder="0" className={inpNum} />
                          <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
                        </div>
                      ))}
                    </div>
                    {hqlaTotal > 0 && (
                      <div className="mt-3 p-3 bg-[#1B8A4C]/8 rounded-lg flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Итого HQLA: <b>{fmt(hqlaTotal)} млн TJS</b></span>
                        <span className="text-gray-500">После haircut 35%: <b className="text-[#1B8A4C]">{fmt(hqlaTotal * 0.65)} млн TJS</b></span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Структура обязательств (млн TJS)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { k: 'ob_interbank', label: 'Межбанковские обязательства' },
                        { k: 'ob_current', label: 'Текущие счета клиентов' },
                        { k: 'ob_savings', label: 'Накопительные/сберегательные' },
                        { k: 'ob_term', label: 'Срочные депозиты' },
                        { k: 'ob_credit_lines', label: 'Кредитные линии (невыбранные)' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric" value={form[f.k]} onChange={e => setF(f.k, fmtN(e.target.value))} placeholder="0" className={inpNum} />
                        </div>
                      ))}
                    </div>
                    {totalObligations > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Итого обязательства: <b>{fmt(totalObligations)} млн TJS</b></span>
                        <span className="text-gray-500">Депозиты: <b>{fmt(totalDeposits)} млн TJS</b></span>
                      </div>
                    )}
                  </div>

                  {/* Survival Horizon preview */}
                  {hqlaTotal > 0 && totalDeposits > 0 && p('deposit_outflow_7d') > 0 && (
                    <div className={`p-4 rounded-xl border-2 ${survivalHorizon >= 30 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Survival Horizon (расчёт)</p>
                          <p className={`text-2xl font-bold ${survivalHorizon >= 30 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                            {survivalHorizon === 999 ? '∞' : `${survivalHorizon} дней`}
                          </p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>HQLA eff: {fmt(hqlaTotal * 0.65)} млн</p>
                          <p>Daily outflow: {fmt((totalDeposits * p('deposit_outflow_7d') / 100) / 7)} млн</p>
                          <p className={survivalHorizon >= 30 ? 'text-[#1B8A4C] font-semibold' : 'text-red-600 font-semibold'}>
                            {survivalHorizon >= 30 ? '✓ Цель ≥30 дней достигнута' : '✗ Ниже цели 30 дней'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tab 3: Reserve Sources */}
              {tab === 3 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Резервные источники фондирования</p>
                    <button onClick={() => setSources(p => [...p, { ...EMPTY_SOURCE }])}
                      className="flex items-center gap-1 text-xs text-[#1B8A4C] hover:text-[#177040] font-medium">
                      <Plus className="w-3.5 h-3.5" /> Добавить
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sources.map((s, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                        <div className="col-span-4">
                          {i === 0 && <p className={lbl}>Источник фондирования</p>}
                          <input type="text" value={s.name} onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                            placeholder="Кредитная линия НБТ" className={inp} />
                        </div>
                        <div className="col-span-2">
                          {i === 0 && <p className={lbl}>Сумма (млн TJS)</p>}
                          <input type="text" inputMode="numeric" value={s.amount} onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, amount: fmtN(e.target.value) } : r))}
                            placeholder="0" className={inpNum} />
                        </div>
                        <div className="col-span-3">
                          {i === 0 && <p className={lbl}>Статус</p>}
                          <select value={s.status} onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                            className={inp}>
                            {RESERVE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          {i === 0 && <p className={lbl}>Срок доступа</p>}
                          <input type="text" value={s.access_term} onChange={e => setSources(prev => prev.map((r, j) => j === i ? { ...r, access_term: e.target.value } : r))}
                            placeholder="24ч" className={inp} />
                        </div>
                        <div className="col-span-1 flex items-end pb-0.5">
                          {i === 0 && <p className={lbl}>&nbsp;</p>}
                          {sources.length > 1 && (
                            <button onClick={() => setSources(prev => prev.filter((_, j) => j !== i))}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {reserveTotal > 0 && pessimisticOutflow > 0 && (
                    <div className={`mt-4 p-4 rounded-xl border-2 ${reserveCoverage >= 100 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Покрытие резервными источниками</p>
                          <p className={`text-2xl font-bold ${reserveCoverage >= 100 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>{reserveCoverage}%</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>Резервы: {fmt(reserveTotal)} млн TJS</p>
                          <p>Пессимист. отток: {fmt(pessimisticOutflow)} млн TJS</p>
                          <p className={reserveCoverage >= 100 ? 'text-[#1B8A4C] font-semibold' : 'text-red-600 font-semibold'}>
                            {reserveCoverage >= 100 ? '✓ Отток покрыт' : '✗ Недостаточное покрытие'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: AI Conclusion */}
              {tab === 4 && (
                <div className="space-y-4">
                  {!generated ? (
                    <div className="text-center py-12 text-gray-400">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Нажмите «Сгенерировать CFP» для получения заключения</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`p-4 rounded-xl border-2 text-center ${generated.survival_horizon >= 30 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                          <p className="text-xs text-gray-500">Survival Horizon</p>
                          <p className={`text-2xl font-bold ${generated.survival_horizon >= 30 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>
                            {generated.survival_horizon === 999 ? '∞' : `${generated.survival_horizon} дн.`}
                          </p>
                        </div>
                        <div className={`p-4 rounded-xl border-2 text-center ${generated.reserve_coverage >= 100 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                          <p className="text-xs text-gray-500">Покрытие резервами</p>
                          <p className={`text-2xl font-bold ${generated.reserve_coverage >= 100 ? 'text-[#1B8A4C]' : 'text-red-600'}`}>{generated.reserve_coverage}%</p>
                        </div>
                        <div className={`p-4 rounded-xl border-2 text-center border ${ewiColor((generated.overall_status || 'green') as EwiStatus)}`}>
                          <p className="text-xs text-gray-500">EWI-статус</p>
                          <p className="text-2xl">{EWI_EMOJI[(generated.overall_status || 'green') as EwiStatus]}</p>
                          <p className="text-xs font-semibold">{EWI_LABEL[(generated.overall_status || 'green') as EwiStatus]}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-[#1B8A4C]" /> CFP-заключение
                        </p>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{generated.conclusion}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {tab > 1 && (
                  <button onClick={() => setTab(t => t - 1)} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ← Назад
                  </button>
                )}
                {tab < 3 && (
                  <button onClick={() => setTab(t => t + 1)} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Далее <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowModal(false); resetModal() }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</> : <><ShieldAlert className="w-4 h-4" /> Сгенерировать CFP</>}
                </button>
                {generated && (
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Сохранение...' : <><CheckCircle className="w-4 h-4" /> Сохранить</>}
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

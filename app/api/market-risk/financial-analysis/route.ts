'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react'

interface FinAnalysis {
  id: string; code: string; analyst_name: string
  p1_label: string; p2_label: string
  p1_cash: number; p2_cash: number
  p1_receivables: number; p2_receivables: number
  p1_investments: number; p2_investments: number
  p1_loans_issued: number; p2_loans_issued: number
  p1_fixed_assets: number; p2_fixed_assets: number
  p1_other_assets: number; p2_other_assets: number
  p1_deposits: number; p2_deposits: number
  p1_borrowings: number; p2_borrowings: number
  p1_other_liab: number; p2_other_liab: number
  p1_equity: number; p2_equity: number
  p1_interest_income: number; p2_interest_income: number
  p1_interest_expense: number; p2_interest_expense: number
  p1_fee_income: number; p2_fee_income: number
  p1_operating_expense: number; p2_operating_expense: number
  p1_provisions: number; p2_provisions: number
  p1_net_profit: number; p2_net_profit: number
  ai_conclusion: string; created_at: string
}

const EMPTY = {
  code: '', analyst_name: '', p1_label: '', p2_label: '',
  p1_cash: '', p2_cash: '', p1_receivables: '', p2_receivables: '',
  p1_investments: '', p2_investments: '', p1_loans_issued: '', p2_loans_issued: '',
  p1_fixed_assets: '', p2_fixed_assets: '', p1_other_assets: '', p2_other_assets: '',
  p1_deposits: '', p2_deposits: '', p1_borrowings: '', p2_borrowings: '',
  p1_other_liab: '', p2_other_liab: '', p1_equity: '', p2_equity: '',
  p1_interest_income: '', p2_interest_income: '', p1_interest_expense: '', p2_interest_expense: '',
  p1_fee_income: '', p2_fee_income: '', p1_operating_expense: '', p2_operating_expense: '',
  p1_provisions: '', p2_provisions: '', p1_net_profit: '', p2_net_profit: '',
}

const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g, '')) || 0

interface FRProps {
  label: string; f1: string; f2: string
  form: Record<string, string>; setF: (k: string, v: string) => void
  bold?: boolean; auto?: boolean; v1?: number; v2?: number
}
function FR({ label, f1, f2, bold, auto, v1, v2, form, setF }: FRProps) {
  const cls = "w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] text-right bg-white"
  return (
    <tr className={bold ? 'bg-gray-50' : 'hover:bg-blue-50/20'}>
      <td className={`px-3 py-2 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</td>
      <td className="px-2 py-1">
        {auto ? <div className={`text-sm font-bold text-right pr-2 ${(v1||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v1||0)}</div>
          : <input type="text" inputMode="numeric" value={form[f1] || ''} onChange={e => setF(f1, fmtN(e.target.value))} className={cls} placeholder="0" />}
      </td>
      <td className="px-2 py-1">
        {auto ? <div className={`text-sm font-bold text-right pr-2 ${(v2||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v2||0)}</div>
          : <input type="text" inputMode="numeric" value={form[f2] || ''} onChange={e => setF(f2, fmtN(e.target.value))} className={cls} placeholder="0" />}
      </td>
    </tr>
  )
}

function FT({ title, p1, p2, children }: { title: string; p1: string; p2: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#1B8A4C] text-white">
            <th className="text-left px-3 py-2 text-xs font-medium w-1/2">Показатель</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-1/4">{p1 || 'Период 1'}</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-1/4">{p2 || 'Период 2'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

export default function FinancialAnalysisPage() {
  const [analyses, setAnalyses] = useState<FinAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<FinAnalysis | null>(null)
  const [tab, setTab] = useState(1)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('counterparty_financials').select('*').order('created_at', { ascending: false })
    setAnalyses(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const n = (k: string) => parseN(form[k] || '')
  const p1 = form.p1_label || 'Период 1'
  const p2 = form.p2_label || 'Период 2'

  // Computed
  const p1_total_assets = n('p1_cash') + n('p1_receivables') + n('p1_investments') + n('p1_loans_issued') + n('p1_fixed_assets') + n('p1_other_assets')
  const p2_total_assets = n('p2_cash') + n('p2_receivables') + n('p2_investments') + n('p2_loans_issued') + n('p2_fixed_assets') + n('p2_other_assets')
  const p1_total_liab = n('p1_deposits') + n('p1_borrowings') + n('p1_other_liab')
  const p2_total_liab = n('p2_deposits') + n('p2_borrowings') + n('p2_other_liab')
  const p1_total_passiv = p1_total_liab + n('p1_equity')
  const p2_total_passiv = p2_total_liab + n('p2_equity')
  const p1_nim = n('p1_interest_income') - n('p1_interest_expense')
  const p2_nim = n('p2_interest_income') - n('p2_interest_expense')
  const p1_op_income = p1_nim + n('p1_fee_income')
  const p2_op_income = p2_nim + n('p2_fee_income')
  const p1_pre_tax = p1_op_income - n('p1_operating_expense') - n('p1_provisions')
  const p2_pre_tax = p2_op_income - n('p2_operating_expense') - n('p2_provisions')

  // Ratios
  const p1_car = p1_total_assets > 0 ? (n('p1_equity') / p1_total_assets * 100) : 0
  const p2_car = p2_total_assets > 0 ? (n('p2_equity') / p2_total_assets * 100) : 0
  const p1_roe = n('p1_equity') > 0 ? (n('p1_net_profit') / n('p1_equity') * 100) : 0
  const p2_roe = n('p2_equity') > 0 ? (n('p2_net_profit') / n('p2_equity') * 100) : 0

  async function handleGenerate() {
    if (!form.code.trim()) { setError('Введите код контрагента'); return }
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/market-risk/financial-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code, p1_label: p1, p2_label: p2,
          p1_total_assets, p2_total_assets,
          p1_total_liab, p2_total_liab,
          p1_equity: n('p1_equity'), p2_equity: n('p2_equity'),
          p1_nim, p2_nim, p1_op_income, p2_op_income,
          p1_net_profit: n('p1_net_profit'), p2_net_profit: n('p2_net_profit'),
          p1_car: Math.round(p1_car * 10) / 10, p2_car: Math.round(p2_car * 10) / 10,
          p1_roe: Math.round(p1_roe * 10) / 10, p2_roe: Math.round(p2_roe * 10) / 10,
          p1_provisions: n('p1_provisions'), p2_provisions: n('p2_provisions'),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const vals = (k: string) => parseN(form[k] || '')
      const { error: dbErr } = await supabase.from('counterparty_financials').insert({
        code: form.code, analyst_name: form.analyst_name,
        p1_label: p1, p2_label: p2,
        p1_cash: vals('p1_cash'), p2_cash: vals('p2_cash'),
        p1_receivables: vals('p1_receivables'), p2_receivables: vals('p2_receivables'),
        p1_investments: vals('p1_investments'), p2_investments: vals('p2_investments'),
        p1_loans_issued: vals('p1_loans_issued'), p2_loans_issued: vals('p2_loans_issued'),
        p1_fixed_assets: vals('p1_fixed_assets'), p2_fixed_assets: vals('p2_fixed_assets'),
        p1_other_assets: vals('p1_other_assets'), p2_other_assets: vals('p2_other_assets'),
        p1_deposits: vals('p1_deposits'), p2_deposits: vals('p2_deposits'),
        p1_borrowings: vals('p1_borrowings'), p2_borrowings: vals('p2_borrowings'),
        p1_other_liab: vals('p1_other_liab'), p2_other_liab: vals('p2_other_liab'),
        p1_equity: vals('p1_equity'), p2_equity: vals('p2_equity'),
        p1_interest_income: vals('p1_interest_income'), p2_interest_income: vals('p2_interest_income'),
        p1_interest_expense: vals('p1_interest_expense'), p2_interest_expense: vals('p2_interest_expense'),
        p1_fee_income: vals('p1_fee_income'), p2_fee_income: vals('p2_fee_income'),
        p1_operating_expense: vals('p1_operating_expense'), p2_operating_expense: vals('p2_operating_expense'),
        p1_provisions: vals('p1_provisions'), p2_provisions: vals('p2_provisions'),
        p1_net_profit: vals('p1_net_profit'), p2_net_profit: vals('p2_net_profit'),
        ai_conclusion: data.conclusion,
      })
      if (dbErr) throw new Error(dbErr.message)

      // Auto-create counterparty registry entry
      await supabase.from('counterparties').upsert({ code: form.code, updated_at: new Date().toISOString() }, { onConflict: 'code', ignoreDuplicates: true })

      setShowModal(false); setForm(EMPTY); setTab(1); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('counterparty_financials').delete().eq('id', id)
    fetch_()
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Финансовый анализ контрагента</h1>
          <p className="text-sm text-gray-500 mt-0.5">Анализ финансовой отчётности банков-контрагентов за два периода</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setTab(1); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый анализ
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Всего анализов', value: analyses.length, c: 'text-gray-900' },
          { label: 'В этом году', value: analyses.filter(a => new Date(a.created_at).getFullYear() === new Date().getFullYear()).length, c: 'text-green-600' },
          { label: 'Уникальных контрагентов', value: new Set(analyses.map(a => a.code)).size, c: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Контрагент','Аналитик','Периоды','Активы П2','CAR П2','ROE П2','Дата',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              : analyses.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Нет анализов</td></tr>
              : analyses.map(a => {
                const car2 = a.p2_equity && (a.p2_cash + a.p2_receivables + a.p2_investments + a.p2_loans_issued + a.p2_fixed_assets + a.p2_other_assets) > 0
                  ? (a.p2_equity / (a.p2_cash + a.p2_receivables + a.p2_investments + a.p2_loans_issued + a.p2_fixed_assets + a.p2_other_assets) * 100).toFixed(1)
                  : null
                const roe2 = a.p2_equity > 0 ? (a.p2_net_profit / a.p2_equity * 100).toFixed(1) : null
                const assets2 = a.p2_cash + a.p2_receivables + a.p2_investments + a.p2_loans_issued + a.p2_fixed_assets + a.p2_other_assets
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{a.code}</td>
                    <td className="px-4 py-3 text-gray-600">{a.analyst_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.p1_label} → {a.p2_label}</td>
                    <td className="px-4 py-3 text-sm font-medium">{assets2 > 0 ? fmt(assets2) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{car2 ? `${car2}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{roe2 ? `${roe2}%` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{viewing.code} — Финансовый анализ</h2>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Активы П1', fmt(viewing.p1_cash + viewing.p1_receivables + viewing.p1_investments + viewing.p1_loans_issued + viewing.p1_fixed_assets + viewing.p1_other_assets)],
                  ['Активы П2', fmt(viewing.p2_cash + viewing.p2_receivables + viewing.p2_investments + viewing.p2_loans_issued + viewing.p2_fixed_assets + viewing.p2_other_assets)],
                  ['Чистая прибыль П1', fmt(viewing.p1_net_profit)],
                  ['Чистая прибыль П2', fmt(viewing.p2_net_profit)],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {viewing.ai_conclusion && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Финансовый анализ</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewing.ai_conclusion}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">Финансовый анализ контрагента</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex border-b border-gray-100 px-4">
              {[{n:1,t:'Общее'},{n:2,t:'Баланс'},{n:3,t:'ОПУ'}].map(({n:tn,t}) => (
                <button key={tn} onClick={() => setTab(tn)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${tab===tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tn}. {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}

              {tab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Код контрагента *</label>
                    <input type="text" value={form.code} onChange={e => setF('code', e.target.value)} placeholder="Контрагент-001" className={inp} />
                    <p className="text-xs text-gray-400 mt-1">Используйте код вместо реального названия</p>
                  </div>
                  <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  <div><label className={lbl}>Название периода 1</label><input type="text" value={form.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="31.12.2024" className={inp} /></div>
                  <div><label className={lbl}>Название периода 2</label><input type="text" value={form.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="31.03.2025" className={inp} /></div>
                  <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-800">💡 Все суммы в USD. После заполнения AI сгенерирует профессиональный финансовый анализ.</p>
                  </div>
                </div>
              )}

              {tab === 2 && (
                <div className="space-y-2">
                  <FT title="АКТИВ" p1={p1} p2={p2}>
                    <FR label="Денежные средства и счета в ЦБ" f1="p1_cash" f2="p2_cash" form={form} setF={setF} />
                    <FR label="Средства в других банках" f1="p1_receivables" f2="p2_receivables" form={form} setF={setF} />
                    <FR label="Инвестиционные ценные бумаги" f1="p1_investments" f2="p2_investments" form={form} setF={setF} />
                    <FR label="Кредитный портфель (нетто)" f1="p1_loans_issued" f2="p2_loans_issued" form={form} setF={setF} />
                    <FR label="Основные средства" f1="p1_fixed_assets" f2="p2_fixed_assets" form={form} setF={setF} />
                    <FR label="Прочие активы" f1="p1_other_assets" f2="p2_other_assets" form={form} setF={setF} />
                    <FR label="ИТОГО АКТИВ" bold auto v1={p1_total_assets} v2={p2_total_assets} f1="" f2="" form={form} setF={setF} />
                  </FT>
                  <FT title="ПАССИВ" p1={p1} p2={p2}>
                    <FR label="Депозиты клиентов" f1="p1_deposits" f2="p2_deposits" form={form} setF={setF} />
                    <FR label="Заёмные средства (МБК, займы)" f1="p1_borrowings" f2="p2_borrowings" form={form} setF={setF} />
                    <FR label="Прочие обязательства" f1="p1_other_liab" f2="p2_other_liab" form={form} setF={setF} />
                    <FR label="Итого обязательства" bold auto v1={p1_total_liab} v2={p2_total_liab} f1="" f2="" form={form} setF={setF} />
                    <FR label="Собственный капитал" f1="p1_equity" f2="p2_equity" form={form} setF={setF} />
                    <FR label="ИТОГО ПАССИВ" bold auto v1={p1_total_passiv} v2={p2_total_passiv} f1="" f2="" form={form} setF={setF} />
                  </FT>
                  {(p1_car > 0 || p2_car > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 rounded-lg ${p2_car >= 13 ? 'bg-green-50' : p2_car >= 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500">CAR П1 → П2</p>
                        <p className={`text-xl font-bold ${p2_car >= 13 ? 'text-green-600' : p2_car >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>{p1_car.toFixed(1)}% → {p2_car.toFixed(1)}%</p>
                      </div>
                      <div className={`p-3 rounded-lg ${p2_roe >= 10 ? 'bg-green-50' : p2_roe >= 5 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500">ROE П1 → П2</p>
                        <p className={`text-xl font-bold ${p2_roe >= 10 ? 'text-green-600' : p2_roe >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{p1_roe.toFixed(1)}% → {p2_roe.toFixed(1)}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 3 && (
                <FT title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ" p1={p1} p2={p2}>
                  <FR label="Процентные доходы" f1="p1_interest_income" f2="p2_interest_income" form={form} setF={setF} />
                  <FR label="Процентные расходы" f1="p1_interest_expense" f2="p2_interest_expense" form={form} setF={setF} />
                  <FR label="▶ Чистый процентный доход (NIM)" bold auto v1={p1_nim} v2={p2_nim} f1="" f2="" form={form} setF={setF} />
                  <FR label="Комиссионные доходы" f1="p1_fee_income" f2="p2_fee_income" form={form} setF={setF} />
                  <FR label="▶ Операционный доход" bold auto v1={p1_op_income} v2={p2_op_income} f1="" f2="" form={form} setF={setF} />
                  <FR label="Операционные расходы" f1="p1_operating_expense" f2="p2_operating_expense" form={form} setF={setF} />
                  <FR label="Резервы на потери по кредитам" f1="p1_provisions" f2="p2_provisions" form={form} setF={setF} />
                  <FR label="▶ Прибыль до налогов" bold auto v1={p1_pre_tax} v2={p2_pre_tax} f1="" f2="" form={form} setF={setF} />
                  <FR label="▶ Чистая прибыль" bold f1="p1_net_profit" f2="p2_net_profit" form={form} setF={setF} />
                </FT>
              )}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {tab < 3
                  ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                  : <button onClick={handleGenerate} disabled={generating}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать анализ</>}
                    </button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

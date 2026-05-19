'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, FileText, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Filter } from 'lucide-react'

interface Collateral { type: string; description: string; value: number }

interface CreditConclusion {
  id: string
  borrower_name: string; borrower_inn: string; business_type: string
  years_in_business: number; loan_amount: number; loan_currency: string
  loan_term: string; loan_term_months: number; interest_rate: number
  loan_purpose: string; credit_history: string; analyst_name: string
  p1_label: string; p2_label: string
  p1_revenue: number; p1_cogs: number; p1_gross_profit: number
  p1_sales_expense: number; p1_admin_expense: number; p1_other_op_income: number
  p1_non_op: number; p1_tax: number; p1_net_profit: number
  p2_revenue: number; p2_cogs: number; p2_gross_profit: number
  p2_sales_expense: number; p2_admin_expense: number; p2_other_op_income: number
  p2_non_op: number; p2_tax: number; p2_net_profit: number
  p1_cash: number; p1_receivables: number; p1_inventory: number; p1_fixed_assets: number; p1_other_assets: number
  p1_supplier_debt: number; p1_bank_debt: number; p1_other_liabilities: number
  p1_equity_capital: number; p1_reserves: number; p1_retained_earnings: number
  p2_cash: number; p2_receivables: number; p2_inventory: number; p2_fixed_assets: number; p2_other_assets: number
  p2_supplier_debt: number; p2_bank_debt: number; p2_other_liabilities: number
  p2_equity_capital: number; p2_reserves: number; p2_retained_earnings: number
  p1_cash_begin: number; p1_op_inflow: number; p1_op_outflow: number
  p1_fin_inflow: number; p1_fin_outflow: number; p1_inv_inflow: number; p1_inv_outflow: number; p1_cash_end: number
  p2_cash_begin: number; p2_op_inflow: number; p2_op_outflow: number
  p2_fin_inflow: number; p2_fin_outflow: number; p2_inv_inflow: number; p2_inv_outflow: number; p2_cash_end: number
  collaterals: Collateral[]
  ai_conclusion: string; recommendation: string; risk_level: string; created_at: string
}

const EMPTY: Record<string, string> = {
  borrower_name: '', borrower_inn: '', business_type: '', years_in_business: '',
  loan_amount: '', loan_currency: 'TJS', loan_term_months: '', interest_rate: '',
  loan_purpose: '', credit_history: 'Положительная', analyst_name: '',
  p1_label: '', p2_label: '',
  // Баланс
  p1_cash: '', p1_receivables: '', p1_inventory: '', p1_fixed_assets: '', p1_other_assets: '',
  p1_supplier_debt: '', p1_bank_debt: '', p1_other_liabilities: '',
  p1_equity_capital: '', p1_reserves: '', p1_retained_earnings: '',
  p2_cash: '', p2_receivables: '', p2_inventory: '', p2_fixed_assets: '', p2_other_assets: '',
  p2_supplier_debt: '', p2_bank_debt: '', p2_other_liabilities: '',
  p2_equity_capital: '', p2_reserves: '', p2_retained_earnings: '',
  // ОПУ
  p1_revenue: '', p1_cogs: '', p1_sales_expense: '', p1_admin_expense: '', p1_other_op_income: '', p1_non_op: '', p1_tax: '',
  p2_revenue: '', p2_cogs: '', p2_sales_expense: '', p2_admin_expense: '', p2_other_op_income: '', p2_non_op: '', p2_tax: '',
  // КешФлоу
  p1_cash_begin: '', p1_op_inflow: '', p1_op_outflow: '', p1_fin_inflow: '', p1_fin_outflow: '', p1_inv_inflow: '', p1_inv_outflow: '',
  p2_cash_begin: '', p2_op_inflow: '', p2_op_outflow: '', p2_fin_inflow: '', p2_fin_outflow: '', p2_inv_inflow: '', p2_inv_outflow: '',
}

const COLLATERAL_TYPES = ['Недвижимость', 'Автотранспорт', 'Оборудование', 'Товары в обороте', 'Депозит', 'Поручительство', 'Другое']
const CREDIT_HISTORY = ['Положительная', 'Нейтральная', 'Отрицательная', 'Отсутствует']
const CURRENCIES = ['TJS', 'USD', 'EUR', 'RUB']

// ─── Sub-components OUTSIDE main component (prevent focus loss on re-render) ───

interface FRProps {
  label: string; f1?: string; f2?: string
  bold?: boolean; auto?: boolean; v1?: number; v2?: number
  formData: Record<string, string>; setF: (k: string, v: string) => void
}

function FR({ label, f1, f2, bold, auto, v1, v2, formData, setF }: FRProps) {
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))
  const cls = "w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] text-right bg-white"
  return (
    <tr className={bold ? 'bg-gray-50' : 'hover:bg-blue-50/20'}>
      <td className={`px-3 py-2 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</td>
      <td className="px-2 py-1">
        {auto
          ? <div className={`text-sm font-bold text-right pr-2 ${(v1||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v1||0)}</div>
          : <input type="text" inputMode="numeric" value={f1 ? formData[f1] || '' : ''} onChange={e => f1 && setF(f1, e.target.value.replace(/[^0-9.-]/g, ''))} className={cls} placeholder="0" />}
      </td>
      <td className="px-2 py-1">
        {auto
          ? <div className={`text-sm font-bold text-right pr-2 ${(v2||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v2||0)}</div>
          : <input type="text" inputMode="numeric" value={f2 ? formData[f2] || '' : ''} onChange={e => f2 && setF(f2, e.target.value.replace(/[^0-9.-]/g, ''))} className={cls} placeholder="0" />}
      </td>
    </tr>
  )
}

interface FTProps { title: string; p1: string; p2: string; children: React.ReactNode }

function FT({ title, p1, p2, children }: FTProps) {
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

// ─── Main component ───

export default function CreditRiskPage() {
  const [conclusions, setConclusions] = useState<CreditConclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [collaterals, setCollaterals] = useState<Collateral[]>([{ type: 'Недвижимость', description: '', value: 0 }])
  const [guarantors, setGuarantors] = useState<{name: string; inn: string; relation: string}[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<CreditConclusion | null>(null)
  const [tab, setTab] = useState(1)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('credit_conclusions').select('*').order('created_at', { ascending: false })
    if (filterYear) query = query.gte('created_at', `${filterYear}-01-01`).lte('created_at', `${filterYear}-12-31`)
    if (filterYear && filterMonth) query = query.gte('created_at', `${filterYear}-${filterMonth}-01`).lte('created_at', `${filterYear}-${filterMonth}-31`)
    const { data } = await query
    setConclusions(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  const n = (k: string) => Number(form[k]) || 0
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'

  // ── Computed values ──
  const p1 = form.p1_label || 'Период 1'
  const p2 = form.p2_label || 'Период 2'

  // Баланс
  const p1_total_assets = n('p1_cash') + n('p1_receivables') + n('p1_inventory') + n('p1_fixed_assets') + n('p1_other_assets')
  const p2_total_assets = n('p2_cash') + n('p2_receivables') + n('p2_inventory') + n('p2_fixed_assets') + n('p2_other_assets')
  const p1_total_liab = n('p1_supplier_debt') + n('p1_bank_debt') + n('p1_other_liabilities')
  const p2_total_liab = n('p2_supplier_debt') + n('p2_bank_debt') + n('p2_other_liabilities')
  const p1_total_equity = n('p1_equity_capital') + n('p1_reserves') + n('p1_retained_earnings')
  const p2_total_equity = n('p2_equity_capital') + n('p2_reserves') + n('p2_retained_earnings')
  const p1_total_passiv = p1_total_liab + p1_total_equity
  const p2_total_passiv = p2_total_liab + p2_total_equity
  const p1_balance_diff = p1_total_assets - p1_total_passiv
  const p2_balance_diff = p2_total_assets - p2_total_passiv

  // ОПУ
  const p1_gross = n('p1_revenue') - n('p1_cogs')
  const p2_gross = n('p2_revenue') - n('p2_cogs')
  const p1_op_profit = p1_gross - n('p1_sales_expense') - n('p1_admin_expense') + n('p1_other_op_income')
  const p2_op_profit = p2_gross - n('p2_sales_expense') - n('p2_admin_expense') + n('p2_other_op_income')
  const p1_ebt = p1_op_profit + n('p1_non_op')
  const p2_ebt = p2_op_profit + n('p2_non_op')
  const p1_net = p1_ebt - n('p1_tax')
  const p2_net = p2_ebt - n('p2_tax')

  // КешФлоу
  const p1_op_result = n('p1_op_inflow') - n('p1_op_outflow')
  const p2_op_result = n('p2_op_inflow') - n('p2_op_outflow')
  const p1_fin_result = n('p1_fin_inflow') - n('p1_fin_outflow')
  const p2_fin_result = n('p2_fin_inflow') - n('p2_fin_outflow')
  const p1_inv_result = n('p1_inv_inflow') - n('p1_inv_outflow')
  const p2_inv_result = n('p2_inv_inflow') - n('p2_inv_outflow')
  const p1_cash_end = n('p1_cash_begin') + p1_op_result + p1_fin_result + p1_inv_result
  const p2_cash_end = n('p2_cash_begin') + p2_op_result + p2_fin_result + p2_inv_result

  // Аннуитет
  const loanAmt = n('loan_amount')
  const rate = n('interest_rate') / 100 / 12
  const months = n('loan_term_months') || 12
  const monthlyPayment = rate > 0
    ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months)))
    : Math.round(loanAmt / months)

  async function handleGenerate() {
    if (!form.borrower_name || !form.loan_amount || !form.loan_purpose) {
      setError('Заполните обязательные поля: Заёмщик, Сумма, Цель кредита'); return
    }
    setGenerating(true); setError(null)
    try {
      const payload = {
        ...form, collaterals,
        p1_gross, p2_gross, p1_op_profit, p2_op_profit,
        p1_ebt, p2_ebt, p1_net, p2_net,
        p1_total_assets, p2_total_assets,
        p1_total_liabilities: p1_total_liab, p2_total_liabilities: p2_total_liab,
        p1_cash_end, p2_cash_end, monthly_payment: monthlyPayment,
      }
      const res = await fetch('/api/credit-risk/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: payload }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { error: dbErr } = await supabase.from('credit_conclusions').insert({
        borrower_name: form.borrower_name, borrower_inn: form.borrower_inn,
        business_type: form.business_type, years_in_business: n('years_in_business'),
        loan_amount: n('loan_amount'), loan_currency: form.loan_currency,
        loan_term: `${form.loan_term_months} мес.`, loan_term_months: n('loan_term_months'),
        interest_rate: n('interest_rate'), loan_purpose: form.loan_purpose,
        credit_history: form.credit_history, analyst_name: form.analyst_name,
        p1_label: form.p1_label || 'Период 1', p2_label: form.p2_label || 'Период 2',
        // Баланс
        p1_cash: n('p1_cash'), p1_receivables: n('p1_receivables'), p1_inventory: n('p1_inventory'),
        p1_fixed_assets: n('p1_fixed_assets'), p1_other_assets: n('p1_other_assets'),
        p1_supplier_debt: n('p1_supplier_debt'), p1_bank_debt: n('p1_bank_debt'), p1_other_liabilities: n('p1_other_liabilities'),
        p1_equity_capital: n('p1_equity_capital'), p1_reserves: n('p1_reserves'), p1_retained_earnings: n('p1_retained_earnings'),
        p2_cash: n('p2_cash'), p2_receivables: n('p2_receivables'), p2_inventory: n('p2_inventory'),
        p2_fixed_assets: n('p2_fixed_assets'), p2_other_assets: n('p2_other_assets'),
        p2_supplier_debt: n('p2_supplier_debt'), p2_bank_debt: n('p2_bank_debt'), p2_other_liabilities: n('p2_other_liabilities'),
        p2_equity_capital: n('p2_equity_capital'), p2_reserves: n('p2_reserves'), p2_retained_earnings: n('p2_retained_earnings'),
        // ОПУ
        p1_revenue: n('p1_revenue'), p1_cogs: n('p1_cogs'), p1_gross_profit: p1_gross,
        p1_sales_expense: n('p1_sales_expense'), p1_admin_expense: n('p1_admin_expense'),
        p1_other_op_income: n('p1_other_op_income'), p1_non_op: n('p1_non_op'), p1_tax: n('p1_tax'), p1_net_profit: p1_net,
        p2_revenue: n('p2_revenue'), p2_cogs: n('p2_cogs'), p2_gross_profit: p2_gross,
        p2_sales_expense: n('p2_sales_expense'), p2_admin_expense: n('p2_admin_expense'),
        p2_other_op_income: n('p2_other_op_income'), p2_non_op: n('p2_non_op'), p2_tax: n('p2_tax'), p2_net_profit: p2_net,
        // КешФлоу
        p1_cash_begin: n('p1_cash_begin'), p1_op_inflow: n('p1_op_inflow'), p1_op_outflow: n('p1_op_outflow'),
        p1_fin_inflow: n('p1_fin_inflow'), p1_fin_outflow: n('p1_fin_outflow'),
        p1_inv_inflow: n('p1_inv_inflow'), p1_inv_outflow: n('p1_inv_outflow'), p1_cash_end,
        p2_cash_begin: n('p2_cash_begin'), p2_op_inflow: n('p2_op_inflow'), p2_op_outflow: n('p2_op_outflow'),
        p2_fin_inflow: n('p2_fin_inflow'), p2_fin_outflow: n('p2_fin_outflow'),
        p2_inv_inflow: n('p2_inv_inflow'), p2_inv_outflow: n('p2_inv_outflow'), p2_cash_end,
        collaterals, guarantors, ai_conclusion: data.conclusion,
        recommendation: data.recommendation, risk_level: data.risk_level,
      })
      if (dbErr) throw new Error(dbErr.message)
      setShowModal(false); setForm(EMPTY); setCollaterals([{ type: 'Недвижимость', description: '', value: 0 }]); setGuarantors([]); setTab(1)
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function downloadWord(c: CreditConclusion) {
    try {
      const res = await fetch('/api/credit-risk/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conclusion: c }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Server error') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Заключение_${c.borrower_name}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка Word: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('credit_conclusions').delete().eq('id', id)
    fetch_()
  }

  const riskColor = (l: string) => l === 'Высокий' ? 'bg-red-100 text-red-800' : l === 'Средний' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  const recColor = (r: string) => r?.includes('Отклонить') ? 'text-red-600' : r?.includes('Условно') ? 'text-yellow-600' : 'text-green-600'
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Кредитный риск — AI-заключения</h1>
          <p className="text-sm text-gray-500 mt-0.5">Анализ заёмщиков SME с помощью искусственного интеллекта</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setCollaterals([{type:'Недвижимость',description:'',value:0}]); setTab(1); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новое заключение
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего', value: conclusions.length, c: 'text-gray-900' },
          { label: 'Одобрить', value: conclusions.filter(c => c.recommendation?.includes('Одобрить') && !c.recommendation?.includes('Условно')).length, c: 'text-green-600' },
          { label: 'Условно', value: conclusions.filter(c => c.recommendation?.includes('Условно')).length, c: 'text-yellow-600' },
          { label: 'Отклонить', value: conclusions.filter(c => c.recommendation?.includes('Отклонить')).length, c: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>


      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все годы</option>
          {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все месяцы</option>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i) => (
            <option key={m} value={m}>{['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][i]}</option>
          ))}
        </select>
        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Заёмщик','Сумма','Цель','Риск','Рекомендация','Дата',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              : conclusions.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Нет заключений</p></td></tr>
              : conclusions.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{c.borrower_name}</p>{c.borrower_inn && <p className="text-xs text-gray-400">ИНН: {c.borrower_inn}</p>}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{fmt(c.loan_amount)} {c.loan_currency}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{c.loan_purpose}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(c.risk_level)}`}>{c.risk_level}</span></td>
                  <td className="px-4 py-3"><span className={`text-sm font-medium ${recColor(c.recommendation)}`}>{c.recommendation}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewing(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => downloadWord(c)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Заключение: {viewing.borrower_name}</h2>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Заёмщик', viewing.borrower_name], ['Сумма', `${fmt(viewing.loan_amount)} ${viewing.loan_currency}`],
                  ['Срок', viewing.loan_term || '—'], ['Ставка', viewing.interest_rate ? `${viewing.interest_rate}%` : '—'],
                  ['Бизнес', viewing.business_type || '—'], ['Лет', String(viewing.years_in_business || '—')],
                  ['Выручка П1', `${fmt(viewing.p1_revenue)} TJS`], ['Выручка П2', `${fmt(viewing.p2_revenue)} TJS`],
                  ['Прибыль П1', `${fmt(viewing.p1_net_profit)} TJS`], ['Прибыль П2', `${fmt(viewing.p2_net_profit)} TJS`],
                  ['Уровень риска', viewing.risk_level || '—'], ['Аналитик', viewing.analyst_name || '—'],
                ].map(([l, v]) => <div key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p></div>)}
              </div>
              <div><p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">AI Заключение</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewing.ai_conclusion}</p>
                </div>
              </div>
              <div className={`p-4 rounded-xl border-2 ${viewing.recommendation?.includes('Отклонить') ? 'bg-red-50 border-red-200' : viewing.recommendation?.includes('Условно') ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-xs text-gray-500 mb-1">Рекомендация</p>
                <p className={`text-xl font-bold ${recColor(viewing.recommendation)}`}>{viewing.recommendation}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => downloadWord(viewing)} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]"><Download className="w-4 h-4" /> Word</button>
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Заключение о кредитоспособности SME</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-2">
              {[{n:1,t:'Заёмщик'},{n:2,t:'Баланс'},{n:3,t:'ОПУ'},{n:4,t:'КешФлоу'},{n:5,t:'Залог'}].map(({n:tn,t}) => (
                <button key={tn} onClick={() => setTab(tn)}
                  className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${tab === tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><p className="text-sm text-red-600">{error}</p></div>}

              {/* Tab 1: Заёмщик */}
              {tab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={lbl}>Наименование заёмщика *</label><input type="text" value={form.borrower_name} onChange={e => setF('borrower_name', e.target.value)} placeholder="ООО 'Компания'" className={inp} /></div>
                  <div><label className={lbl}>ИНН</label><input type="text" value={form.borrower_inn} onChange={e => setF('borrower_inn', e.target.value)} placeholder="000000000" className={inp} /></div>
                  <div><label className={lbl}>Вид деятельности</label><input type="text" value={form.business_type} onChange={e => setF('business_type', e.target.value)} placeholder="Торговля, производство..." className={inp} /></div>
                  <div><label className={lbl}>Лет в бизнесе</label><input type="text" inputMode="numeric" value={form.years_in_business} onChange={e => setF('years_in_business', e.target.value.replace(/\D/g,''))} className={inp} /></div>
                  <div><label className={lbl}>Сумма кредита *</label><input type="text" inputMode="numeric" value={form.loan_amount} onChange={e => setF('loan_amount', e.target.value.replace(/\D/g,''))} placeholder="0" className={inp} /></div>
                  <div><label className={lbl}>Валюта</label><select value={form.loan_currency} onChange={e => setF('loan_currency', e.target.value)} className={inp}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label className={lbl}>Срок кредита (месяцев)</label><input type="text" inputMode="numeric" value={form.loan_term_months} onChange={e => setF('loan_term_months', e.target.value.replace(/\D/g,''))} placeholder="12" className={inp} /></div>
                  <div><label className={lbl}>Процентная ставка (% годовых)</label><input type="text" inputMode="decimal" value={form.interest_rate} onChange={e => setF('interest_rate', e.target.value.replace(/[^0-9.]/g,''))} placeholder="24" className={inp} /></div>
                  {form.loan_amount && form.loan_term_months && (
                    <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                      <p className="text-xs text-gray-600">Ежемесячное погашение (аннуитет):</p>
                      <p className="text-base font-bold text-[#1B8A4C]">{new Intl.NumberFormat('ru-RU').format(monthlyPayment)} {form.loan_currency}/мес</p>
                    </div>
                  )}
                  <div><label className={lbl}>Кредитная история</label><select value={form.credit_history} onChange={e => setF('credit_history', e.target.value)} className={inp}>{CREDIT_HISTORY.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  <div><label className={lbl}>Название периода 1 (напр. 31.12.2024)</label><input type="text" value={form.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="31.12.2024" className={inp} /></div>
                  <div><label className={lbl}>Название периода 2 (напр. 31.03.2025)</label><input type="text" value={form.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="31.03.2025" className={inp} /></div>
                  <div className="lg:col-span-2"><label className={lbl}>Цель кредита *</label><textarea value={form.loan_purpose} onChange={e => setF('loan_purpose', e.target.value)} rows={2} placeholder="Пополнение оборотных средств..." className={inp + ' resize-none'} /></div>
                </div>
              )}

              {/* Tab 2: Баланс */}
              {tab === 2 && (
                <div className="space-y-2">
                  <FT title="АКТИВ" p1={p1} p2={p2}>
                    <FR label="Денежные средства" f1="p1_cash" f2="p2_cash" formData={form} setF={setF} />
                    <FR label="Дебиторская задолженность" f1="p1_receivables" f2="p2_receivables" formData={form} setF={setF} />
                    <FR label="ТМЗ (запасы)" f1="p1_inventory" f2="p2_inventory" formData={form} setF={setF} />
                    <FR label="Основные средства" f1="p1_fixed_assets" f2="p2_fixed_assets" formData={form} setF={setF} />
                    <FR label="Прочие активы" f1="p1_other_assets" f2="p2_other_assets" formData={form} setF={setF} />
                    <FR label="ИТОГО АКТИВ" bold auto v1={p1_total_assets} v2={p2_total_assets} formData={form} setF={setF} />
                  </FT>
                  <FT title="ПАССИВ — Обязательства" p1={p1} p2={p2}>
                    <FR label="Долги перед поставщиками" f1="p1_supplier_debt" f2="p2_supplier_debt" formData={form} setF={setF} />
                    <FR label="Долги перед банками" f1="p1_bank_debt" f2="p2_bank_debt" formData={form} setF={setF} />
                    <FR label="Прочие обязательства" f1="p1_other_liabilities" f2="p2_other_liabilities" formData={form} setF={setF} />
                    <FR label="Итого обязательства" bold auto v1={p1_total_liab} v2={p2_total_liab} formData={form} setF={setF} />
                  </FT>
                  <FT title="ПАССИВ — Капитал" p1={p1} p2={p2}>
                    <FR label="Основной капитал" f1="p1_equity_capital" f2="p2_equity_capital" formData={form} setF={setF} />
                    <FR label="Резерв" f1="p1_reserves" f2="p2_reserves" formData={form} setF={setF} />
                    <FR label="Нераспределённая прибыль" f1="p1_retained_earnings" f2="p2_retained_earnings" formData={form} setF={setF} />
                    <FR label="Итого капитал" bold auto v1={p1_total_equity} v2={p2_total_equity} formData={form} setF={setF} />
                    <FR label="ИТОГО ПАССИВ" bold auto v1={p1_total_passiv} v2={p2_total_passiv} formData={form} setF={setF} />
                  </FT>
                  {/* Balance check */}
                  {(p1_total_assets > 0 || p2_total_assets > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {[{period: p1, diff: p1_balance_diff, assets: p1_total_assets},{period: p2, diff: p2_balance_diff, assets: p2_total_assets}].map(({period, diff, assets}) => assets > 0 && (
                        <div key={period} className={`p-3 rounded-lg border text-xs font-medium ${Math.abs(diff) < 1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {period}: {Math.abs(diff) < 1 ? '✅ Баланс сходится' : `⚠️ Актив ≠ Пассив, разница: ${new Intl.NumberFormat('ru-RU').format(Math.round(Math.abs(diff)))}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: ОПУ */}
              {tab === 3 && (
                <FT title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ (ОПУ)" p1={p1} p2={p2}>
                  <FR label="Выручка от реализации" f1="p1_revenue" f2="p2_revenue" formData={form} setF={setF} />
                  <FR label="Себестоимость" f1="p1_cogs" f2="p2_cogs" formData={form} setF={setF} />
                  <FR label="▶ Валовая прибыль" bold auto v1={p1_gross} v2={p2_gross} formData={form} setF={setF} />
                  <FR label="Торговые расходы" f1="p1_sales_expense" f2="p2_sales_expense" formData={form} setF={setF} />
                  <FR label="Административные расходы" f1="p1_admin_expense" f2="p2_admin_expense" formData={form} setF={setF} />
                  <FR label="Прочие операционные доходы" f1="p1_other_op_income" f2="p2_other_op_income" formData={form} setF={setF} />
                  <FR label="▶ Операционная прибыль" bold auto v1={p1_op_profit} v2={p2_op_profit} formData={form} setF={setF} />
                  <FR label="Прочие внеоперац. доходы/(расходы)" f1="p1_non_op" f2="p2_non_op" formData={form} setF={setF} />
                  <FR label="▶ Прибыль до налогообложения" bold auto v1={p1_ebt} v2={p2_ebt} formData={form} setF={setF} />
                  <FR label="Налог на прибыль" f1="p1_tax" f2="p2_tax" formData={form} setF={setF} />
                  <FR label="▶ Чистая прибыль" bold auto v1={p1_net} v2={p2_net} formData={form} setF={setF} />
                </FT>
              )}

              {/* Tab 4: КешФлоу */}
              {tab === 4 && (
                <FT title="ОТЧЁТ О ДВИЖЕНИИ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС)" p1={p1} p2={p2}>
                  <FR label="Остаток на начало периода" bold f1="p1_cash_begin" f2="p2_cash_begin" formData={form} setF={setF} />
                  <FR label="Операционная: Приток (продажи)" f1="p1_op_inflow" f2="p2_op_inflow" formData={form} setF={setF} />
                  <FR label="Операционная: Отток (покупки/расходы)" f1="p1_op_outflow" f2="p2_op_outflow" formData={form} setF={setF} />
                  <FR label="▶ Результат операционной деятельности" bold auto v1={p1_op_result} v2={p2_op_result} formData={form} setF={setF} />
                  <FR label="Финансовая: Приток (займы/кредиты)" f1="p1_fin_inflow" f2="p2_fin_inflow" formData={form} setF={setF} />
                  <FR label="Финансовая: Отток (погашение)" f1="p1_fin_outflow" f2="p2_fin_outflow" formData={form} setF={setF} />
                  <FR label="▶ Результат финансовой деятельности" bold auto v1={p1_fin_result} v2={p2_fin_result} formData={form} setF={setF} />
                  <FR label="Инвестиционная: Приток" f1="p1_inv_inflow" f2="p2_inv_inflow" formData={form} setF={setF} />
                  <FR label="Инвестиционная: Отток" f1="p1_inv_outflow" f2="p2_inv_outflow" formData={form} setF={setF} />
                  <FR label="▶ Результат инвестиционной деятельности" bold auto v1={p1_inv_result} v2={p2_inv_result} formData={form} setF={setF} />
                  <FR label="▶ Остаток на конец периода" bold auto v1={p1_cash_end} v2={p2_cash_end} formData={form} setF={setF} />
                </FT>
              )}

              {/* Tab 5: Залог */}
              {tab === 5 && (
                <div className="space-y-3">
                  {collaterals.map((col, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">Залог №{idx + 1}</h3>
                        {collaterals.length > 1 && <button onClick={() => setCollaterals(p => p.filter((_,i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Удалить</button>}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div><label className={lbl}>Тип залога</label>
                          <select value={col.type} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,type:e.target.value} : c))} className={inp}>
                            {COLLATERAL_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select></div>
                        <div><label className={lbl}>Описание</label>
                          <input type="text" value={col.description} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,description:e.target.value} : c))} placeholder="Адрес, марка..." className={inp} /></div>
                        <div><label className={lbl}>Стоимость (TJS)</label>
                          <input type="text" inputMode="numeric" value={col.value || ''} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,value:Number(e.target.value.replace(/\D/g,''))} : c))} placeholder="0" className={inp} /></div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setCollaterals(p => [...p, {type:'Недвижимость',description:'',value:0}])}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#1B8A4C] hover:text-[#1B8A4C] w-full justify-center">
                    <Plus className="w-4 h-4" /> Добавить залог
                  </button>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Общая стоимость залога</p>
                    <p className="text-base font-bold text-gray-900">{fmt(collaterals.reduce((s,c) => s+(c.value||0), 0))} TJS</p>
                  </div>

                  {/* Поручители */}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Поручители</p>
                      <button onClick={() => setGuarantors(p => [...p, {name: '', inn: '', relation: ''}])}
                        className="flex items-center gap-1 text-xs text-[#1B8A4C] hover:underline">
                        <Plus className="w-3.5 h-3.5" /> Добавить поручителя
                      </button>
                    </div>
                    {guarantors.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">Поручители не добавлены</p>
                    )}
                    {guarantors.map((g, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-xl mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-gray-700">Поручитель №{idx + 1}</p>
                          <button onClick={() => setGuarantors(p => p.filter((_,i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Удалить</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          <div><label className={lbl}>ФИО / Название</label>
                            <input type="text" value={g.name} onChange={e => setGuarantors(p => p.map((x,i) => i===idx ? {...x, name: e.target.value} : x))} placeholder="ФИО или наименование" className={inp} /></div>
                          <div><label className={lbl}>ИНН</label>
                            <input type="text" value={g.inn} onChange={e => setGuarantors(p => p.map((x,i) => i===idx ? {...x, inn: e.target.value} : x))} placeholder="000000000" className={inp} /></div>
                          <div><label className={lbl}>Связь с заёмщиком</label>
                            <input type="text" value={g.relation} onChange={e => setGuarantors(p => p.map((x,i) => i===idx ? {...x, relation: e.target.value} : x))} placeholder="Учредитель, супруг..." className={inp} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); setForm(EMPTY) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {tab < 5
                  ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                  : <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                      {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать</>}
                    </button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

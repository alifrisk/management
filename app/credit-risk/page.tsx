'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, FileText, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Collateral { type: string; description: string; value: number }

interface CreditConclusion {
  id: string
  borrower_name: string; borrower_inn: string; business_type: string
  years_in_business: number; loan_amount: number; loan_currency: string
  loan_term: string; loan_purpose: string; credit_history: string; analyst_name: string
  p1_label: string; p2_label: string
  p1_cash: number; p1_receivables: number; p1_inventory: number; p1_fixed_assets: number; p1_other_assets: number
  p1_supplier_debt: number; p1_bank_debt: number; p1_other_liabilities: number
  p1_equity_capital: number; p1_reserves: number; p1_retained_earnings: number
  p2_cash: number; p2_receivables: number; p2_inventory: number; p2_fixed_assets: number; p2_other_assets: number
  p2_supplier_debt: number; p2_bank_debt: number; p2_other_liabilities: number
  p2_equity_capital: number; p2_reserves: number; p2_retained_earnings: number
  p1_revenue: number; p1_cogs: number; p1_gross_profit: number; p1_admin_expense: number; p1_sales_expense: number; p1_net_profit: number
  p2_revenue: number; p2_cogs: number; p2_gross_profit: number; p2_admin_expense: number; p2_sales_expense: number; p2_net_profit: number
  p1_cash_begin: number; p1_op_inflow: number; p1_op_outflow: number; p1_fin_inflow: number; p1_fin_outflow: number; p1_inv_inflow: number; p1_inv_outflow: number; p1_cash_end: number
  p2_cash_begin: number; p2_op_inflow: number; p2_op_outflow: number; p2_fin_inflow: number; p2_fin_outflow: number; p2_inv_inflow: number; p2_inv_outflow: number; p2_cash_end: number
  collaterals: Collateral[]
  ai_conclusion: string; recommendation: string; risk_level: string; created_at: string
}

const EMPTY_FORM = {
  borrower_name: '', borrower_inn: '', business_type: '', years_in_business: '',
  loan_amount: '', loan_currency: 'TJS', loan_term: '', loan_purpose: '',
  credit_history: 'Положительная', analyst_name: '',
  p1_label: '', p2_label: '',
  p1_cash: '', p1_receivables: '', p1_inventory: '', p1_fixed_assets: '', p1_other_assets: '',
  p1_supplier_debt: '', p1_bank_debt: '', p1_other_liabilities: '',
  p1_equity_capital: '', p1_reserves: '', p1_retained_earnings: '',
  p2_cash: '', p2_receivables: '', p2_inventory: '', p2_fixed_assets: '', p2_other_assets: '',
  p2_supplier_debt: '', p2_bank_debt: '', p2_other_liabilities: '',
  p2_equity_capital: '', p2_reserves: '', p2_retained_earnings: '',
  p1_revenue: '', p1_cogs: '', p1_admin_expense: '', p1_sales_expense: '', p1_net_profit: '',
  p2_revenue: '', p2_cogs: '', p2_admin_expense: '', p2_sales_expense: '', p2_net_profit: '',
  p1_cash_begin: '', p1_op_inflow: '', p1_op_outflow: '', p1_fin_inflow: '', p1_fin_outflow: '', p1_inv_inflow: '', p1_inv_outflow: '',
  p2_cash_begin: '', p2_op_inflow: '', p2_op_outflow: '', p2_fin_inflow: '', p2_fin_outflow: '', p2_inv_inflow: '', p2_inv_outflow: '',
}

const COLLATERAL_TYPES = ['Недвижимость', 'Автотранспорт', 'Оборудование', 'Товары в обороте', 'Депозит', 'Поручительство', 'Другое']
const CREDIT_HISTORY = ['Положительная', 'Нейтральная', 'Отрицательная', 'Отсутствует']
const CURRENCIES = ['TJS', 'USD', 'EUR', 'RUB']

export default function CreditRiskPage() {
  const [conclusions, setConclusions] = useState<CreditConclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>(EMPTY_FORM)
  const [collaterals, setCollaterals] = useState<Collateral[]>([{ type: 'Недвижимость', description: '', value: 0 }])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewingConclusion, setViewingConclusion] = useState<CreditConclusion | null>(null)
  const [activeTab, setActiveTab] = useState(1)

  const fetchConclusions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('credit_conclusions').select('*').order('created_at', { ascending: false })
    setConclusions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchConclusions() }, [fetchConclusions])

  const n = (k: string) => Number(formData[k]) || 0

  function setF(field: string, value: string) {
    setFormData(p => ({ ...p, [field]: value }))
  }

  // Auto-calculate gross profit
  const p1_gross = n('p1_revenue') - n('p1_cogs')
  const p2_gross = n('p2_revenue') - n('p2_cogs')
  const p1_total_assets = n('p1_cash') + n('p1_receivables') + n('p1_inventory') + n('p1_fixed_assets') + n('p1_other_assets')
  const p2_total_assets = n('p2_cash') + n('p2_receivables') + n('p2_inventory') + n('p2_fixed_assets') + n('p2_other_assets')
  const p1_total_liab = n('p1_supplier_debt') + n('p1_bank_debt') + n('p1_other_liabilities')
  const p2_total_liab = n('p2_supplier_debt') + n('p2_bank_debt') + n('p2_other_liabilities')
  const p1_total_equity = n('p1_equity_capital') + n('p1_reserves') + n('p1_retained_earnings')
  const p2_total_equity = n('p2_equity_capital') + n('p2_reserves') + n('p2_retained_earnings')
  const p1_op_result = n('p1_op_inflow') - n('p1_op_outflow')
  const p2_op_result = n('p2_op_inflow') - n('p2_op_outflow')
  const p1_fin_result = n('p1_fin_inflow') - n('p1_fin_outflow')
  const p2_fin_result = n('p2_fin_inflow') - n('p2_fin_outflow')
  const p1_inv_result = n('p1_inv_inflow') - n('p1_inv_outflow')
  const p2_inv_result = n('p2_inv_inflow') - n('p2_inv_outflow')
  const p1_cash_end = n('p1_cash_begin') + p1_op_result + p1_fin_result + p1_inv_result
  const p2_cash_end = n('p2_cash_begin') + p2_op_result + p2_fin_result + p2_inv_result

  async function handleGenerate() {
    if (!formData.borrower_name || !formData.loan_amount || !formData.loan_purpose) {
      setError('Заполните: Заёмщик, Сумма кредита, Цель кредита'); return
    }
    setGenerating(true); setError(null)
    try {
      const payload = {
        ...formData,
        collaterals,
        p1_gross_profit: p1_gross, p2_gross_profit: p2_gross,
        p1_total_assets, p2_total_assets,
        p1_total_liabilities: p1_total_liab, p2_total_liabilities: p2_total_liab,
        p1_cash_end, p2_cash_end,
      }
      const res = await fetch('/api/credit-risk/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: payload }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { error: dbError } = await supabase.from('credit_conclusions').insert({
        borrower_name: formData.borrower_name, borrower_inn: formData.borrower_inn,
        business_type: formData.business_type, years_in_business: Number(formData.years_in_business) || 0,
        loan_amount: Number(formData.loan_amount) || 0, loan_currency: formData.loan_currency,
        loan_term: formData.loan_term, loan_purpose: formData.loan_purpose,
        credit_history: formData.credit_history, analyst_name: formData.analyst_name,
        p1_label: formData.p1_label || 'Период 1', p2_label: formData.p2_label || 'Период 2',
        p1_cash: n('p1_cash'), p1_receivables: n('p1_receivables'), p1_inventory: n('p1_inventory'),
        p1_fixed_assets: n('p1_fixed_assets'), p1_other_assets: n('p1_other_assets'),
        p1_supplier_debt: n('p1_supplier_debt'), p1_bank_debt: n('p1_bank_debt'), p1_other_liabilities: n('p1_other_liabilities'),
        p1_equity_capital: n('p1_equity_capital'), p1_reserves: n('p1_reserves'), p1_retained_earnings: n('p1_retained_earnings'),
        p2_cash: n('p2_cash'), p2_receivables: n('p2_receivables'), p2_inventory: n('p2_inventory'),
        p2_fixed_assets: n('p2_fixed_assets'), p2_other_assets: n('p2_other_assets'),
        p2_supplier_debt: n('p2_supplier_debt'), p2_bank_debt: n('p2_bank_debt'), p2_other_liabilities: n('p2_other_liabilities'),
        p2_equity_capital: n('p2_equity_capital'), p2_reserves: n('p2_reserves'), p2_retained_earnings: n('p2_retained_earnings'),
        p1_revenue: n('p1_revenue'), p1_cogs: n('p1_cogs'), p1_gross_profit: p1_gross,
        p1_admin_expense: n('p1_admin_expense'), p1_sales_expense: n('p1_sales_expense'), p1_net_profit: n('p1_net_profit'),
        p2_revenue: n('p2_revenue'), p2_cogs: n('p2_cogs'), p2_gross_profit: p2_gross,
        p2_admin_expense: n('p2_admin_expense'), p2_sales_expense: n('p2_sales_expense'), p2_net_profit: n('p2_net_profit'),
        p1_cash_begin: n('p1_cash_begin'), p1_op_inflow: n('p1_op_inflow'), p1_op_outflow: n('p1_op_outflow'),
        p1_fin_inflow: n('p1_fin_inflow'), p1_fin_outflow: n('p1_fin_outflow'),
        p1_inv_inflow: n('p1_inv_inflow'), p1_inv_outflow: n('p1_inv_outflow'), p1_cash_end,
        p2_cash_begin: n('p2_cash_begin'), p2_op_inflow: n('p2_op_inflow'), p2_op_outflow: n('p2_op_outflow'),
        p2_fin_inflow: n('p2_fin_inflow'), p2_fin_outflow: n('p2_fin_outflow'),
        p2_inv_inflow: n('p2_inv_inflow'), p2_inv_outflow: n('p2_inv_outflow'), p2_cash_end,
        collaterals, ai_conclusion: data.conclusion, recommendation: data.recommendation, risk_level: data.risk_level,
      })
      if (dbError) throw new Error(dbError.message)
      setShowModal(false); setFormData(EMPTY_FORM); setCollaterals([{ type: 'Недвижимость', description: '', value: 0 }]); setActiveTab(1)
      fetchConclusions()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'))
    } finally { setGenerating(false) }
  }

  async function handleDownloadWord(conclusion: CreditConclusion) {
    try {
      const res = await fetch('/api/credit-risk/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conclusion }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Заключение_${conclusion.borrower_name}_${new Date().toISOString().split('T')[0]}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Ошибка при генерации Word') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить заключение?')) return
    await supabase.from('credit_conclusions').delete().eq('id', id)
    fetchConclusions()
  }

  const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
  const getRiskColor = (level: string) => level === 'Высокий' ? 'bg-red-100 text-red-800' : level === 'Средний' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  const getRecommColor = (rec: string) => rec?.includes('Отклонить') ? 'text-red-600' : rec?.includes('Условно') ? 'text-yellow-600' : 'text-green-600'

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  // Two-column financial row
  function FinRow({ label, f1, f2, bold, auto, v1, v2 }: { label: string; f1?: string; f2?: string; bold?: boolean; auto?: boolean; v1?: number; v2?: number }) {
    return (
      <tr className={bold ? 'bg-gray-50' : ''}>
        <td className={`px-3 py-1.5 text-xs ${bold ? 'font-semibold' : ''} text-gray-700`}>{label}</td>
        <td className="px-3 py-1.5">
          {auto ? <span className={`text-xs font-bold ${(v1 || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(v1 || 0)}</span>
            : <input type="number" value={f1 ? formData[f1] : ''} onChange={e => f1 && setF(f1, e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]" placeholder="0" />}
        </td>
        <td className="px-3 py-1.5">
          {auto ? <span className={`text-xs font-bold ${(v2 || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(v2 || 0)}</span>
            : <input type="number" value={f2 ? formData[f2] : ''} onChange={e => f2 && setF(f2, e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]" placeholder="0" />}
        </td>
      </tr>
    )
  }

  function FinTable({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
        <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead>
            <tr className="bg-[#1B8A4C] text-white">
              <th className="text-left px-3 py-2 text-xs font-medium w-1/2">Показатель</th>
              <th className="text-left px-3 py-2 text-xs font-medium w-1/4">{formData.p1_label || 'Период 1'}</th>
              <th className="text-left px-3 py-2 text-xs font-medium w-1/4">{formData.p2_label || 'Период 2'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Кредитный риск — AI-заключения</h1>
          <p className="text-sm text-gray-500 mt-0.5">Анализ заёмщиков SME с помощью искусственного интеллекта</p>
        </div>
        <button onClick={() => { setFormData(EMPTY_FORM); setCollaterals([{ type: 'Недвижимость', description: '', value: 0 }]); setActiveTab(1); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новое заключение
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего', value: conclusions.length, color: 'text-gray-900' },
          { label: 'Одобрить', value: conclusions.filter(c => c.recommendation?.includes('Одобрить') && !c.recommendation?.includes('Условно')).length, color: 'text-green-600' },
          { label: 'Условно', value: conclusions.filter(c => c.recommendation?.includes('Условно')).length, color: 'text-yellow-600' },
          { label: 'Отклонить', value: conclusions.filter(c => c.recommendation?.includes('Отклонить')).length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Заёмщик</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Сумма</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Цель</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Риск</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Рекомендация</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : conclusions.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Нет заключений</p></td></tr>
                : conclusions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium text-gray-900">{c.borrower_name}</p>{c.borrower_inn && <p className="text-xs text-gray-400">ИНН: {c.borrower_inn}</p>}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{fmt(c.loan_amount)} {c.loan_currency}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{c.loan_purpose}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor(c.risk_level)}`}>{c.risk_level}</span></td>
                    <td className="px-4 py-3"><span className={`text-sm font-medium ${getRecommColor(c.recommendation)}`}>{c.recommendation}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewingConclusion(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDownloadWord(c)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewingConclusion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{viewingConclusion.borrower_name}</h2>
              <button onClick={() => setViewingConclusion(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Заёмщик', viewingConclusion.borrower_name],
                  ['Сумма', `${fmt(viewingConclusion.loan_amount)} ${viewingConclusion.loan_currency}`],
                  ['Срок', viewingConclusion.loan_term || '—'],
                  ['Бизнес', viewingConclusion.business_type || '—'],
                  ['Выручка П1', `${fmt(viewingConclusion.p1_revenue)} TJS`],
                  ['Выручка П2', `${fmt(viewingConclusion.p2_revenue)} TJS`],
                  ['Прибыль П1', `${fmt(viewingConclusion.p1_net_profit)} TJS`],
                  ['Прибыль П2', `${fmt(viewingConclusion.p2_net_profit)} TJS`],
                  ['Уровень риска', viewingConclusion.risk_level],
                  ['Аналитик', viewingConclusion.analyst_name || '—'],
                ].map(([label, value]) => (
                  <div key={label}><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p></div>
                ))}
              </div>
              <div><p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">AI Заключение</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewingConclusion.ai_conclusion}</p>
                </div>
              </div>
              <div className={`p-4 rounded-xl border-2 ${viewingConclusion.recommendation?.includes('Отклонить') ? 'bg-red-50 border-red-200' : viewingConclusion.recommendation?.includes('Условно') ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-xs text-gray-500 mb-1">Рекомендация</p>
                <p className={`text-xl font-bold ${getRecommColor(viewingConclusion.recommendation)}`}>{viewingConclusion.recommendation}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => handleDownloadWord(viewingConclusion)} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]"><Download className="w-4 h-4" /> Word</button>
              <button onClick={() => setViewingConclusion(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* New Conclusion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Новое AI-заключение</h2>
                <p className="text-sm text-gray-500">Анализ кредитоспособности SME заёмщика</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex border-b border-gray-100 px-6 overflow-x-auto">
              {[{n:1,label:'Заёмщик'},{n:2,label:'Баланс'},{n:3,label:'ОПУ'},{n:4,label:'КешФлоу'},{n:5,label:'Залог'}].map(tab => (
                <button key={tab.n} onClick={() => setActiveTab(tab.n)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.n}. {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><p className="text-sm text-red-600">{error}</p></div>}

              {/* TAB 1: Заёмщик */}
              {activeTab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Наименование заёмщика *</label><input type="text" value={formData.borrower_name} onChange={e => setF('borrower_name', e.target.value)} placeholder="ООО 'Компания'" className={inputCls} /></div>
                  <div><label className={labelCls}>ИНН</label><input type="text" value={formData.borrower_inn} onChange={e => setF('borrower_inn', e.target.value)} placeholder="000000000" className={inputCls} /></div>
                  <div><label className={labelCls}>Вид деятельности</label><input type="text" value={formData.business_type} onChange={e => setF('business_type', e.target.value)} placeholder="Торговля, производство..." className={inputCls} /></div>
                  <div><label className={labelCls}>Лет в бизнесе</label><input type="number" min="0" value={formData.years_in_business} onChange={e => setF('years_in_business', e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Сумма кредита *</label><input type="number" min="0" value={formData.loan_amount} onChange={e => setF('loan_amount', e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Валюта</label><select value={formData.loan_currency} onChange={e => setF('loan_currency', e.target.value)} className={inputCls}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label className={labelCls}>Срок кредита</label><input type="text" value={formData.loan_term} onChange={e => setF('loan_term', e.target.value)} placeholder="12 месяцев" className={inputCls} /></div>
                  <div><label className={labelCls}>Кредитная история</label><select value={formData.credit_history} onChange={e => setF('credit_history', e.target.value)} className={inputCls}>{CREDIT_HISTORY.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Цель кредита *</label><textarea value={formData.loan_purpose} onChange={e => setF('loan_purpose', e.target.value)} rows={3} placeholder="Пополнение оборотных средств..." className={inputCls + ' resize-none'} /></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Аналитик</label><input type="text" value={formData.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО аналитика" className={inputCls} /></div>
                  <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Период 1 (название)</label><input type="text" value={formData.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="напр. 2024 год" className={inputCls} /></div>
                    <div><label className={labelCls}>Период 2 (название)</label><input type="text" value={formData.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="напр. 2025 год" className={inputCls} /></div>
                  </div>
                </div>
              )}

              {/* TAB 2: Баланс */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <FinTable title="АКТИВ">
                    <FinRow label="Денежные средства" f1="p1_cash" f2="p2_cash" />
                    <FinRow label="Дебиторская задолженность" f1="p1_receivables" f2="p2_receivables" />
                    <FinRow label="ТМЗ (запасы)" f1="p1_inventory" f2="p2_inventory" />
                    <FinRow label="Основные средства" f1="p1_fixed_assets" f2="p2_fixed_assets" />
                    <FinRow label="Прочие активы" f1="p1_other_assets" f2="p2_other_assets" />
                    <FinRow label="ИТОГО АКТИВ" bold auto v1={p1_total_assets} v2={p2_total_assets} />
                  </FinTable>
                  <FinTable title="ПАССИВ — Обязательства">
                    <FinRow label="Долги перед поставщиками" f1="p1_supplier_debt" f2="p2_supplier_debt" />
                    <FinRow label="Долги перед банками" f1="p1_bank_debt" f2="p2_bank_debt" />
                    <FinRow label="Прочие обязательства" f1="p1_other_liabilities" f2="p2_other_liabilities" />
                    <FinRow label="ИТОГО ОБЯЗАТЕЛЬСТВА" bold auto v1={p1_total_liab} v2={p2_total_liab} />
                  </FinTable>
                  <FinTable title="ПАССИВ — Капитал">
                    <FinRow label="Основной капитал" f1="p1_equity_capital" f2="p2_equity_capital" />
                    <FinRow label="Резерв" f1="p1_reserves" f2="p2_reserves" />
                    <FinRow label="Нераспределённая прибыль" f1="p1_retained_earnings" f2="p2_retained_earnings" />
                    <FinRow label="ИТОГО КАПИТАЛ" bold auto v1={p1_total_equity} v2={p2_total_equity} />
                  </FinTable>
                </div>
              )}

              {/* TAB 3: ОПУ */}
              {activeTab === 3 && (
                <FinTable title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ">
                  <FinRow label="Выручка" f1="p1_revenue" f2="p2_revenue" />
                  <FinRow label="Себестоимость" f1="p1_cogs" f2="p2_cogs" />
                  <FinRow label="Валовой доход" bold auto v1={p1_gross} v2={p2_gross} />
                  <FinRow label="Административные расходы" f1="p1_admin_expense" f2="p2_admin_expense" />
                  <FinRow label="Торговые расходы" f1="p1_sales_expense" f2="p2_sales_expense" />
                  <FinRow label="Чистая прибыль" bold f1="p1_net_profit" f2="p2_net_profit" />
                </FinTable>
              )}

              {/* TAB 4: КешФлоу */}
              {activeTab === 4 && (
                <div className="space-y-4">
                  <FinTable title="ОТЧЁТ О ДВИЖЕНИИ ДЕНЕЖНЫХ СРЕДСТВ">
                    <FinRow label="Остаток на начало периода" bold f1="p1_cash_begin" f2="p2_cash_begin" />
                    <FinRow label="— Операционная: Приток (продажи)" f1="p1_op_inflow" f2="p2_op_inflow" />
                    <FinRow label="— Операционная: Отток (покупки)" f1="p1_op_outflow" f2="p2_op_outflow" />
                    <FinRow label="Результат операционной деятельности" bold auto v1={p1_op_result} v2={p2_op_result} />
                    <FinRow label="— Финансовая: Приток" f1="p1_fin_inflow" f2="p2_fin_inflow" />
                    <FinRow label="— Финансовая: Отток" f1="p1_fin_outflow" f2="p2_fin_outflow" />
                    <FinRow label="Результат финансовой деятельности" bold auto v1={p1_fin_result} v2={p2_fin_result} />
                    <FinRow label="— Инвестиционная: Приток" f1="p1_inv_inflow" f2="p2_inv_inflow" />
                    <FinRow label="— Инвестиционная: Отток" f1="p1_inv_outflow" f2="p2_inv_outflow" />
                    <FinRow label="Результат инвестиционной деятельности" bold auto v1={p1_inv_result} v2={p2_inv_result} />
                    <FinRow label="Остаток на конец периода" bold auto v1={p1_cash_end} v2={p2_cash_end} />
                  </FinTable>
                </div>
              )}

              {/* TAB 5: Залог */}
              {activeTab === 5 && (
                <div className="space-y-4">
                  {collaterals.map((col, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">Залог №{idx + 1}</h3>
                        {collaterals.length > 1 && (
                          <button onClick={() => setCollaterals(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Удалить</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div><label className={labelCls}>Тип залога</label>
                          <select value={col.type} onChange={e => setCollaterals(prev => prev.map((c, i) => i === idx ? { ...c, type: e.target.value } : c))} className={inputCls}>
                            {COLLATERAL_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select></div>
                        <div><label className={labelCls}>Описание</label>
                          <input type="text" value={col.description} onChange={e => setCollaterals(prev => prev.map((c, i) => i === idx ? { ...c, description: e.target.value } : c))} placeholder="Адрес, марка, модель..." className={inputCls} /></div>
                        <div><label className={labelCls}>Стоимость (TJS)</label>
                          <input type="number" min="0" value={col.value || ''} onChange={e => setCollaterals(prev => prev.map((c, i) => i === idx ? { ...c, value: Number(e.target.value) } : c))} className={inputCls} /></div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setCollaterals(prev => [...prev, { type: 'Недвижимость', description: '', value: 0 }])}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#1B8A4C] hover:text-[#1B8A4C] w-full justify-center">
                    <Plus className="w-4 h-4" /> Добавить залог
                  </button>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Общая стоимость залога</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(collaterals.reduce((s, c) => s + (c.value || 0), 0))} TJS</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-100">
              <div>{activeTab > 1 && <button onClick={() => setActiveTab(activeTab - 1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {activeTab < 5
                  ? <button onClick={() => setActiveTab(activeTab + 1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
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

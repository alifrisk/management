'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, FileText, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface CreditConclusion {
  id: string
  borrower_name: string
  borrower_inn: string
  loan_amount: number
  loan_currency: string
  loan_term: string
  loan_purpose: string
  business_type: string
  years_in_business: number
  annual_revenue: number
  net_profit: number
  total_assets: number
  total_liabilities: number
  existing_loans: number
  credit_history: string
  collateral_type: string
  collateral_value: number
  guarantors: string
  analyst_name: string
  ai_conclusion: string
  recommendation: string
  risk_level: string
  created_at: string
}

const EMPTY_FORM = {
  borrower_name: '',
  borrower_inn: '',
  loan_amount: '',
  loan_currency: 'TJS',
  loan_term: '',
  loan_purpose: '',
  business_type: '',
  years_in_business: '',
  annual_revenue: '',
  net_profit: '',
  total_assets: '',
  total_liabilities: '',
  existing_loans: '',
  credit_history: 'Положительная',
  collateral_type: '',
  collateral_value: '',
  guarantors: '',
  analyst_name: '',
}

const CREDIT_HISTORY_OPTIONS = ['Положительная', 'Нейтральная', 'Отрицательная', 'Отсутствует']
const CURRENCY_OPTIONS = ['TJS', 'USD', 'EUR', 'RUB']
const COLLATERAL_TYPES = ['Недвижимость', 'Автотранспорт', 'Оборудование', 'Товары в обороте', 'Депозит', 'Поручительство', 'Без залога']

export default function CreditRiskPage() {
  const [conclusions, setConclusions] = useState<CreditConclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>(EMPTY_FORM)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewingConclusion, setViewingConclusion] = useState<CreditConclusion | null>(null)
  const [activeTab, setActiveTab] = useState(1)

  const fetchConclusions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('credit_conclusions')
      .select('*')
      .order('created_at', { ascending: false })
    setConclusions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchConclusions() }, [fetchConclusions])

  async function handleGenerate() {
    if (!formData.borrower_name || !formData.loan_amount || !formData.loan_purpose) {
      setError('Заполните обязательные поля: Заёмщик, Сумма кредита, Цель кредита')
      return
    }
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/credit-risk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Save to DB
      const { error: dbError } = await supabase.from('credit_conclusions').insert({
        borrower_name: formData.borrower_name,
        borrower_inn: formData.borrower_inn,
        loan_amount: Number(formData.loan_amount) || 0,
        loan_currency: formData.loan_currency,
        loan_term: formData.loan_term,
        loan_purpose: formData.loan_purpose,
        business_type: formData.business_type,
        years_in_business: Number(formData.years_in_business) || 0,
        annual_revenue: Number(formData.annual_revenue) || 0,
        net_profit: Number(formData.net_profit) || 0,
        total_assets: Number(formData.total_assets) || 0,
        total_liabilities: Number(formData.total_liabilities) || 0,
        existing_loans: Number(formData.existing_loans) || 0,
        credit_history: formData.credit_history,
        collateral_type: formData.collateral_type,
        collateral_value: Number(formData.collateral_value) || 0,
        guarantors: formData.guarantors,
        analyst_name: formData.analyst_name,
        ai_conclusion: data.conclusion,
        recommendation: data.recommendation,
        risk_level: data.risk_level,
      })

      if (dbError) throw new Error(dbError.message)

      setShowModal(false)
      setFormData(EMPTY_FORM)
      setActiveTab(1)
      fetchConclusions()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'))
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadWord(conclusion: CreditConclusion) {
    try {
      const res = await fetch('/api/credit-risk/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conclusion }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Заключение_${conclusion.borrower_name}_${new Date().toISOString().split('T')[0]}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Ошибка при генерации Word документа')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить заключение?')) return
    await supabase.from('credit_conclusions').delete().eq('id', id)
    fetchConclusions()
  }

  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

  const getRiskColor = (level: string) => {
    if (level === 'Высокий') return 'bg-red-100 text-red-800'
    if (level === 'Средний') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getRecommColor = (rec: string) => {
    if (rec?.includes('Отклонить') || rec?.includes('отклонить')) return 'text-red-600'
    if (rec?.includes('Условно') || rec?.includes('условно')) return 'text-yellow-600'
    return 'text-green-600'
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Кредитный риск — AI-заключения</h1>
          <p className="text-sm text-gray-500 mt-0.5">Анализ заёмщиков SME с помощью искусственного интеллекта</p>
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setActiveTab(1); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]"
        >
          <Plus className="w-4 h-4" /> Новое заключение
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего заключений', value: conclusions.length, color: 'text-gray-900' },
          { label: 'Одобрить', value: conclusions.filter(c => c.recommendation?.includes('Одобрить')).length, color: 'text-green-600' },
          { label: 'Условно', value: conclusions.filter(c => c.recommendation?.includes('Условно')).length, color: 'text-yellow-600' },
          { label: 'Отклонить', value: conclusions.filter(c => c.recommendation?.includes('Отклонить')).length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
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
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              ) : conclusions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Заключений нет — нажмите "Новое заключение"</p>
                </td></tr>
              ) : (
                conclusions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.borrower_name}</p>
                      {c.borrower_inn && <p className="text-xs text-gray-400">ИНН: {c.borrower_inn}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{fmt(c.loan_amount)} {c.loan_currency}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{c.loan_purpose}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor(c.risk_level)}`}>
                        {c.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${getRecommColor(c.recommendation)}`}>
                        {c.recommendation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewingConclusion(c)} title="Просмотр" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDownloadWord(c)} title="Скачать Word" className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} title="Удалить" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewingConclusion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Заключение: {viewingConclusion.borrower_name}</h2>
              <button onClick={() => setViewingConclusion(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Заёмщик', viewingConclusion.borrower_name],
                  ['ИНН', viewingConclusion.borrower_inn || '—'],
                  ['Сумма', `${fmt(viewingConclusion.loan_amount)} ${viewingConclusion.loan_currency}`],
                  ['Срок', viewingConclusion.loan_term || '—'],
                  ['Бизнес', viewingConclusion.business_type || '—'],
                  ['Лет в бизнесе', viewingConclusion.years_in_business || '—'],
                  ['Годовая выручка', viewingConclusion.annual_revenue ? `${fmt(viewingConclusion.annual_revenue)} TJS` : '—'],
                  ['Чистая прибыль', viewingConclusion.net_profit ? `${fmt(viewingConclusion.net_profit)} TJS` : '—'],
                  ['Залог', viewingConclusion.collateral_type || '—'],
                  ['Стоимость залога', viewingConclusion.collateral_value ? `${fmt(viewingConclusion.collateral_value)} TJS` : '—'],
                  ['Аналитик', viewingConclusion.analyst_name || '—'],
                  ['Уровень риска', viewingConclusion.risk_level || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Цель кредита</p>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{viewingConclusion.loan_purpose}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">AI Заключение</p>
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
              <button onClick={() => handleDownloadWord(viewingConclusion)} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                <Download className="w-4 h-4" /> Скачать Word
              </button>
              <button onClick={() => setViewingConclusion(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* New Conclusion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Новое AI-заключение</h2>
                <p className="text-sm text-gray-500 mt-0.5">Анализ кредитоспособности SME заёмщика</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {[{n:1,label:'Заёмщик'},{n:2,label:'Финансы'},{n:3,label:'Залог'}].map(tab => (
                <button key={tab.n} onClick={() => setActiveTab(tab.n)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.n}. {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {activeTab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Наименование заёмщика *</label>
                    <input type="text" value={formData.borrower_name} onChange={e => setFormData(p => ({...p, borrower_name: e.target.value}))} placeholder="ООО 'Компания'" className={inputCls} /></div>
                  <div><label className={labelCls}>ИНН</label>
                    <input type="text" value={formData.borrower_inn} onChange={e => setFormData(p => ({...p, borrower_inn: e.target.value}))} placeholder="000000000" className={inputCls} /></div>
                  <div><label className={labelCls}>Вид деятельности *</label>
                    <input type="text" value={formData.business_type} onChange={e => setFormData(p => ({...p, business_type: e.target.value}))} placeholder="Торговля, производство..." className={inputCls} /></div>
                  <div><label className={labelCls}>Лет в бизнесе</label>
                    <input type="number" min="0" value={formData.years_in_business} onChange={e => setFormData(p => ({...p, years_in_business: e.target.value}))} placeholder="3" className={inputCls} /></div>
                  <div><label className={labelCls}>Сумма кредита *</label>
                    <input type="number" min="0" value={formData.loan_amount} onChange={e => setFormData(p => ({...p, loan_amount: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div><label className={labelCls}>Валюта</label>
                    <select value={formData.loan_currency} onChange={e => setFormData(p => ({...p, loan_currency: e.target.value}))} className={inputCls}>
                      {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Срок кредита</label>
                    <input type="text" value={formData.loan_term} onChange={e => setFormData(p => ({...p, loan_term: e.target.value}))} placeholder="12 месяцев" className={inputCls} /></div>
                  <div><label className={labelCls}>Кредитная история</label>
                    <select value={formData.credit_history} onChange={e => setFormData(p => ({...p, credit_history: e.target.value}))} className={inputCls}>
                      {CREDIT_HISTORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Цель кредита *</label>
                    <textarea value={formData.loan_purpose} onChange={e => setFormData(p => ({...p, loan_purpose: e.target.value}))} rows={3} placeholder="Пополнение оборотных средств..." className={inputCls + ' resize-none'} /></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Аналитик</label>
                    <input type="text" value={formData.analyst_name} onChange={e => setFormData(p => ({...p, analyst_name: e.target.value}))} placeholder="ФИО аналитика" className={inputCls} /></div>
                </div>
              )}

              {activeTab === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Годовая выручка (TJS)</label>
                    <input type="number" min="0" value={formData.annual_revenue} onChange={e => setFormData(p => ({...p, annual_revenue: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div><label className={labelCls}>Чистая прибыль (TJS)</label>
                    <input type="number" value={formData.net_profit} onChange={e => setFormData(p => ({...p, net_profit: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div><label className={labelCls}>Общие активы (TJS)</label>
                    <input type="number" min="0" value={formData.total_assets} onChange={e => setFormData(p => ({...p, total_assets: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div><label className={labelCls}>Общие обязательства (TJS)</label>
                    <input type="number" min="0" value={formData.total_liabilities} onChange={e => setFormData(p => ({...p, total_liabilities: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div><label className={labelCls}>Существующие кредиты (TJS)</label>
                    <input type="number" min="0" value={formData.existing_loans} onChange={e => setFormData(p => ({...p, existing_loans: e.target.value}))} placeholder="0" className={inputCls} /></div>
                </div>
              )}

              {activeTab === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Тип залога</label>
                    <select value={formData.collateral_type} onChange={e => setFormData(p => ({...p, collateral_type: e.target.value}))} className={inputCls}>
                      <option value="">Выберите тип</option>
                      {COLLATERAL_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Стоимость залога (TJS)</label>
                    <input type="number" min="0" value={formData.collateral_value} onChange={e => setFormData(p => ({...p, collateral_value: e.target.value}))} placeholder="0" className={inputCls} /></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Поручители</label>
                    <textarea value={formData.guarantors} onChange={e => setFormData(p => ({...p, guarantors: e.target.value}))} rows={3} placeholder="ФИО поручителей, их финансовое положение..." className={inputCls + ' resize-none'} /></div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-100">
              <div>{activeTab > 1 && <button onClick={() => setActiveTab(activeTab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {activeTab < 3 ? (
                  <button onClick={() => setActiveTab(activeTab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                ) : (
                  <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать заключение</>}
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

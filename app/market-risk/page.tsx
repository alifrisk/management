'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Filter } from 'lucide-react'

interface CounterpartyAssessment {
  id: string
  bank_name: string
  country: string
  analyst_name: string
  assessment_date: string
  // Показатели (1-4)
  intl_rating: number
  national_rating: number
  bank_history: number
  ownership: number
  license_revocation: number
  rating_revocation: number
  sanctions: number
  negative_media: number
  asset_volume: number
  capital_adequacy: number
  profitability: number
  liquidity: number
  // Результаты
  total_score: number
  reliability_category: string
  limit_recommendation: string
  ai_conclusion: string
  recommendation: string
  created_at: string
}

// Матрица оценок по каждому показателю
const CRITERIA = [
  {
    key: 'intl_rating', label: 'Международный рейтинг', weight: 5,
    options: [
      { value: 1, label: 'na (нет рейтинга)' },
      { value: 2, label: "Moody's B3-Baa1 / Fitch BBB- / S&P BBB-" },
      { value: 3, label: "Moody's A3-A1 / Fitch A- / S&P A-" },
      { value: 4, label: "Moody's Aa2-Aaa / Fitch AA / S&P AA+" },
    ]
  },
  {
    key: 'national_rating', label: 'Национальный рейтинг', weight: 5,
    options: [
      { value: 1, label: 'не ниже B3 или B-' },
      { value: 2, label: 'не ниже Ba3 или BB-' },
      { value: 3, label: 'не ниже Baa3 или BBB-' },
      { value: 4, label: 'от Aa2 до A3 и/или A-' },
    ]
  },
  {
    key: 'bank_history', label: 'История банка', weight: 5,
    options: [
      { value: 1, label: 'до 5 лет' },
      { value: 2, label: 'от 5 до 10 лет' },
      { value: 3, label: 'от 10 до 50 лет' },
      { value: 4, label: 'свыше 50 лет' },
    ]
  },
  {
    key: 'ownership', label: 'Состав собственников', weight: 5,
    options: [
      { value: 1, label: 'Компания неизвестна, мажоритарный — физлицо' },
      { value: 2, label: 'Компания неизвестна, мажоритарный — юрлицо' },
      { value: 3, label: 'Крупные организации с известной репутацией' },
      { value: 4, label: 'Государство или международные институты' },
    ]
  },
  {
    key: 'license_revocation', label: 'Отзыв лицензии', weight: 5,
    options: [
      { value: 1, label: 'Был зафиксирован случай за последний год' },
      { value: 2, label: 'Попытка отзыва, не завершённая' },
      { value: 3, label: 'Незначительные нарушения без угрозы лицензии' },
      { value: 4, label: 'Не было зафиксировано ни одного случая' },
    ]
  },
  {
    key: 'rating_revocation', label: 'Отзыв рейтинга', weight: 5,
    options: [
      { value: 1, label: 'Был зарегистрирован отзыв рейтинга' },
      { value: 2, label: 'Был понижен рейтинг' },
      { value: 3, label: 'Был подтверждён без изменений' },
      { value: 4, label: 'Рейтинг был повышен' },
    ]
  },
  {
    key: 'sanctions', label: 'Санкционные списки', weight: 5,
    options: [
      { value: 1, label: 'В списке OFAC' },
      { value: 2, label: 'В списке ЕС и OFSI' },
      { value: 3, label: 'В списке отдельных стран' },
      { value: 4, label: 'Не числится ни в одном санкционном списке' },
    ]
  },
  {
    key: 'negative_media', label: 'Негативные освещения в СМИ', weight: 5,
    options: [
      { value: 1, label: 'Существенная негативная информация (мошенничество)' },
      { value: 2, label: 'Информация о судебных исках, нарушениях' },
      { value: 3, label: 'Незначительная негативная информация' },
      { value: 4, label: 'Негативных освещений не обнаружено' },
    ]
  },
  {
    key: 'asset_volume', label: 'Объём активов', weight: 5,
    options: [
      { value: 1, label: 'до $100 млн' },
      { value: 2, label: 'от $100 млн до $1 млрд' },
      { value: 3, label: 'от $1 млрд до $10 млрд' },
      { value: 4, label: 'свыше $10 млрд' },
    ]
  },
  {
    key: 'capital_adequacy', label: 'Достаточность капитала', weight: 5,
    options: [
      { value: 1, label: '8% - 10%' },
      { value: 2, label: '10% - 13%' },
      { value: 3, label: '13% - 15%' },
      { value: 4, label: '15% - 25%' },
    ]
  },
  {
    key: 'profitability', label: 'Рентабельность (ROE/ROA)', weight: 5,
    options: [
      { value: 1, label: 'менее 0% (убыток)' },
      { value: 2, label: '0% - 5%' },
      { value: 3, label: '5% - 10%' },
      { value: 4, label: 'свыше 10%' },
    ]
  },
  {
    key: 'liquidity', label: 'Ликвидность (LCR)', weight: 5,
    options: [
      { value: 1, label: 'менее 50%' },
      { value: 2, label: '50% - 80%' },
      { value: 3, label: '80% - 100%' },
      { value: 4, label: 'свыше 100%' },
    ]
  },
]

function calcScore(form: Record<string, number>): number {
  return CRITERIA.reduce((sum, c) => sum + (form[c.key] || 0) * c.weight / 4, 0)
}

function getCategory(score: number): { category: string; limit: string; color: string } {
  if (score >= 50) return { category: 'Надёжность вне сомнений', limit: '$3-5 млн', color: 'green' }
  if (score >= 40) return { category: 'Надёжность выше средней', limit: '$1-3 млн', color: 'blue' }
  if (score >= 25) return { category: 'Средняя надёжность', limit: '$500K-1 млн', color: 'yellow' }
  return { category: 'Низкая надёжность', limit: 'до $500K', color: 'red' }
}

const EMPTY_SCORES: Record<string, number> = Object.fromEntries(CRITERIA.map(c => [c.key, 0]))

export default function MarketRiskPage() {
  const [assessments, setAssessments] = useState<CounterpartyAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [bankName, setBankName] = useState('')
  const [country, setCountry] = useState('')
  const [analystName, setAnalystName] = useState('')
  const [scores, setScores] = useState<Record<string, number>>(EMPTY_SCORES)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<CounterpartyAssessment | null>(null)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('counterparty_assessments').select('*').order('created_at', { ascending: false })
    if (filterYear) {
      query = query.gte('assessment_date', `${filterYear}-01-01`).lte('assessment_date', `${filterYear}-12-31`)
    }
    const { data } = await query
    setAssessments(data || [])
    setLoading(false)
  }, [filterYear])

  useEffect(() => { fetch_() }, [fetch_])

  const totalScore = calcScore(scores)
  const category = getCategory(totalScore)
  const filledCount = Object.values(scores).filter(v => v > 0).length

  async function handleGenerate() {
    if (!bankName.trim()) { setError('Введите название банка'); return }
    if (filledCount < 12) { setError(`Заполните все показатели (заполнено ${filledCount}/12)`); return }
    setGenerating(true); setError(null)

    try {
      const res = await fetch('/api/market-risk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, country, analystName, scores, totalScore, category }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { error: dbErr } = await supabase.from('counterparty_assessments').insert({
        bank_name: bankName, country, analyst_name: analystName,
        assessment_date: new Date().toISOString().split('T')[0],
        ...scores,
        total_score: Math.round(totalScore),
        reliability_category: category.category,
        limit_recommendation: category.limit,
        ai_conclusion: data.conclusion,
        recommendation: data.recommendation,
      })
      if (dbErr) throw new Error(dbErr.message)

      setShowModal(false)
      setBankName(''); setCountry(''); setAnalystName('')
      setScores(EMPTY_SCORES)
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function downloadWord(a: CounterpartyAssessment) {
    try {
      const res = await fetch('/api/market-risk/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment: a }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `Оценка_${a.bank_name}.docx`; link.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка Word: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить оценку?')) return
    await supabase.from('counterparty_assessments').delete().eq('id', id)
    fetch_()
  }

  const catColor = (cat: string) => {
    if (cat?.includes('вне сомнений')) return 'bg-green-100 text-green-800'
    if (cat?.includes('выше средней')) return 'bg-blue-100 text-blue-800'
    if (cat?.includes('средн')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const scoreColor = (score: number) => {
    if (score >= 50) return 'text-green-600'
    if (score >= 40) return 'text-blue-600'
    if (score >= 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Рыночный риск — Оценка контрагентов</h1>
          <p className="text-sm text-gray-500 mt-0.5">Матрица оценки надёжности банков-контрагентов</p>
        </div>
        <button onClick={() => { setBankName(''); setCountry(''); setAnalystName(''); setScores(EMPTY_SCORES); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новая оценка
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего оценок', value: assessments.length, color: 'text-gray-900' },
          { label: 'Надёжные', value: assessments.filter(a => a.total_score >= 50).length, color: 'text-green-600' },
          { label: 'Средние', value: assessments.filter(a => a.total_score >= 25 && a.total_score < 50).length, color: 'text-yellow-600' },
          { label: 'Низкая надёжность', value: assessments.filter(a => a.total_score < 25).length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все годы</option>
          {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все месяцы</option>
          {MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
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
                {['Банк','Страна','Дата','Балл','Категория надёжности','Лимит','Аналитик',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : assessments.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Нет оценок</td></tr>
                : assessments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{a.bank_name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.country || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-2xl font-bold ${scoreColor(a.total_score)}`}>{a.total_score}</span>
                      <span className="text-xs text-gray-400">/60</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColor(a.reliability_category)}`}>
                        {a.reliability_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{a.limit_recommendation}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.analyst_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadWord(a)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{viewing.bank_name}</h2>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={`col-span-1 p-4 rounded-xl text-center ${viewing.total_score >= 50 ? 'bg-green-50' : viewing.total_score >= 40 ? 'bg-blue-50' : viewing.total_score >= 25 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                  <p className={`text-4xl font-bold ${scoreColor(viewing.total_score)}`}>{viewing.total_score}</p>
                  <p className="text-xs text-gray-500 mt-1">из 60 баллов</p>
                </div>
                <div className="col-span-2 space-y-2">
                  {[
                    ['Банк', viewing.bank_name], ['Страна', viewing.country || '—'],
                    ['Категория', viewing.reliability_category], ['Лимит', viewing.limit_recommendation],
                    ['Аналитик', viewing.analyst_name || '—'],
                  ].map(([l, v]) => <div key={l} className="flex justify-between text-sm"><span className="text-gray-500">{l}:</span><span className="font-medium">{v}</span></div>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Оценка по критериям</p>
                <div className="grid grid-cols-2 gap-2">
                  {CRITERIA.map(c => {
                    const score = viewing[c.key as keyof CounterpartyAssessment] as number
                    const option = c.options.find(o => o.value === score)
                    return (
                      <div key={c.key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-600 truncate flex-1">{c.label}</span>
                        <span className={`text-xs font-bold ml-2 px-1.5 py-0.5 rounded ${score >= 3 ? 'bg-green-100 text-green-700' : score >= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{score}/4</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {viewing.ai_conclusion && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Заключение</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewing.ai_conclusion}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => downloadWord(viewing)} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]"><Download className="w-4 h-4" /> Word</button>
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* New Assessment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">Оценка надёжности контрагента</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}

              {/* Bank info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Название банка *</label>
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="ОАО 'Банк ...'" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Страна</label>
                  <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Таджикистан" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Аналитик</label>
                  <input type="text" value={analystName} onChange={e => setAnalystName(e.target.value)} placeholder="ФИО" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" />
                </div>
              </div>

              {/* Score preview */}
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${category.color === 'green' ? 'bg-green-50 border-green-200' : category.color === 'blue' ? 'bg-blue-50 border-blue-200' : category.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <p className="text-xs text-gray-500">Текущий балл</p>
                  <p className={`text-3xl font-bold ${scoreColor(totalScore)}`}>{Math.round(totalScore)} <span className="text-base text-gray-400">/ 60</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Категория</p>
                  <p className={`text-sm font-semibold ${scoreColor(totalScore)}`}>{category.category}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Лимит: {category.limit}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Заполнено</p>
                  <p className="text-sm font-semibold text-gray-700">{filledCount}/12</p>
                </div>
              </div>

              {/* Criteria */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Оценка по 12 критериям (выберите для каждого)</p>
                {CRITERIA.map((c, idx) => (
                  <div key={c.key} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-800">{idx + 1}. {c.label}</p>
                      {scores[c.key] > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scores[c.key] >= 3 ? 'bg-green-100 text-green-700' : scores[c.key] >= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {scores[c.key]}/4
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {c.options.map(opt => (
                        <button key={opt.value} onClick={() => setScores(p => ({ ...p, [c.key]: opt.value }))}
                          className={`text-left px-3 py-2 rounded-lg text-xs border-2 transition-all ${scores[c.key] === opt.value
                            ? opt.value === 1 ? 'bg-red-50 border-red-400 text-red-800'
                              : opt.value === 2 ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                              : opt.value === 3 ? 'bg-blue-50 border-blue-400 text-blue-800'
                              : 'bg-green-50 border-green-400 text-green-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          <span className={`font-bold mr-1 ${opt.value === 1 ? 'text-red-500' : opt.value === 2 ? 'text-yellow-500' : opt.value === 3 ? 'text-blue-500' : 'text-green-500'}`}>
                            {opt.value}
                          </span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <p className="text-xs text-gray-500">Заполнено: {filledCount}/12 критериев</p>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                <button onClick={handleGenerate} disabled={generating || filledCount < 12}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать заключение</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

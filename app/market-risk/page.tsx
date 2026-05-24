'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Filter } from 'lucide-react'

interface Assessment {
  id: string
  bank_name: string; country: string; analyst_name: string; assessment_date: string
  intl_rating_value: string; national_rating_value: string
  bank_history_years: number; ownership_type: string
  license_revocation_status: string; rating_revocation_status: string
  sanctions_status: string; negative_media_status: string
  total_assets: number; liquid_assets: number; total_capital: number
  risk_weighted_assets: number; short_term_liabilities: number
  total_liabilities: number; net_outflow_30d: number
  net_profit: number; equity: number
  car_ratio: number; roe_ratio: number; lcr_ratio: number
  score_intl_rating: number; score_national_rating: number; score_bank_history: number
  score_ownership: number; score_license: number; score_rating_revocation: number
  score_sanctions: number; score_negative_media: number; score_asset_volume: number
  score_capital_adequacy: number; score_profitability: number; score_liquidity: number
  total_score: number; reliability_category: string; limit_recommendation: string
  ai_conclusion: string; recommendation: string; created_at: string
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

// ✅ Выпадающие списки рейтингов
const INTL_RATINGS = [
  '', 'Нет рейтинга',
  'Moody\'s: Aaa', 'Moody\'s: Aa1', 'Moody\'s: Aa2', 'Moody\'s: Aa3',
  'Moody\'s: A1', 'Moody\'s: A2', 'Moody\'s: A3',
  'Moody\'s: Baa1', 'Moody\'s: Baa2', 'Moody\'s: Baa3',
  'Moody\'s: Ba1', 'Moody\'s: Ba2', 'Moody\'s: Ba3',
  'Moody\'s: B1', 'Moody\'s: B2', 'Moody\'s: B3',
  'Fitch: AAA', 'Fitch: AA+', 'Fitch: AA', 'Fitch: AA-',
  'Fitch: A+', 'Fitch: A', 'Fitch: A-',
  'Fitch: BBB+', 'Fitch: BBB', 'Fitch: BBB-',
  'Fitch: BB+', 'Fitch: BB', 'Fitch: BB-',
  'Fitch: B+', 'Fitch: B', 'Fitch: B-',
  'S&P: AAA', 'S&P: AA+', 'S&P: AA', 'S&P: AA-',
  'S&P: A+', 'S&P: A', 'S&P: A-',
  'S&P: BBB+', 'S&P: BBB', 'S&P: BBB-',
  'S&P: BB+', 'S&P: BB', 'S&P: BB-',
  'S&P: B+', 'S&P: B', 'S&P: B-',
]

const NATL_RATINGS = [
  '', 'Нет рейтинга',
  'AAA', 'AA+', 'AA', 'AA-',
  'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-',
  'BB+', 'BB', 'BB-',
  'B+', 'B', 'B-',
  'CCC', 'CC', 'C', 'D',
]

// ✅ Форматирование чисел с пробелами
const formatNum = (v: string) => {
  const num = v.replace(/\D/g, '')
  if (!num) return ''
  return new Intl.NumberFormat('ru-RU').format(Number(num))
}
const parseNum = (v: string) => v.replace(/[^0-9-]/g, '')

function calcScores(f: Record<string, string | number>) {
  const n = (k: string) => Number(String(f[k]).replace(/[^0-9.-]/g, '')) || 0
  const car = n('total_assets') > 0 ? (n('total_capital') / n('total_assets') * 100) : 0
  const roe = n('equity') > 0 ? (n('net_profit') / n('equity') * 100) : 0
  const lcr = n('short_term_liabilities') > 0 ? (n('liquid_assets') / n('short_term_liabilities') * 100) : 0
  const assetsUsd = n('total_assets') / 1_000_000
  const scores = {
    score_intl_rating: calcIntlRating(String(f.intl_rating_value || '')),
    score_national_rating: calcNationalRating(String(f.national_rating_value || '')),
    score_bank_history: calcHistory(n('bank_history_years')),
    score_ownership: calcOwnership(String(f.ownership_type || '')),
    score_license: calcLicense(String(f.license_revocation_status || '')),
    score_rating_revocation: calcRatingRevocation(String(f.rating_revocation_status || '')),
    score_sanctions: calcSanctions(String(f.sanctions_status || '')),
    score_negative_media: calcMedia(String(f.negative_media_status || '')),
    score_asset_volume: calcAssets(assetsUsd),
    score_capital_adequacy: calcCAR(car),
    score_profitability: calcROE(roe),
    score_liquidity: calcLCR(lcr),
  }
  const total = Math.round(Object.values(scores).reduce((s, v) => s + v * 5 / 4, 0))
  return { scores, car: Math.round(car * 10) / 10, roe: Math.round(roe * 10) / 10, lcr: Math.round(lcr * 10) / 10, total }
}

function calcIntlRating(r: string): number {
  if (!r || r.toLowerCase().includes('na') || r.toLowerCase().includes('нет')) return 1
  if (r.match(/B[1-3]|Ba[1-3]|BB|BBB/i)) return 2
  if (r.match(/A[1-3]|A-|A\+/i)) return 3
  if (r.match(/Aa|AA|Aaa|AAA/i)) return 4
  return 1
}
function calcNationalRating(r: string): number {
  if (!r || r.toLowerCase().includes('нет')) return 1
  if (r.match(/B[1-3]|B-/i)) return 1
  if (r.match(/Ba[1-3]|BB/i)) return 2
  if (r.match(/Baa|BBB/i)) return 3
  if (r.match(/Aa|AA|A[1-3]/i)) return 4
  return 2
}
function calcHistory(years: number): number {
  if (years < 5) return 1
  if (years < 10) return 2
  if (years < 50) return 3
  return 4
}
function calcOwnership(type: string): number {
  if (!type) return 0
  const t = type.toLowerCase()
  if (t.includes('физ') || t.includes('unknown') || t.includes('неизвест')) return 1
  if (t.includes('юр') || t.includes('частн')) return 2
  if (t.includes('крупн') || t.includes('известн')) return 3
  if (t.includes('государ') || t.includes('международ') || t.includes('цб')) return 4
  return 0
}
function calcLicense(s: string): number {
  if (!s) return 0
  const t = s.toLowerCase()
  if (t.includes('отозван') || t.includes('был случ')) return 1
  if (t.includes('попытк') || t.includes('предупр')) return 2
  if (t.includes('незначит') || t.includes('нарушен')) return 3
  return 4
}
function calcRatingRevocation(s: string): number {
  if (!s) return 0
  const t = s.toLowerCase()
  if (t.includes('отозван')) return 1
  if (t.includes('понижен') || t.includes('снижен')) return 2
  if (t.includes('подтверждён') || t.includes('без изм')) return 3
  if (t.includes('повышен') || t.includes('улучш')) return 4
  return 0
}
function calcSanctions(s: string): number {
  if (!s) return 0
  const t = s.toLowerCase()
  if (t.includes('ofac')) return 1
  if (t.includes('ес') || t.includes('ofsi')) return 2
  if (t.includes('отдельн')) return 3
  if (t.includes('нет') || t.includes('не числ')) return 4
  return 0
}
function calcMedia(s: string): number {
  if (!s) return 0
  const t = s.toLowerCase()
  if (t.includes('мошенн') || t.includes('существен')) return 1
  if (t.includes('суд') || t.includes('иск') || t.includes('нарушен')) return 2
  if (t.includes('незначит')) return 3
  return 4
}
function calcAssets(usd: number): number {
  if (usd < 100) return 1
  if (usd < 1000) return 2
  if (usd < 10000) return 3
  return 4
}
function calcCAR(car: number): number {
  if (car < 10) return 1
  if (car < 13) return 2
  if (car < 15) return 3
  return 4
}
function calcROE(roe: number): number {
  if (roe < 0) return 1
  if (roe < 5) return 2
  if (roe < 10) return 3
  return 4
}
function calcLCR(lcr: number): number {
  if (lcr < 50) return 1
  if (lcr < 80) return 2
  if (lcr < 100) return 3
  return 4
}
function getCategory(score: number) {
  if (score >= 50) return { label: 'Надёжность вне сомнений', limit: '$3-5 млн', color: 'green' }
  if (score >= 40) return { label: 'Надёжность выше средней', limit: '$1-3 млн', color: 'blue' }
  if (score >= 25) return { label: 'Средняя надёжность', limit: '$500K-1 млн', color: 'yellow' }
  return { label: 'Низкая надёжность', limit: 'до $500K', color: 'red' }
}
const SCORE_LABELS: Record<string, string> = {
  score_intl_rating: 'Международный рейтинг',
  score_national_rating: 'Национальный рейтинг',
  score_bank_history: 'История банка',
  score_ownership: 'Состав собственников',
  score_license: 'Отзыв лицензии',
  score_rating_revocation: 'Отзыв рейтинга',
  score_sanctions: 'Санкционные списки',
  score_negative_media: 'Негативные СМИ',
  score_asset_volume: 'Объём активов',
  score_capital_adequacy: 'Достаточность капитала (CAR)',
  score_profitability: 'Рентабельность (ROE)',
  score_liquidity: 'Ликвидность (LCR)',
}
const EMPTY = {
  bank_name: '', country: '', analyst_name: '',
  intl_rating_value: '', national_rating_value: '',
  bank_history_years: '', ownership_type: '',
  license_revocation_status: '', rating_revocation_status: '',
  sanctions_status: '', negative_media_status: '',
  total_assets: '', liquid_assets: '', total_capital: '',
  risk_weighted_assets: '', short_term_liabilities: '',
  total_liabilities: '', net_outflow_30d: '',
  net_profit: '', equity: '',
}

export default function MarketRiskPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Assessment | null>(null)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [tab, setTab] = useState(1)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('counterparty_assessments').select('*').order('created_at', { ascending: false })
    if (filterYear) query = query.gte('assessment_date', `${filterYear}-01-01`).lte('assessment_date', `${filterYear}-12-31`)
    if (filterYear && filterMonth) query = query.gte('assessment_date', `${filterYear}-${filterMonth}-01`).lte('assessment_date', `${filterYear}-${filterMonth}-31`)
    const { data } = await query
    setAssessments(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const setNum = (k: string, v: string) => setForm(p => ({ ...p, [k]: formatNum(v) }))
  const n = (k: string) => Number(String(form[k]).replace(/[^0-9.-]/g, '')) || 0
  const computed = calcScores(form)
  const category = getCategory(computed.total)

  async function handleGenerate() {
    if (!form.bank_name.trim()) { setError('Введите код контрагента'); return }
    setGenerating(true); setError(null)
    try {
      const payload = { ...form, ...computed.scores, car: computed.car, roe: computed.roe, lcr: computed.lcr, total: computed.total, category }
      const res = await fetch('/api/market-risk/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const { error: dbErr } = await supabase.from('counterparty_assessments').insert({
        bank_name: form.bank_name, country: form.country, analyst_name: form.analyst_name,
        assessment_date: new Date().toISOString().split('T')[0],
        intl_rating_value: form.intl_rating_value, national_rating_value: form.national_rating_value,
        bank_history_years: n('bank_history_years'),
        ownership_type: form.ownership_type,
        license_revocation_status: form.license_revocation_status,
        rating_revocation_status: form.rating_revocation_status,
        sanctions_status: form.sanctions_status,
        negative_media_status: form.negative_media_status,
        total_assets: n('total_assets'), liquid_assets: n('liquid_assets'),
        total_capital: n('total_capital'), risk_weighted_assets: n('risk_weighted_assets'),
        short_term_liabilities: n('short_term_liabilities'), total_liabilities: n('total_liabilities'),
        net_outflow_30d: n('net_outflow_30d'), net_profit: n('net_profit'), equity: n('equity'),
        car_ratio: computed.car, roe_ratio: computed.roe, lcr_ratio: computed.lcr,
        ...computed.scores,
        total_score: computed.total,
        reliability_category: category.label,
        limit_recommendation: category.limit,
        ai_conclusion: data.conclusion,
        recommendation: data.recommendation,
      })
      if (dbErr) throw new Error(dbErr.message)

      // ✅ Авто-создание в реестре контрагентов
      await supabase.from('counterparties').upsert({
        code: form.bank_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code', ignoreDuplicates: true })

      setShowModal(false); setForm(EMPTY); setTab(1); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function downloadWord(a: Assessment) {
    try {
      const res = await fetch('/api/market-risk/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment: a }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'Assessment.docx'; link.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('counterparty_assessments').delete().eq('id', id)
    fetch_()
  }

  const scoreColor = (s: number) => s >= 50 ? 'text-green-600' : s >= 40 ? 'text-blue-600' : s >= 25 ? 'text-yellow-600' : 'text-red-600'
  const catBg = (s: number) => s >= 50 ? 'bg-green-100 text-green-800' : s >= 40 ? 'bg-blue-100 text-blue-800' : s >= 25 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"
  const numInp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Рыночный риск — Оценка контрагентов</h1>
          <p className="text-sm text-gray-500 mt-0.5">Матрица оценки надёжности банков-контрагентов</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setTab(1); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новая оценка
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего оценок', value: assessments.length, c: 'text-gray-900' },
          { label: 'Надёжные (≥50)', value: assessments.filter(a => a.total_score >= 50).length, c: 'text-green-600' },
          { label: 'Средние (25-49)', value: assessments.filter(a => a.total_score >= 25 && a.total_score < 50).length, c: 'text-yellow-600' },
          { label: 'Низкие (<25)', value: assessments.filter(a => a.total_score < 25).length, c: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все годы</option>
          {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все месяцы</option>
          {MONTHS.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Контрагент','Страна','Дата','Балл','CAR','ROE','LCR','Категория','Лимит',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : assessments.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Нет оценок</td></tr>
                : assessments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{a.bank_name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.country || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3"><span className={`text-xl font-bold ${scoreColor(a.total_score)}`}>{a.total_score}</span><span className="text-xs text-gray-400">/60</span></td>
                    <td className="px-4 py-3 text-sm font-medium">{a.car_ratio ? `${a.car_ratio}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{a.roe_ratio ? `${a.roe_ratio}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{a.lcr_ratio ? `${a.lcr_ratio}%` : '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catBg(a.total_score)}`}>{a.reliability_category}</span></td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{a.limit_recommendation}</td>
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
              <div className={`p-4 rounded-xl flex items-center justify-between ${viewing.total_score >= 50 ? 'bg-green-50' : viewing.total_score >= 40 ? 'bg-blue-50' : viewing.total_score >= 25 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                <div>
                  <p className={`text-5xl font-bold ${scoreColor(viewing.total_score)}`}>{viewing.total_score}</p>
                  <p className="text-xs text-gray-500 mt-1">из 60 баллов</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${scoreColor(viewing.total_score)}`}>{viewing.reliability_category}</p>
                  <p className="text-xs text-gray-600 mt-1">Лимит: <span className="font-semibold">{viewing.limit_recommendation}</span></p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-600">
                    <span>CAR: <b>{viewing.car_ratio}%</b></span>
                    <span>ROE: <b>{viewing.roe_ratio}%</b></span>
                    <span>LCR: <b>{viewing.lcr_ratio}%</b></span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Матрица оценок</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SCORE_LABELS).map(([key, label]) => {
                    const score = viewing[key as keyof Assessment] as number
                    return (
                      <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-600">{label}</span>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4].map(v => (
                            <div key={v} className={`w-4 h-4 rounded-sm ${v <= score ? (score >= 3 ? 'bg-green-500' : score === 2 ? 'bg-yellow-500' : 'bg-red-500') : 'bg-gray-200'}`} />
                          ))}
                          <span className="text-xs font-bold ml-1 text-gray-700">{score}/4</span>
                        </div>
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

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">Оценка надёжности банка-контрагента</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex border-b border-gray-100 px-4">
              {[{n:1,t:'Общее'},{n:2,t:'Баланс'},{n:3,t:'ОПУ'},{n:4,t:'Качество'}].map(({n:tn,t}) => (
                <button key={tn} onClick={() => setTab(tn)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${tab===tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tn}. {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between mb-4 ${category.color==='green'?'bg-green-50 border-green-200':category.color==='blue'?'bg-blue-50 border-blue-200':category.color==='yellow'?'bg-yellow-50 border-yellow-200':'bg-red-50 border-red-200'}`}>
                <div>
                  <p className="text-xs text-gray-500">Текущий балл</p>
                  <p className={`text-3xl font-bold ${scoreColor(computed.total)}`}>{computed.total}<span className="text-base text-gray-400"> / 60</span></p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${scoreColor(computed.total)}`}>{category.label}</p>
                  <p className="text-xs text-gray-500">Лимит: {category.limit}</p>
                </div>
                <div className="text-right text-xs text-gray-600 space-y-0.5">
                  <p>CAR: <b>{computed.car}%</b></p>
                  <p>ROE: <b>{computed.roe}%</b></p>
                  <p>LCR: <b>{computed.lcr}%</b></p>
                </div>
              </div>

              {tab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Код контрагента *</label>
                    <input type="text" value={form.bank_name} onChange={e => setF('bank_name', e.target.value)} placeholder="Контрагент-001" className={inp} />
                    <p className="text-xs text-gray-400 mt-1">Используйте код вместо реального названия</p>
                  </div>
                  <div><label className={lbl}>Страна</label><input type="text" value={form.country} onChange={e => setF('country', e.target.value)} placeholder="Таджикистан" className={inp} /></div>
                  <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  <div><label className={lbl}>Стаж на рынке (лет)</label><input type="text" inputMode="numeric" value={form.bank_history_years} onChange={e => setF('bank_history_years', e.target.value.replace(/\D/g,''))} placeholder="15" className={inp} /></div>
                  <div>
                    <label className={lbl}>Международный рейтинг</label>
                    <select value={form.intl_rating_value} onChange={e => setF('intl_rating_value', e.target.value)} className={inp}>
                      {INTL_RATINGS.map(r => <option key={r} value={r}>{r || '— Выберите рейтинг —'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Национальный рейтинг</label>
                    <select value={form.national_rating_value} onChange={e => setF('national_rating_value', e.target.value)} className={inp}>
                      {NATL_RATINGS.map(r => <option key={r} value={r}>{r || '— Выберите рейтинг —'}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {tab === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg p-2">💡 Все суммы в USD. Данные из годового/квартального отчёта банка.</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div><label className={lbl}>Общие активы (USD)</label>
                      <input type="text" inputMode="numeric" value={form.total_assets} onChange={e => setNum('total_assets', e.target.value)} placeholder="0" className={numInp} /></div>
                    <div>
                      <label className={lbl}>Ликвидные активы (USD)</label>
                      <input type="text" inputMode="numeric" value={form.liquid_assets} onChange={e => setNum('liquid_assets', e.target.value)} placeholder="0" className={numInp} />
                      <p className="text-xs text-gray-400 mt-1">Наличные + средства в ЦБ + краткосрочные ценные бумаги</p>
                    </div>
                    <div><label className={lbl}>Собственный капитал (USD)</label>
                      <input type="text" inputMode="numeric" value={form.total_capital} onChange={e => setNum('total_capital', e.target.value)} placeholder="0" className={numInp} /></div>
                    <div>
                      <label className={lbl}>Краткосрочные обязательства (USD)</label>
                      <input type="text" inputMode="numeric" value={form.short_term_liabilities} onChange={e => setNum('short_term_liabilities', e.target.value)} placeholder="0" className={numInp} />
                      <p className="text-xs text-gray-400 mt-1">Депозиты до востребования + обязательства до 1 года</p>
                    </div>
                  </div>
                  {(computed.car > 0 || computed.lcr > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {computed.car > 0 && <div className={`p-3 rounded-lg ${computed.car >= 15 ? 'bg-green-50' : computed.car >= 10 ? 'bg-yellow-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">CAR</p><p className={`text-xl font-bold ${computed.car >= 15 ? 'text-green-600' : computed.car >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>{computed.car}%</p></div>}
                      {computed.lcr > 0 && <div className={`p-3 rounded-lg ${computed.lcr >= 100 ? 'bg-green-50' : computed.lcr >= 80 ? 'bg-yellow-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">LCR</p><p className={`text-xl font-bold ${computed.lcr >= 100 ? 'text-green-600' : computed.lcr >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{computed.lcr}%</p></div>}
                    </div>
                  )}
                </div>
              )}

              {tab === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div><label className={lbl}>Чистая прибыль (USD)</label>
                      <input type="text" inputMode="numeric" value={form.net_profit} onChange={e => setNum('net_profit', e.target.value)} placeholder="0" className={numInp} /></div>
                    <div><label className={lbl}>Собственный капитал (equity, USD)</label>
                      <input type="text" inputMode="numeric" value={form.equity} onChange={e => setNum('equity', e.target.value)} placeholder="0" className={numInp} /></div>
                  </div>
                  {computed.roe !== 0 && (
                    <div className={`p-3 rounded-lg ${computed.roe >= 10 ? 'bg-green-50' : computed.roe >= 5 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-gray-500">ROE</p>
                      <p className={`text-xl font-bold ${computed.roe >= 10 ? 'text-green-600' : computed.roe >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{computed.roe}%</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 4 && (
                <div className="space-y-4">
                  {[
                    { key: 'ownership_type', label: 'Состав собственников', options: ['Физическое лицо (мажоритар)', 'Юридическое лицо (частное)', 'Крупные известные организации', 'Государство / международные институты'] },
                    { key: 'license_revocation_status', label: 'Отзыв лицензии', options: ['Был зафиксирован случай за последний год', 'Попытка отзыва, не завершённая', 'Незначительные нарушения без угрозы лицензии', 'Не было зафиксировано ни одного случая'] },
                    { key: 'rating_revocation_status', label: 'Изменение рейтинга', options: ['Был отозван рейтинг', 'Рейтинг был понижен', 'Подтверждён без изменений', 'Рейтинг был повышен'] },
                    { key: 'sanctions_status', label: 'Санкционные списки', options: ['В списке OFAC', 'В списке ЕС и OFSI', 'В списке отдельных стран', 'Не числится ни в одном списке'] },
                    { key: 'negative_media_status', label: 'Негативные СМИ', options: ['Существенная негативная информация (мошенничество)', 'Информация о судебных исках, нарушениях', 'Незначительная негативная информация', 'Негативных освещений не обнаружено'] },
                  ].map(field => (
                    <div key={field.key} className="border border-gray-200 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-800 mb-3">{field.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {field.options.map((opt, i) => (
                          <button key={i} onClick={() => setF(field.key, form[field.key] === opt ? '' : opt)}
                            className={`text-left px-3 py-2 rounded-lg text-xs border-2 transition-all ${form[field.key] === opt
                              ? i === 0 ? 'bg-red-50 border-red-400 text-red-800' : i === 1 ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : i === 2 ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-green-50 border-green-400 text-green-800'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <span className={`font-bold mr-1 ${i===0?'text-red-500':i===1?'text-yellow-500':i===2?'text-blue-500':'text-green-500'}`}>{i+1}.</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Матрица оценок (автоматически)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(SCORE_LABELS).map(([key, label]) => {
                        const score = computed.scores[key as keyof typeof computed.scores] || 0
                        return (
                          <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <span className="text-xs text-gray-600 truncate flex-1">{label}</span>
                            <div className="flex items-center gap-0.5 ml-2">
                              {[1,2,3,4].map(v => (
                                <div key={v} className={`w-3 h-3 rounded-sm ${v <= score ? (score >= 3 ? 'bg-green-500' : score === 2 ? 'bg-yellow-500' : score === 1 ? 'bg-red-500' : 'bg-gray-300') : 'bg-gray-200'}`} />
                              ))}
                              <span className="text-xs font-bold ml-1 text-gray-700">{score > 0 ? `${score}/4` : '—'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {tab < 4
                  ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                  : <button onClick={handleGenerate} disabled={generating}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать</>}
                    </button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Download, Filter, Upload, FileText } from 'lucide-react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const CURRENCIES = [
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'AED' },
  { code: 'UZS', name: 'Узбекский сум', symbol: 'UZS' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾' },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
  { code: 'TJS', name: 'Таджикский сомони', symbol: 'TJS' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺' },
  { code: 'JPY', name: 'Японская иена', symbol: '¥' },
  { code: 'BHD', name: 'Бахрейнский динар', symbol: 'BHD' },
]

interface FinAnalysis {
  id: string; code: string; analyst_name: string
  p1_label: string; p2_label: string
  currency: string; p1_usd_rate: number; p2_usd_rate: number
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
  p1_fx_income: number; p2_fx_income: number
  p1_other_income: number; p2_other_income: number
  p1_operating_expense: number; p2_operating_expense: number
  p1_provisions: number; p2_provisions: number
  p1_net_profit: number; p2_net_profit: number
  counterparty_type: string; ai_conclusion: string; created_at: string
}

const EMPTY = {
  code: '', analyst_name: '', p1_label: '', p2_label: '',
  counterparty_type: 'Банк', currency: 'USD', p1_usd_rate: '1', p2_usd_rate: '1',
  p1_cash: '', p2_cash: '', p1_receivables: '', p2_receivables: '',
  p1_investments: '', p2_investments: '', p1_loans_issued: '', p2_loans_issued: '',
  p1_fixed_assets: '', p2_fixed_assets: '', p1_other_assets: '', p2_other_assets: '',
  p1_deposits: '', p2_deposits: '', p1_borrowings: '', p2_borrowings: '',
  p1_other_liab: '', p2_other_liab: '', p1_equity: '', p2_equity: '',
  p1_interest_income: '', p2_interest_income: '', p1_interest_expense: '', p2_interest_expense: '',
  p1_fee_income: '', p2_fee_income: '', p1_fx_income: '', p2_fx_income: '',
  p1_other_income: '', p2_other_income: '', p1_operating_expense: '', p2_operating_expense: '',
  p1_provisions: '', p2_provisions: '', p1_net_profit: '', p2_net_profit: '',
}

const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g, '')) || 0

interface FRProps {
  label: string; f1: string; f2: string
  form: Record<string, string>; setF: (k: string, v: string) => void
  bold?: boolean; auto?: boolean; v1?: number; v2?: number
  p1rate?: number; p2rate?: number; currSymbol?: string; notUSD?: boolean
}
function FR({ label, f1, f2, bold, auto, v1, v2, form, setF, p1rate = 1, p2rate = 1, currSymbol = '$', notUSD = false }: FRProps) {
  const cls = "w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] text-right bg-white"
  const shouldConvert = notUSD && p1rate > 0
  const toUSD1 = (v: number) => shouldConvert ? v / p1rate : v
  const toUSD2 = (v: number) => (notUSD && p2rate > 0) ? v / p2rate : v

  return (
    <tr className={bold ? 'bg-gray-50' : 'hover:bg-blue-50/20'}>
      <td className={`px-3 py-1.5 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</td>
      <td className="px-2 py-1">
        {auto
          ? <div className="space-y-0.5">
              <div className={`text-sm font-bold text-right pr-2 ${(v1||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v1||0)}</div>
              {shouldConvert && v1 !== undefined && v1 > 0 && <div className="text-xs text-gray-400 text-right pr-2">≈ ${fmt(toUSD1(v1))}</div>}
            </div>
          : <div className="space-y-0.5">
              <input type="text" inputMode="numeric" value={form[f1] || ''} onChange={e => setF(f1, fmtN(e.target.value))} className={cls} placeholder="0" />
              {shouldConvert && parseN(form[f1]) > 0 && <div className="text-xs text-gray-400 text-right">≈ ${fmt(toUSD1(parseN(form[f1])))}</div>}
            </div>}
      </td>
      <td className="px-2 py-1">
        {auto
          ? <div className="space-y-0.5">
              <div className={`text-sm font-bold text-right pr-2 ${(v2||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v2||0)}</div>
              {(notUSD && p2rate > 0) && v2 !== undefined && v2 > 0 && <div className="text-xs text-gray-400 text-right pr-2">≈ ${fmt(toUSD2(v2))}</div>}
            </div>
          : <div className="space-y-0.5">
              <input type="text" inputMode="numeric" value={form[f2] || ''} onChange={e => setF(f2, fmtN(e.target.value))} className={cls} placeholder="0" />
              {(notUSD && p2rate > 0) && parseN(form[f2]) > 0 && <div className="text-xs text-gray-400 text-right">≈ ${fmt(toUSD2(parseN(form[f2])))}</div>}
            </div>}
      </td>
    </tr>
  )
}

function FT({ title, p1, p2, currency, children }: { title: string; p1: string; p2: string; currency: string; children: React.ReactNode }) {
  const curr = CURRENCIES.find(c => c.code === currency)
  const sym = curr?.symbol || currency
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#1B8A4C] text-white">
            <th className="text-left px-3 py-2 text-xs font-medium w-1/2">Показатель</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-1/4">{p1 || 'Период 1'} (тыс. {sym})</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-1/4">{p2 || 'Период 2'} (тыс. {sym})</th>
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
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [inputMode, setInputMode] = useState<'manual' | 'image'>('manual')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<string | null>(null)
  const [extractWarn, setExtractWarn] = useState<string[]>([])
  const [sameRate, setSameRate] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('counterparty_financials').select('*').order('created_at', { ascending: false })
    if (filterYear) query = query.gte('created_at', `${filterYear}-01-01`).lte('created_at', `${filterYear}-12-31`)
    if (filterYear && filterMonth) query = query.gte('created_at', `${filterYear}-${filterMonth}-01`).lte('created_at', `${filterYear}-${filterMonth}-31`)
    const { data } = await query
    setAnalyses(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const n = (k: string) => parseN(form[k] || '')
  const p1_rate = Number(form.p1_usd_rate) || 1
  const p2_rate = Number(form.p2_usd_rate) || 1
  const isUSD = form.currency === 'USD'
  const toUSD1 = (v: number) => isUSD ? v : v / p1_rate
  const toUSD2 = (v: number) => isUSD ? v : v / p2_rate
  const nUSD1 = (k: string) => toUSD1(n(k.replace('p2_', 'p1_')))
  const nUSD2 = (k: string) => toUSD2(n(k.replace('p1_', 'p2_')))

  const p1 = form.p1_label || 'Период 1'
  const p2 = form.p2_label || 'Период 2'
  const currSymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol || '$'

  // Computed in original currency
  const p1_total_assets = n('p1_cash') + n('p1_receivables') + n('p1_investments') + n('p1_loans_issued') + n('p1_fixed_assets') + n('p1_other_assets')
  const p2_total_assets = n('p2_cash') + n('p2_receivables') + n('p2_investments') + n('p2_loans_issued') + n('p2_fixed_assets') + n('p2_other_assets')
  const p1_total_liab = n('p1_deposits') + n('p1_borrowings') + n('p1_other_liab')
  const p2_total_liab = n('p2_deposits') + n('p2_borrowings') + n('p2_other_liab')
  const p1_total_passiv = p1_total_liab + n('p1_equity')
  const p2_total_passiv = p2_total_liab + n('p2_equity')
  const p1_nim = n('p1_interest_income') - n('p1_interest_expense')
  const p2_nim = n('p2_interest_income') - n('p2_interest_expense')
  const p1_op_income = p1_nim + n('p1_fee_income') + n('p1_fx_income') + n('p1_other_income')
  const p2_op_income = p2_nim + n('p2_fee_income') + n('p2_fx_income') + n('p2_other_income')
  const p1_pre_tax = p1_op_income - n('p1_operating_expense') - n('p1_provisions')
  const p2_pre_tax = p2_op_income - n('p2_operating_expense') - n('p2_provisions')

  // Computed in USD for ratios (each period uses its own rate)
  const p1_total_assets_usd = toUSD1(p1_total_assets)
  const p2_total_assets_usd = toUSD2(p2_total_assets)
  const p1_car = p1_total_assets_usd > 0 ? (toUSD1(n('p1_equity')) / p1_total_assets_usd * 100) : 0
  const p2_car = p2_total_assets_usd > 0 ? (toUSD2(n('p2_equity')) / p2_total_assets_usd * 100) : 0
  const p1_roe = toUSD1(n('p1_equity')) > 0 ? (toUSD1(n('p1_net_profit')) / toUSD1(n('p1_equity')) * 100) : 0
  const p2_roe = toUSD2(n('p2_equity')) > 0 ? (toUSD2(n('p2_net_profit')) / toUSD2(n('p2_equity')) * 100) : 0
  const p1_liq_assets = toUSD1(n('p1_cash')) + toUSD1(n('p1_receivables')) + toUSD1(n('p1_investments'))
  const p2_liq_assets = toUSD2(n('p2_cash')) + toUSD2(n('p2_receivables')) + toUSD2(n('p2_investments'))
  const p1_total_liab_usd = toUSD1(p1_total_liab)
  const p2_total_liab_usd = toUSD2(p2_total_liab)
  const p1_liquidity = p1_total_liab_usd > 0 ? (p1_liq_assets / p1_total_liab_usd * 100) : 0
  const p2_liquidity = p2_total_liab_usd > 0 ? (p2_liq_assets / p2_total_liab_usd * 100) : 0

  async function handleExtract() {
    if (!imageFile) return
    setExtracting(true); setExtractMsg(null); setExtractWarn([])
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve((e.target?.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })
      const res = await apiFetch('/api/extract-from-image', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, mimeType: imageFile.type, module: 'financial' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const STRING_FIELDS = ['p1_label', 'p2_label']
      const extracted: Record<string, string> = {}
      for (const [k, v] of Object.entries(data.data)) {
        if (v !== null && v !== undefined && v !== 0) {
          extracted[k] = STRING_FIELDS.includes(k) ? String(v) : fmtN(String(Math.round(Number(v))))
        }
      }
      setForm(prev => ({ ...prev, ...extracted }))

      // Check for missing required sections
      const d = data.data as Record<string, number>
      const warnings: string[] = []
      const hasAssets = (d.p1_cash || 0) + (d.p1_loans_issued || 0) + (d.p1_investments || 0) + (d.p1_receivables || 0) > 0
      const hasLiab = (d.p1_deposits || 0) + (d.p1_borrowings || 0) > 0
      const hasEquity = (d.p1_equity || 0) > 0
      const hasIncome = (d.p1_interest_income || 0) + (d.p1_net_profit || 0) > 0
      const hasP2 = (d.p2_cash || 0) + (d.p2_loans_issued || 0) + (d.p2_equity || 0) > 0
      if (!hasAssets) warnings.push('активы (денежные средства, кредитный портфель)')
      if (!hasLiab) warnings.push('обязательства (депозиты, заимствования)')
      if (!hasEquity) warnings.push('собственный капитал')
      if (!hasIncome) warnings.push('доходы (процентные доходы или чистая прибыль)')
      if (!hasP2) warnings.push('данные второго периода (П2)')
      setExtractWarn(warnings)

      setInputMode('manual')
      setImageFile(null)
      setExtractMsg(warnings.length === 0
        ? 'Данные извлечены. Проверьте и при необходимости исправьте.'
        : 'Данные частично извлечены. Не хватает некоторых разделов — заполните вручную.')
    } catch (err: unknown) {
      setExtractMsg('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setExtracting(false) }
  }

  async function downloadWord(a: FinAnalysis) {
    try {
      const res = await fetch('/api/market-risk/export-word-fin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: a }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'FinAnalysis.docx'; link.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleGenerate() {
    if (!form.code.trim()) { setError('Введите код контрагента'); return }
    setGenerating(true); setError(null)
    try {
      const res = await apiFetch('/api/market-risk/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code, counterparty_type: form.counterparty_type || 'Банк', p1_label: p1, p2_label: p2,
          currency: form.currency, p1_usd_rate: p1_rate, p2_usd_rate: p2_rate,
          p1_total_assets: p1_total_assets_usd, p2_total_assets: p2_total_assets_usd,
          p1_total_liab: toUSD1(p1_total_liab), p2_total_liab: toUSD2(p2_total_liab),
          p1_equity: toUSD1(n('p1_equity')), p2_equity: toUSD2(n('p2_equity')),
          p1_nim: toUSD1(p1_nim), p2_nim: toUSD2(p2_nim),
          p1_fx_income: toUSD1(n('p1_fx_income')), p2_fx_income: toUSD2(n('p2_fx_income')),
          p1_other_income: toUSD1(n('p1_other_income')), p2_other_income: toUSD2(n('p2_other_income')),
          p1_op_income: toUSD1(p1_op_income), p2_op_income: toUSD2(p2_op_income),
          p1_net_profit: toUSD1(n('p1_net_profit')), p2_net_profit: toUSD2(n('p2_net_profit')),
          p1_car: Math.round(p1_car * 10) / 10, p2_car: Math.round(p2_car * 10) / 10,
          p1_roe: Math.round(p1_roe * 10) / 10, p2_roe: Math.round(p2_roe * 10) / 10,
          p1_liquidity: Math.round(p1_liquidity * 10) / 10, p2_liquidity: Math.round(p2_liquidity * 10) / 10,
          p1_cash_usd: toUSD1(n('p1_cash')), p2_cash_usd: toUSD2(n('p2_cash')),
          p1_receivables_usd: toUSD1(n('p1_receivables')), p2_receivables_usd: toUSD2(n('p2_receivables')),
          p1_investments_usd: toUSD1(n('p1_investments')), p2_investments_usd: toUSD2(n('p2_investments')),
          p1_provisions: toUSD1(n('p1_provisions')), p2_provisions: toUSD2(n('p2_provisions')),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Save original currency values to DB
      const vals = (k: string) => parseN(form[k] || '')
      const { error: dbErr } = await supabase.from('counterparty_financials').insert({
        code: form.code, analyst_name: form.analyst_name, counterparty_type: form.counterparty_type || 'Банк',
        p1_label: p1, p2_label: p2,
        currency: form.currency, p1_usd_rate: p1_rate, p2_usd_rate: p2_rate,
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
        p1_fx_income: vals('p1_fx_income'), p2_fx_income: vals('p2_fx_income'),
        p1_other_income: vals('p1_other_income'), p2_other_income: vals('p2_other_income'),
        p1_operating_expense: vals('p1_operating_expense'), p2_operating_expense: vals('p2_operating_expense'),
        p1_provisions: vals('p1_provisions'), p2_provisions: vals('p2_provisions'),
        p1_net_profit: vals('p1_net_profit'), p2_net_profit: vals('p2_net_profit'),
        ai_conclusion: data.conclusion,
      })
      if (dbErr) throw new Error(dbErr.message)
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
        <button onClick={() => { setForm(EMPTY); setTab(1); setError(null); setInputMode('manual'); setImageFile(null); setExtractMsg(null); setShowModal(true) }}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Контрагент','Тип','Аналитик','Периоды','Валюта','Активы П2 (тыс. $)','CAR П2','ROE П2','Дата',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              : analyses.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Нет анализов</td></tr>
              : analyses.map(a => {
                const r1 = a.p1_usd_rate || 1
                const r2 = a.p2_usd_rate || 1
                const toUsd1 = (v: number) => a.currency === 'USD' ? v : v / r1
                const toUsd2 = (v: number) => a.currency === 'USD' ? v : v / r2
                const assets2raw = a.p2_cash + a.p2_receivables + a.p2_investments + a.p2_loans_issued + a.p2_fixed_assets + a.p2_other_assets
                const assets2 = toUsd2(assets2raw)
                const car2 = assets2 > 0 ? (toUsd2(a.p2_equity) / assets2 * 100).toFixed(1) : null
                const roe2 = a.p2_equity > 0 ? (toUsd2(a.p2_net_profit) / toUsd2(a.p2_equity) * 100).toFixed(1) : null
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{a.code}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.counterparty_type || 'Банк'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.analyst_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.p1_label} → {a.p2_label}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {a.currency || 'USD'}{a.currency && a.currency !== 'USD' ? ` П1:×${a.p1_usd_rate} П2:×${a.p2_usd_rate}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{assets2 > 0 ? `$${fmt(assets2)}` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{car2 ? `${car2}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{roe2 ? `${roe2}%` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadWord(a)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
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
              <div>
                <h2 className="text-lg font-semibold">{viewing.code} — Финансовый анализ</h2>
                {viewing.currency && viewing.currency !== 'USD' && (
                  <p className="text-xs text-gray-400 mt-0.5">Валюта: {viewing.currency} · П1: 1 USD = {viewing.p1_usd_rate} · П2: 1 USD = {viewing.p2_usd_rate}</p>
                )}
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Активы П1 (тыс. $)', `$${fmt((viewing.p1_usd_rate||1) > 1 ? (viewing.p1_cash + viewing.p1_receivables + viewing.p1_investments + viewing.p1_loans_issued + viewing.p1_fixed_assets + viewing.p1_other_assets) / (viewing.p1_usd_rate||1) : (viewing.p1_cash + viewing.p1_receivables + viewing.p1_investments + viewing.p1_loans_issued + viewing.p1_fixed_assets + viewing.p1_other_assets))}`],
                  ['Активы П2 (тыс. $)', `$${fmt((viewing.p2_usd_rate||1) > 1 ? (viewing.p2_cash + viewing.p2_receivables + viewing.p2_investments + viewing.p2_loans_issued + viewing.p2_fixed_assets + viewing.p2_other_assets) / (viewing.p2_usd_rate||1) : (viewing.p2_cash + viewing.p2_receivables + viewing.p2_investments + viewing.p2_loans_issued + viewing.p2_fixed_assets + viewing.p2_other_assets))}`],
                  ['Прибыль П1 (тыс. $)', `$${fmt((viewing.p1_usd_rate||1) > 1 ? viewing.p1_net_profit / (viewing.p1_usd_rate||1) : viewing.p1_net_profit)}`],
                  ['Прибыль П2 (тыс. $)', `$${fmt((viewing.p2_usd_rate||1) > 1 ? viewing.p2_net_profit / (viewing.p2_usd_rate||1) : viewing.p2_net_profit)}`],
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
              <h2 className="text-base font-semibold">Финансовый анализ контрагента</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {/* Mode switcher */}
            <div className="flex border-b border-gray-100 px-2 gap-0">
              <button onClick={() => { setInputMode('manual'); setExtractMsg(null) }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${inputMode === 'manual' ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <FileText className="w-3.5 h-3.5" /> Ввести вручную
              </button>
              <button onClick={() => { setInputMode('image'); setExtractMsg(null) }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${inputMode === 'image' ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Upload className="w-3.5 h-3.5" /> Загрузить скрин
              </button>
            </div>

            {/* Tabs — only in manual mode */}
            {inputMode === 'manual' && (
            <div className="flex border-b border-gray-100 px-4">
              {[{n:1,t:'Общее'},{n:2,t:'Баланс'},{n:3,t:'ОПУ'}].map(({n:tn,t}) => (
                <button key={tn} onClick={() => setTab(tn)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${tab===tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tn}. {t}
                </button>
              ))}
            </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Image upload zone */}
              {inputMode === 'image' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Загрузите скриншот финансовой отчётности банка или контрагента. AI извлечёт данные и заполнит форму автоматически.</p>
                  <label className="block cursor-pointer">
                    <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${imageFile ? 'border-[#1B8A4C] bg-green-50' : 'border-gray-200 hover:border-[#1B8A4C] hover:bg-gray-50'}`}>
                      {imageFile ? (
                        <div className="space-y-2">
                          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                          <p className="text-sm font-medium text-gray-800">{imageFile.name}</p>
                          <p className="text-xs text-gray-400">{(imageFile.size / 1024).toFixed(0)} KB · Готово к извлечению</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                          <p className="text-sm font-medium text-gray-500">Нажмите или перетащите файл</p>
                          <p className="text-xs text-gray-400">PNG, JPG, WEBP · до 5 МБ</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => { setImageFile(e.target.files?.[0] || null); setExtractMsg(null) }} />
                  </label>
                  {extractMsg && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600">{extractMsg}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Manual form */}
              {inputMode === 'manual' && <>
              {extractMsg && (
                <div className={`flex items-start gap-2 p-3 border rounded-lg mb-2 ${extractWarn.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'}`}>
                  {extractWarn.length > 0
                    ? <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className={`text-sm ${extractWarn.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{extractMsg}</p>
                    {extractWarn.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {extractWarn.map(w => <li key={w} className="text-xs text-yellow-600">• Не найдено: {w}</li>)}
                      </ul>
                    )}
                  </div>
                  <button onClick={() => { setExtractMsg(null); setExtractWarn([]) }}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
                </div>
              )}
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}

              {tab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Код контрагента *</label>
                    <input type="text" value={form.code} onChange={e => setF('code', e.target.value)} placeholder="Контрагент-001" className={inp} />
                    <p className="text-xs text-gray-400 mt-1">Используйте код вместо реального названия</p>
                  </div>
                  <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  <div>
                    <label className={lbl}>Тип контрагента</label>
                    <select value={form.counterparty_type} onChange={e => setF('counterparty_type', e.target.value)} className={inp}>
                      <option value="Банк">Банк</option>
                      <option value="Брокерская компания">Брокерская компания</option>
                      <option value="Инвестиционная компания">Инвестиционная компания</option>
                    </select>
                  </div>
                  <div><label className={lbl}>Название периода 1</label><input type="text" value={form.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="31.12.2024" className={inp} /></div>
                  <div><label className={lbl}>Название периода 2</label><input type="text" value={form.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="31.03.2025" className={inp} /></div>

                  {/* ✅ Валюта и курс */}
                  <div>
                    <label className={lbl}>Валюта отчётности</label>
                    <select value={form.currency} onChange={e => { setF('currency', e.target.value); if (e.target.value === 'USD') { setF('p1_usd_rate', '1'); setF('p2_usd_rate', '1') } }} className={inp}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className={lbl + ' mb-0'}>
                        {form.currency === 'USD' ? 'Курс (USD — основная валюта)' : `Курс: 1 USD = ? ${form.currency}`}
                      </label>
                      {form.currency !== 'USD' && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={sameRate} onChange={e => {
                            setSameRate(e.target.checked)
                            if (e.target.checked) setF('p2_usd_rate', form.p1_usd_rate)
                          }} className="rounded" />
                          <span className="text-xs text-gray-500">Одинаковый для П1 и П2</span>
                        </label>
                      )}
                    </div>
                    <div className={`grid gap-3 ${sameRate || form.currency === 'USD' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <div>
                        {!sameRate && form.currency !== 'USD' && <p className="text-xs text-gray-400 mb-1">Период 1</p>}
                        <input type="text" inputMode="decimal" value={form.p1_usd_rate}
                          onChange={e => { setF('p1_usd_rate', e.target.value); if (sameRate) setF('p2_usd_rate', e.target.value) }}
                          disabled={form.currency === 'USD'}
                          placeholder={form.currency === 'USD' ? '1' : 'Например: 10.92'}
                          className={`${inp} ${form.currency === 'USD' ? 'bg-gray-50 text-gray-400' : ''}`}
                        />
                        {form.currency !== 'USD' && Number(form.p1_usd_rate) > 0 && (
                          <p className="text-xs text-green-700 mt-1">1 USD = {form.p1_usd_rate} {form.currency}</p>
                        )}
                      </div>
                      {!sameRate && form.currency !== 'USD' && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Период 2</p>
                          <input type="text" inputMode="decimal" value={form.p2_usd_rate}
                            onChange={e => setF('p2_usd_rate', e.target.value)}
                            placeholder="Например: 10.85"
                            className={inp}
                          />
                          {Number(form.p2_usd_rate) > 0 && (
                            <p className="text-xs text-green-700 mt-1">1 USD = {form.p2_usd_rate} {form.currency}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      💡 Вводите суммы в <strong>тысячах</strong> {form.currency} (напр. 1 000 = 1 млн).
                      {!isUSD && ' Система конвертирует в USD автоматически.'}
                    </p>
                  </div>
                </div>
              )}

              {tab === 2 && (
                <div className="space-y-2">
                  <FT title="АКТИВ" p1={p1} p2={p2} currency={form.currency}>
                    <FR label="Денежные средства и счета в ЦБ" f1="p1_cash" f2="p2_cash" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Средства в других банках" f1="p1_receivables" f2="p2_receivables" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Инвестиционные ценные бумаги" f1="p1_investments" f2="p2_investments" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Кредитный портфель (нетто)" f1="p1_loans_issued" f2="p2_loans_issued" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Основные средства" f1="p1_fixed_assets" f2="p2_fixed_assets" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Прочие активы" f1="p1_other_assets" f2="p2_other_assets" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="ИТОГО АКТИВ" bold auto v1={p1_total_assets} v2={p2_total_assets} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  </FT>
                  <FT title="ПАССИВ" p1={p1} p2={p2} currency={form.currency}>
                    <FR label="Депозиты клиентов" f1="p1_deposits" f2="p2_deposits" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Заёмные средства (МБК, займы)" f1="p1_borrowings" f2="p2_borrowings" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Прочие обязательства" f1="p1_other_liab" f2="p2_other_liab" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Итого обязательства" bold auto v1={p1_total_liab} v2={p2_total_liab} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="Собственный капитал" f1="p1_equity" f2="p2_equity" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                    <FR label="ИТОГО ПАССИВ" bold auto v1={p1_total_passiv} v2={p2_total_passiv} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  </FT>

                  {/* Balance check */}
                  {(p1_total_assets > 0 || p2_total_assets > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {p1_total_assets > 0 && (
                        <div className={`p-3 rounded-lg border text-xs font-medium ${Math.abs(p1_total_assets - p1_total_passiv) < 1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {p1}: {Math.abs(p1_total_assets - p1_total_passiv) < 1 ? '✅ Баланс сходится' : `⚠️ Разница: ${fmt(Math.abs(p1_total_assets - p1_total_passiv))} ${currSymbol}`}
                        </div>
                      )}
                      {p2_total_assets > 0 && (
                        <div className={`p-3 rounded-lg border text-xs font-medium ${Math.abs(p2_total_assets - p2_total_passiv) < 1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {p2}: {Math.abs(p2_total_assets - p2_total_passiv) < 1 ? '✅ Баланс сходится' : `⚠️ Разница: ${fmt(Math.abs(p2_total_assets - p2_total_passiv))} ${currSymbol}`}
                        </div>
                      )}
                    </div>
                  )}

                  {(p1_car > 0 || p2_car > 0) && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`p-3 rounded-lg ${p2_car >= 13 ? 'bg-green-50' : p2_car >= 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500">CAR (капитал/активы)</p>
                        <p className={`text-xl font-bold ${p2_car >= 13 ? 'text-green-600' : p2_car >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>{p1_car.toFixed(1)}% → {p2_car.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">норма НБТ ≥13%</p>
                      </div>
                      <div className={`p-3 rounded-lg ${p2_roe >= 10 ? 'bg-green-50' : p2_roe >= 5 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500">ROE (прибыль/капитал)</p>
                        <p className={`text-xl font-bold ${p2_roe >= 10 ? 'text-green-600' : p2_roe >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{p1_roe.toFixed(1)}% → {p2_roe.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">норма ≥10%</p>
                      </div>
                      <div className={`p-3 rounded-lg ${p2_liquidity >= 30 ? 'bg-green-50' : p2_liquidity >= 20 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-500">Ликвидность (лик. активы/обяз-ва)</p>
                        <p className={`text-xl font-bold ${p2_liquidity >= 30 ? 'text-green-600' : p2_liquidity >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>{p1_liquidity.toFixed(1)}% → {p2_liquidity.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">норма НБТ ≥30%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 3 && (
                <FT title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ" p1={p1} p2={p2} currency={form.currency}>
                  <FR label="Процентные доходы" f1="p1_interest_income" f2="p2_interest_income" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Процентные расходы" f1="p1_interest_expense" f2="p2_interest_expense" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="▶ Чистый процентный доход (NIM)" bold auto v1={p1_nim} v2={p2_nim} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Комиссионные доходы" f1="p1_fee_income" f2="p2_fee_income" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Доход от FX операций" f1="p1_fx_income" f2="p2_fx_income" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Прочие операционные доходы" f1="p1_other_income" f2="p2_other_income" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="▶ Операционный доход" bold auto v1={p1_op_income} v2={p2_op_income} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Операционные расходы" f1="p1_operating_expense" f2="p2_operating_expense" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="Резервы на потери по кредитам" f1="p1_provisions" f2="p2_provisions" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="▶ Прибыль до налогов" bold auto v1={p1_pre_tax} v2={p2_pre_tax} f1="" f2="" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                  <FR label="▶ Чистая прибыль" bold f1="p1_net_profit" f2="p2_net_profit" form={form} setF={setF} p1rate={p1_rate} p2rate={p2_rate} currSymbol={currSymbol} notUSD={!isUSD} />
                </FT>
              )}
              </>}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              {inputMode === 'image' ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowModal(false); setInputMode('manual'); setImageFile(null); setExtractMsg(null) }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    <button onClick={handleExtract} disabled={!imageFile || extracting}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Извлечение...</> : <><Upload className="w-4 h-4" /> Извлечь данные</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowModal(false); setInputMode('manual'); setImageFile(null); setExtractMsg(null) }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    {tab < 3
                      ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                      : <button onClick={handleGenerate} disabled={generating}
                          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> Сгенерировать анализ</>}
                        </button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

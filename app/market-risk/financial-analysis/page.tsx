'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Download, Filter, Upload, FileText, Edit2 } from 'lucide-react'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const CURRENCIES = [
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'AED' },
  { code: 'UZS', name: 'Узбекский сум', symbol: 'UZS' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'TJS', name: 'Таджикский сомони', symbol: 'TJS' },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺' },
]

interface FinAnalysis {
  id: string; code: string; analyst_name: string
  p1_label: string; p2_label: string
  currency: string; p1_usd_rate: number; p2_usd_rate: number
  // Legacy fields kept for display of old records
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
  p1_net_profit: number; p2_net_profit: number
  // Extended P&L columns stored in DB
  p1_interest_income?: number; p2_interest_income?: number
  p1_interest_expense?: number; p2_interest_expense?: number
  p1_fee_income?: number; p2_fee_income?: number
  p1_fx_income?: number; p2_fx_income?: number
  p1_other_income?: number; p2_other_income?: number
  p1_operating_expense?: number; p2_operating_expense?: number
  p1_provisions?: number; p2_provisions?: number
  counterparty_type: string; ai_conclusion: string; created_at: string
}

// IFRS EMPTY state — all new MFSO fields
const EMPTY: Record<string, string> = {
  code: '', analyst_name: '', p1_label: '', p2_label: '',
  counterparty_type: 'Банк', currency: 'USD', p1_usd_rate: '1', p2_usd_rate: '1',
  // ASSETS
  p1_cash_cb: '', p2_cash_cb: '',
  p1_restricted: '', p2_restricted: '',    // Средства с ограниченным доступом (обяз. резервы НБТ)
  p1_due_banks: '', p2_due_banks: '',
  p1_fvtpl: '', p2_fvtpl: '',
  p1_fvoci: '', p2_fvoci: '',
  p1_inv_ac: '', p2_inv_ac: '',
  p1_gross_loans: '', p2_gross_loans: '',
  p1_ecl_reserve: '', p2_ecl_reserve: '',
  p1_ppe: '', p2_ppe: '',
  p1_intangibles: '', p2_intangibles: '',
  p1_rou: '', p2_rou: '',
  p1_assets_held_sale: '', p2_assets_held_sale: '', // Долгосрочные активы для продажи
  p1_other_assets: '', p2_other_assets: '',
  // LIABILITIES
  p1_due_cb: '', p2_due_cb: '',
  p1_ibl: '', p2_ibl: '',
  p1_cust_dep: '', p2_cust_dep: '',
  p1_debt_issued: '', p2_debt_issued: '',
  p1_subord: '', p2_subord: '',
  p1_lease_liab: '', p2_lease_liab: '',
  p1_other_liab: '', p2_other_liab: '',
  // EQUITY
  p1_share_cap: '', p2_share_cap: '',
  p1_retained: '', p2_retained: '',
  p1_oci_eq: '', p2_oci_eq: '',
  // P&L
  p1_int_income: '', p2_int_income: '',
  p1_int_expense: '', p2_int_expense: '',
  p1_fee_income: '', p2_fee_income: '',
  p1_fee_expense: '', p2_fee_expense: '',
  p1_trading: '', p2_trading: '',
  p1_fx_income: '', p2_fx_income: '',
  p1_other_income: '', p2_other_income: '',
  p1_other_expense: '', p2_other_expense: '', // Прочие расходы (отдельная строка)
  p1_ecl_charge: '', p2_ecl_charge: '',
  p1_personnel: '', p2_personnel: '',
  p1_depreciation: '', p2_depreciation: '',
  p1_admin: '', p2_admin: '',
  p1_tax: '', p2_tax: '',
  p1_oci: '', p2_oci: '',
}

const fmtDisp = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
const fmtN = (v: string) => { const n = v.replace(/\D/g, ''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g, '')) || 0

// ── Input row component ──────────────────────────────────────────────────────
interface FRProps {
  label: string; f1: string; f2: string
  form: Record<string, string>; setF: (k: string, v: string) => void
  bold?: boolean; auto?: boolean; v1?: number; v2?: number
  indent?: boolean; deduction?: boolean; highlight?: 'green' | 'blue' | 'amber'
  p1rate?: number; p2rate?: number; currSymbol?: string; notUSD?: boolean
}
function FR({ label, f1, f2, bold, auto, v1, v2, indent, deduction, highlight,
  form, setF, p1rate = 1, p2rate = 1, currSymbol = '$', notUSD = false }: FRProps) {
  const cls = "w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] text-right bg-white"
  const shouldConvert = notUSD && p1rate > 0
  const toUSD1 = (v: number) => shouldConvert ? v / p1rate : v
  const toUSD2 = (v: number) => (notUSD && p2rate > 0) ? v / p2rate : v

  const bgClass = highlight === 'green' ? 'bg-[#1B8A4C]/8' : highlight === 'blue' ? 'bg-blue-50' : highlight === 'amber' ? 'bg-amber-50' : bold ? 'bg-gray-50' : 'hover:bg-blue-50/20'
  const valColor = deduction ? 'text-red-600' : (v1 !== undefined && v1 < 0) || (v2 !== undefined && v2 < 0) ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'

  return (
    <tr className={bgClass}>
      <td className={`px-3 py-1.5 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'} ${indent ? 'pl-7' : ''}`}>{label}</td>
      <td className="px-2 py-1">
        {auto
          ? <div className="space-y-0.5">
              <div className={`text-sm font-bold text-right pr-2 ${valColor}`}>{deduction && (v1||0) > 0 ? `(${fmtN(String(v1||0))})` : fmtN(String(v1||0))}</div>
              {shouldConvert && (v1||0) > 0 && <div className="text-xs text-gray-400 text-right pr-2">≈ ${fmtDisp(toUSD1(v1||0))}</div>}
            </div>
          : <div className="space-y-0.5">
              <input type="text" inputMode="numeric" value={form[f1] || ''} onChange={e => setF(f1, fmtN(e.target.value))} className={cls} placeholder="0" />
              {shouldConvert && parseN(form[f1]) > 0 && <div className="text-xs text-gray-400 text-right">≈ ${fmtDisp(toUSD1(parseN(form[f1])))}</div>}
            </div>}
      </td>
      <td className="px-2 py-1">
        {auto
          ? <div className="space-y-0.5">
              <div className={`text-sm font-bold text-right pr-2 ${valColor}`}>{deduction && (v2||0) > 0 ? `(${fmtN(String(v2||0))})` : fmtN(String(v2||0))}</div>
              {(notUSD && p2rate > 0) && (v2||0) > 0 && <div className="text-xs text-gray-400 text-right pr-2">≈ ${fmtDisp(toUSD2(v2||0))}</div>}
            </div>
          : <div className="space-y-0.5">
              <input type="text" inputMode="numeric" value={form[f2] || ''} onChange={e => setF(f2, fmtN(e.target.value))} className={cls} placeholder="0" />
              {(notUSD && p2rate > 0) && parseN(form[f2]) > 0 && <div className="text-xs text-gray-400 text-right">≈ ${fmtDisp(toUSD2(parseN(form[f2])))}</div>}
            </div>}
      </td>
    </tr>
  )
}

// ── Section divider row ──────────────────────────────────────────────────────
function SectionRow({ title }: { title: string }) {
  return (
    <tr className="bg-[#1B8A4C]/10">
      <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-[#1B8A4C] uppercase tracking-wide">{title}</td>
    </tr>
  )
}

// ── Table wrapper ────────────────────────────────────────────────────────────
function FT({ title, p1, p2, currency, children }: { title: string; p1: string; p2: string; currency: string; children: React.ReactNode }) {
  const curr = CURRENCIES.find(c => c.code === currency)
  const sym = curr?.symbol || currency
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#1B8A4C] text-white">
            <th className="text-left px-3 py-2 text-xs font-medium w-[52%]">Статья (тыс. {sym})</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-[24%]">{p1 || 'Период 1'}</th>
            <th className="text-center px-3 py-2 text-xs font-medium w-[24%]">{p2 || 'Период 2'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

// ── Ratio badge ──────────────────────────────────────────────────────────────
function RatioBadge({ label, p1v, p2v, norm, good, warn, invert = false }: { label: string; p1v: number; p2v: number; norm: string; good: number; warn: number; invert?: boolean }) {
  const isGood = invert ? p2v <= good : p2v >= good
  const isWarn = invert ? p2v <= warn : p2v >= warn
  const color = isGood ? 'text-green-600 bg-green-50' : isWarn ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  const border = isGood ? 'border-green-200' : isWarn ? 'border-amber-200' : 'border-red-200'
  return (
    <div className={`p-3 rounded-lg border ${border} ${color.split(' ')[1]}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color.split(' ')[0]}`}>{p1v.toFixed(1)}% → {p2v.toFixed(1)}%</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{norm}</p>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<string | null>(null)
  const [extractWarn, setExtractWarn] = useState<string[]>([])
  const [sameRate, setSameRate] = useState(false)
  const [fetchingRate, setFetchingRate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function fetchRate() {
    if (form.currency === 'USD') return
    setFetchingRate(true)
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/USD`)
      const json = await res.json()
      const rate = json?.rates?.[form.currency]
      if (rate) {
        const rateStr = rate.toFixed(4)
        setF('p1_usd_rate', rateStr)
        if (sameRate) setF('p2_usd_rate', rateStr)
      }
    } catch { /* silently fail */ }
    setFetchingRate(false)
  }

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
  const p2_rate = sameRate ? p1_rate : (Number(form.p2_usd_rate) || p1_rate)
  const isUSD = form.currency === 'USD'
  const toUSD1 = (v: number) => isUSD ? v : v / p1_rate
  const toUSD2 = (v: number) => isUSD ? v : v / p2_rate
  const currSymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol || '$'
  const p1lbl = form.p1_label || 'Период 1'
  const p2lbl = form.p2_label || 'Период 2'

  // ── COMPUTED BALANCE ────────────────────────────────────────────────────────
  const p1_net_loans = n('p1_gross_loans') - n('p1_ecl_reserve')
  const p2_net_loans = n('p2_gross_loans') - n('p2_ecl_reserve')
  const p1_total_sec = n('p1_fvtpl') + n('p1_fvoci') + n('p1_inv_ac')
  const p2_total_sec = n('p2_fvtpl') + n('p2_fvoci') + n('p2_inv_ac')

  const p1_total_assets = n('p1_cash_cb') + n('p1_restricted') + n('p1_due_banks') + p1_total_sec + p1_net_loans + n('p1_ppe') + n('p1_intangibles') + n('p1_rou') + n('p1_assets_held_sale') + n('p1_other_assets')
  const p2_total_assets = n('p2_cash_cb') + n('p2_restricted') + n('p2_due_banks') + p2_total_sec + p2_net_loans + n('p2_ppe') + n('p2_intangibles') + n('p2_rou') + n('p2_assets_held_sale') + n('p2_other_assets')

  const p1_total_liab = n('p1_due_cb') + n('p1_ibl') + n('p1_cust_dep') + n('p1_debt_issued') + n('p1_subord') + n('p1_lease_liab') + n('p1_other_liab')
  const p2_total_liab = n('p2_due_cb') + n('p2_ibl') + n('p2_cust_dep') + n('p2_debt_issued') + n('p2_subord') + n('p2_lease_liab') + n('p2_other_liab')

  const p1_equity = n('p1_share_cap') + n('p1_retained') + n('p1_oci_eq')
  const p2_equity = n('p2_share_cap') + n('p2_retained') + n('p2_oci_eq')
  const p1_total_passiv = p1_total_liab + p1_equity
  const p2_total_passiv = p2_total_liab + p2_equity

  // ── COMPUTED P&L ────────────────────────────────────────────────────────────
  const p1_nim = n('p1_int_income') - n('p1_int_expense')
  const p2_nim = n('p2_int_income') - n('p2_int_expense')
  const p1_net_fee = n('p1_fee_income') - n('p1_fee_expense')
  const p2_net_fee = n('p2_fee_income') - n('p2_fee_expense')
  const p1_op_income = p1_nim + p1_net_fee + n('p1_trading') + n('p1_fx_income') + n('p1_other_income')
  const p2_op_income = p2_nim + p2_net_fee + n('p2_trading') + n('p2_fx_income') + n('p2_other_income')
  const p1_after_ecl = p1_op_income - n('p1_ecl_charge')
  const p2_after_ecl = p2_op_income - n('p2_ecl_charge')
  const p1_total_opex = n('p1_personnel') + n('p1_depreciation') + n('p1_admin') + n('p1_other_expense')
  const p2_total_opex = n('p2_personnel') + n('p2_depreciation') + n('p2_admin') + n('p2_other_expense')
  const p1_pbt = p1_after_ecl - p1_total_opex
  const p2_pbt = p2_after_ecl - p2_total_opex
  const p1_net_profit = p1_pbt - n('p1_tax')
  const p2_net_profit = p2_pbt - n('p2_tax')
  const p1_total_ci = p1_net_profit + n('p1_oci')
  const p2_total_ci = p2_net_profit + n('p2_oci')

  // ── RATIOS (in USD) ─────────────────────────────────────────────────────────
  const p1a_usd = toUSD1(p1_total_assets), p2a_usd = toUSD2(p2_total_assets)
  const p1l_usd = toUSD1(p1_total_liab), p2l_usd = toUSD2(p2_total_liab)
  const p1e_usd = toUSD1(p1_equity), p2e_usd = toUSD2(p2_equity)
  const p1np_usd = toUSD1(p1_net_profit), p2np_usd = toUSD2(p2_net_profit)
  const p1nim_usd = toUSD1(p1_nim), p2nim_usd = toUSD2(p2_nim)

  const div = (a: number, b: number) => b !== 0 ? a / b : 0
  const p1_car = div(p1e_usd, p1a_usd) * 100
  const p2_car = div(p2e_usd, p2a_usd) * 100
  const p1_roe = div(p1np_usd, p1e_usd) * 100
  const p2_roe = div(p2np_usd, p2e_usd) * 100
  const p1_roa = div(p1np_usd, p1a_usd) * 100
  const p2_roa = div(p2np_usd, p2a_usd) * 100
  const p1_nim_pct = div(p1nim_usd, p1a_usd) * 100
  const p2_nim_pct = div(p2nim_usd, p2a_usd) * 100
  // Liquidity = (Cash + Due from banks + FVTPL + FVOCI) / Total liabilities
  const p1_liq_assets = toUSD1(n('p1_cash_cb') + n('p1_due_banks') + n('p1_fvtpl') + n('p1_fvoci'))
  const p2_liq_assets = toUSD2(n('p2_cash_cb') + n('p2_due_banks') + n('p2_fvtpl') + n('p2_fvoci'))
  const p1_liquidity = div(p1_liq_assets, p1l_usd) * 100
  const p2_liquidity = div(p2_liq_assets, p2l_usd) * 100
  // NPL proxy = ECL reserve / Gross loans
  const p1_npl = div(toUSD1(n('p1_ecl_reserve')), toUSD1(n('p1_gross_loans'))) * 100
  const p2_npl = div(toUSD2(n('p2_ecl_reserve')), toUSD2(n('p2_gross_loans'))) * 100
  // Cost-to-income = Total opex / Total op income
  const p1_cir = div(toUSD1(p1_total_opex), toUSD1(p1_op_income)) * 100
  const p2_cir = div(toUSD2(p2_total_opex), toUSD2(p2_op_income)) * 100

  // ── EXTRACT ─────────────────────────────────────────────────────────────────
  async function handleExtract() {
    if (imageFiles.length === 0) return
    setExtracting(true); setExtractMsg(null); setExtractWarn([])
    try {
      const STR_KEYS = ['p1_label', 'p2_label']
      const merged: Record<string, string> = {}
      const mergedRaw: Record<string, number> = {}

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve((e.target?.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const res = await apiFetch('/api/extract-from-image', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type, module: 'financial' }),
        })
        const data = await res.json()
        if (data.error) throw new Error(`Файл ${i + 1}: ${data.error}`)

        for (const [k, v] of Object.entries(data.data)) {
          if (v !== null && v !== undefined && v !== 0) {
            merged[k] = STR_KEYS.includes(k) ? String(v) : fmtN(String(Math.round(Number(v))))
            mergedRaw[k] = Number(v)
          }
        }
      }

      setForm(prev => ({ ...prev, ...merged }))

      const d = mergedRaw
      const warnings: string[] = []
      if (!((d.p1_cash_cb || 0) + (d.p1_due_banks || 0) > 0)) warnings.push('активы: деньги и МБК')
      if (!((d.p1_cust_dep || 0) + (d.p1_ibl || 0) > 0)) warnings.push('обязательства: депозиты и МБК')
      if (!((d.p1_share_cap || 0) + (d.p1_retained || 0) > 0)) warnings.push('капитал')
      if (!((d.p1_int_income || 0) + (d.p1_net_profit || 0) > 0)) warnings.push('доходы: процентные доходы')
      if (!((d.p2_cash_cb || 0) + (d.p2_cust_dep || 0) > 0)) warnings.push('данные второго периода (П2)')
      setExtractWarn(warnings)
      setInputMode('manual')
      setImageFiles([])
      setExtractMsg(warnings.length === 0
        ? `Данные МСФО извлечены из ${imageFiles.length > 1 ? `${imageFiles.length} файлов` : 'файла'}. Проверьте и при необходимости исправьте.`
        : `Данные частично извлечены из ${imageFiles.length > 1 ? `${imageFiles.length} файлов` : 'файла'}. Не найдено: проверьте вручную.`)
    } catch (err: unknown) {
      setExtractMsg('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setExtracting(false) }
  }

  // ── GENERATE ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!form.code.trim()) { setError('Введите код контрагента'); return }
    if (!isUSD) {
      if (!Number(form.p1_usd_rate)) { setError(`Введите курс П1: 1 USD = ? ${form.currency}`); setTab(1); return }
      if (!sameRate && !Number(form.p2_usd_rate)) { setError(`Введите курс П2: 1 USD = ? ${form.currency}`); setTab(1); return }
    }
    setGenerating(true); setError(null)
    try {
      const res = await apiFetch('/api/market-risk/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code, counterparty_type: form.counterparty_type || 'Банк',
          p1_label: p1lbl, p2_label: p2lbl,
          currency: form.currency, p1_usd_rate: p1_rate, p2_usd_rate: p2_rate,
          // Balance (in USD)
          p1_total_assets: p1a_usd, p2_total_assets: p2a_usd,
          p1_total_liab: p1l_usd, p2_total_liab: p2l_usd,
          p1_equity: p1e_usd, p2_equity: p2e_usd,
          // Liquid assets breakdown
          p1_cash_cb: toUSD1(n('p1_cash_cb')), p2_cash_cb: toUSD2(n('p2_cash_cb')),
          p1_restricted: toUSD1(n('p1_restricted')), p2_restricted: toUSD2(n('p2_restricted')),
          p1_due_banks: toUSD1(n('p1_due_banks')), p2_due_banks: toUSD2(n('p2_due_banks')),
          p1_fvtpl: toUSD1(n('p1_fvtpl')), p2_fvtpl: toUSD2(n('p2_fvtpl')),
          p1_fvoci: toUSD1(n('p1_fvoci')), p2_fvoci: toUSD2(n('p2_fvoci')),
          p1_inv_ac: toUSD1(n('p1_inv_ac')), p2_inv_ac: toUSD2(n('p2_inv_ac')),
          p1_gross_loans: toUSD1(n('p1_gross_loans')), p2_gross_loans: toUSD2(n('p2_gross_loans')),
          p1_ecl_reserve: toUSD1(n('p1_ecl_reserve')), p2_ecl_reserve: toUSD2(n('p2_ecl_reserve')),
          p1_net_loans: toUSD1(p1_net_loans), p2_net_loans: toUSD2(p2_net_loans),
          p1_cust_dep: toUSD1(n('p1_cust_dep')), p2_cust_dep: toUSD2(n('p2_cust_dep')),
          // P&L (in USD)
          p1_nim: toUSD1(p1_nim), p2_nim: toUSD2(p2_nim),
          p1_net_fee: toUSD1(p1_net_fee), p2_net_fee: toUSD2(p2_net_fee),
          p1_trading: toUSD1(n('p1_trading')), p2_trading: toUSD2(n('p2_trading')),
          p1_fx_income: toUSD1(n('p1_fx_income')), p2_fx_income: toUSD2(n('p2_fx_income')),
          p1_op_income: toUSD1(p1_op_income), p2_op_income: toUSD2(p2_op_income),
          p1_ecl_charge: toUSD1(n('p1_ecl_charge')), p2_ecl_charge: toUSD2(n('p2_ecl_charge')),
          p1_personnel: toUSD1(n('p1_personnel')), p2_personnel: toUSD2(n('p2_personnel')),
          p1_total_opex: toUSD1(p1_total_opex), p2_total_opex: toUSD2(p2_total_opex),
          p1_net_profit: p1np_usd, p2_net_profit: p2np_usd,
          // Pre-computed ratios
          p1_car: Math.round(p1_car * 10) / 10, p2_car: Math.round(p2_car * 10) / 10,
          p1_roe: Math.round(p1_roe * 10) / 10, p2_roe: Math.round(p2_roe * 10) / 10,
          p1_roa: Math.round(p1_roa * 10) / 10, p2_roa: Math.round(p2_roa * 10) / 10,
          p1_nim_pct: Math.round(p1_nim_pct * 10) / 10, p2_nim_pct: Math.round(p2_nim_pct * 10) / 10,
          p1_liquidity: Math.round(p1_liquidity * 10) / 10, p2_liquidity: Math.round(p2_liquidity * 10) / 10,
          p1_npl: Math.round(p1_npl * 10) / 10, p2_npl: Math.round(p2_npl * 10) / 10,
          p1_cir: Math.round(p1_cir * 10) / 10, p2_cir: Math.round(p2_cir * 10) / 10,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Map IFRS form fields to DB schema columns (aggregated legacy)
      const dbRow = {
        code: form.code, analyst_name: form.analyst_name,
        counterparty_type: form.counterparty_type || 'Банк',
        p1_label: p1lbl, p2_label: p2lbl,
        currency: form.currency, p1_usd_rate: p1_rate, p2_usd_rate: p2_rate,
        p1_cash: parseN(form.p1_cash_cb || ''), p2_cash: parseN(form.p2_cash_cb || ''),
        p1_receivables: n('p1_restricted') + n('p1_due_banks'), p2_receivables: n('p2_restricted') + n('p2_due_banks'),
        p1_investments: n('p1_fvtpl') + n('p1_fvoci') + n('p1_inv_ac'),
        p2_investments: n('p2_fvtpl') + n('p2_fvoci') + n('p2_inv_ac'),
        p1_loans_issued: p1_net_loans, p2_loans_issued: p2_net_loans,
        p1_fixed_assets: n('p1_ppe') + n('p1_intangibles') + n('p1_rou'),
        p2_fixed_assets: n('p2_ppe') + n('p2_intangibles') + n('p2_rou'),
        p1_other_assets: n('p1_assets_held_sale') + n('p1_other_assets'), p2_other_assets: n('p2_assets_held_sale') + n('p2_other_assets'),
        p1_deposits: n('p1_cust_dep'), p2_deposits: n('p2_cust_dep'),
        p1_borrowings: n('p1_due_cb') + n('p1_ibl') + n('p1_debt_issued') + n('p1_subord') + n('p1_lease_liab'),
        p2_borrowings: n('p2_due_cb') + n('p2_ibl') + n('p2_debt_issued') + n('p2_subord') + n('p2_lease_liab'),
        p1_other_liab: n('p1_other_liab'), p2_other_liab: n('p2_other_liab'),
        p1_equity: p1_equity, p2_equity: p2_equity,
        p1_interest_income: n('p1_int_income'), p2_interest_income: n('p2_int_income'),
        p1_interest_expense: n('p1_int_expense'), p2_interest_expense: n('p2_int_expense'),
        p1_fee_income: n('p1_fee_income'), p2_fee_income: n('p2_fee_income'),
        p1_fx_income: n('p1_trading') + n('p1_fx_income'), p2_fx_income: n('p2_trading') + n('p2_fx_income'),
        p1_other_income: n('p1_other_income'), p2_other_income: n('p2_other_income'),
        p1_operating_expense: p1_total_opex, p2_operating_expense: p2_total_opex,
        p1_provisions: n('p1_ecl_charge'), p2_provisions: n('p2_ecl_charge'),
        p1_net_profit: p1_net_profit, p2_net_profit: p2_net_profit,
        ai_conclusion: data.conclusion,
      }

      if (editingId) {
        const { error: dbErr } = await supabase.from('counterparty_financials').update(dbRow).eq('id', editingId)
        if (dbErr) throw new Error(dbErr.message)
      } else {
        const { error: dbErr } = await supabase.from('counterparty_financials').insert(dbRow)
        if (dbErr) throw new Error(dbErr.message)
        await supabase.from('counterparties').upsert({ code: form.code, updated_at: new Date().toISOString() }, { onConflict: 'code', ignoreDuplicates: true })
      }
      closeModal()
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
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
      link.href = url; link.download = 'FinAnalysis_IFRS.docx'; link.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('counterparty_financials').delete().eq('id', id)
    fetch_()
  }

  function closeModal() {
    setShowModal(false)
    setForm(EMPTY)
    setTab(1)
    setInputMode('manual')
    setImageFiles([])
    setExtractMsg(null)
    setExtractWarn([])
    setError(null)
    setEditingId(null)
  }

  function handleEdit(a: FinAnalysis) {
    const s = (v: number | null | undefined) => (v != null && v !== 0) ? String(Math.round(v)) : ''
    setForm({
      code: a.code || '',
      analyst_name: a.analyst_name || '',
      counterparty_type: a.counterparty_type || 'Банк',
      p1_label: a.p1_label || '',
      p2_label: a.p2_label || '',
      currency: a.currency || 'USD',
      p1_usd_rate: a.p1_usd_rate ? String(a.p1_usd_rate) : '1',
      p2_usd_rate: a.p2_usd_rate ? String(a.p2_usd_rate) : '1',
      // Активы — маппинг из агрегированных DB колонок в МСФО поля
      p1_cash_cb: s(a.p1_cash), p2_cash_cb: s(a.p2_cash),
      p1_restricted: '', p2_restricted: '',
      p1_due_banks: s(a.p1_receivables), p2_due_banks: s(a.p2_receivables),
      p1_fvtpl: s(a.p1_investments), p2_fvtpl: s(a.p2_investments),
      p1_fvoci: '', p2_fvoci: '',
      p1_inv_ac: '', p2_inv_ac: '',
      p1_gross_loans: s(a.p1_loans_issued), p2_gross_loans: s(a.p2_loans_issued),
      p1_ecl_reserve: '', p2_ecl_reserve: '',
      p1_ppe: s(a.p1_fixed_assets), p2_ppe: s(a.p2_fixed_assets),
      p1_intangibles: '', p2_intangibles: '',
      p1_rou: '', p2_rou: '',
      p1_assets_held_sale: '', p2_assets_held_sale: '',
      p1_other_assets: s(a.p1_other_assets), p2_other_assets: s(a.p2_other_assets),
      // Пассивы
      p1_due_cb: '', p2_due_cb: '',
      p1_ibl: s(a.p1_borrowings), p2_ibl: s(a.p2_borrowings),
      p1_cust_dep: s(a.p1_deposits), p2_cust_dep: s(a.p2_deposits),
      p1_debt_issued: '', p2_debt_issued: '',
      p1_subord: '', p2_subord: '',
      p1_lease_liab: '', p2_lease_liab: '',
      p1_other_liab: s(a.p1_other_liab), p2_other_liab: s(a.p2_other_liab),
      // Капитал
      p1_share_cap: s(a.p1_equity), p2_share_cap: s(a.p2_equity),
      p1_retained: '', p2_retained: '',
      p1_oci_eq: '', p2_oci_eq: '',
      // ОПУ
      p1_int_income: s(a.p1_interest_income), p2_int_income: s(a.p2_interest_income),
      p1_int_expense: s(a.p1_interest_expense), p2_int_expense: s(a.p2_interest_expense),
      p1_fee_income: s(a.p1_fee_income), p2_fee_income: s(a.p2_fee_income),
      p1_fee_expense: '', p2_fee_expense: '',
      p1_trading: '', p2_trading: '',
      p1_fx_income: s(a.p1_fx_income), p2_fx_income: s(a.p2_fx_income),
      p1_other_income: s(a.p1_other_income), p2_other_income: s(a.p2_other_income),
      p1_other_expense: '', p2_other_expense: '',
      p1_ecl_charge: s(a.p1_provisions), p2_ecl_charge: s(a.p2_provisions),
      p1_personnel: s(a.p1_operating_expense), p2_personnel: s(a.p2_operating_expense),
      p1_depreciation: '', p2_depreciation: '',
      p1_admin: '', p2_admin: '',
      p1_tax: '', p2_tax: '',
      p1_oci: '', p2_oci: '',
    })
    setSameRate(a.p1_usd_rate === a.p2_usd_rate)
    setEditingId(a.id)
    setTab(1)
    setInputMode('manual')
    setImageFiles([])
    setExtractMsg(null)
    setExtractWarn([])
    setError(null)
    setShowModal(true)
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"
  const frProps = { form, setF, p1rate: p1_rate, p2rate: p2_rate, currSymbol, notUSD: !isUSD }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Финансовый анализ контрагента — МСФО</h1>
          <p className="text-sm text-gray-500 mt-0.5">Анализ аудированной МСФО-отчётности банков и финансовых организаций</p>
        </div>
        <button onClick={() => { closeModal(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый анализ
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все годы</option>
          {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все месяцы</option>
          {MONTHS.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        {(filterYear || filterMonth) && (
          <button onClick={() => { setFilterYear(''); setFilterMonth('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Сбросить</button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Контрагент','Тип','Аналитик','Периоды','Активы П2 ($)','CAR','ROE','Ликвидность','Дата',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              : analyses.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Нет анализов</td></tr>
              : analyses.map(a => {
                const r2 = a.p2_usd_rate || 1
                const toUsd2 = (v: number) => a.currency === 'USD' ? v : v / r2
                const p2assets = (a.p2_cash||0)+(a.p2_receivables||0)+(a.p2_investments||0)+(a.p2_loans_issued||0)+(a.p2_fixed_assets||0)+(a.p2_other_assets||0)
                const p2a_u = toUsd2(p2assets)
                const p2e_u = toUsd2(a.p2_equity||0)
                const p2l_u = toUsd2((a.p2_deposits||0)+(a.p2_borrowings||0)+(a.p2_other_liab||0))
                const p2np_u = toUsd2(a.p2_net_profit||0)
                const car2 = p2a_u > 0 ? (p2e_u / p2a_u * 100).toFixed(1) : null
                const roe2 = p2e_u > 0 ? (p2np_u / p2e_u * 100).toFixed(1) : null
                const liq2 = p2l_u > 0 ? (toUsd2((a.p2_cash||0)+(a.p2_receivables||0)) / p2l_u * 100).toFixed(1) : null
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{a.code}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.counterparty_type || 'Банк'}</span></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.analyst_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.p1_label} → {a.p2_label}</td>
                    <td className="px-4 py-3 font-medium">{p2a_u > 0 ? `$${fmtDisp(p2a_u)}` : '—'}</td>
                    <td className="px-4 py-3 font-medium">{car2 ? <span className={Number(car2) >= 13 ? 'text-green-600' : 'text-red-600'}>{car2}%</span> : '—'}</td>
                    <td className="px-4 py-3 font-medium">{roe2 ? <span className={Number(roe2) >= 10 ? 'text-green-600' : 'text-amber-600'}>{roe2}%</span> : '—'}</td>
                    <td className="px-4 py-3 font-medium">{liq2 ? <span className={Number(liq2) >= 30 ? 'text-green-600' : 'text-red-600'}>{liq2}%</span> : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(a)} title="Изменить и перегенерировать" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
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
                <h2 className="text-lg font-semibold">{viewing.code} — МСФО Финансовый анализ</h2>
                {viewing.currency && viewing.currency !== 'USD' && (
                  <p className="text-xs text-gray-400 mt-0.5">Валюта: {viewing.currency} · П1: 1 USD={viewing.p1_usd_rate} · П2: 1 USD={viewing.p2_usd_rate}</p>
                )}
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Активы П1 ($тыс.)', `$${fmtDisp(viewing.currency !== 'USD' ? ((viewing.p1_cash||0)+(viewing.p1_receivables||0)+(viewing.p1_investments||0)+(viewing.p1_loans_issued||0)+(viewing.p1_fixed_assets||0)+(viewing.p1_other_assets||0))/(viewing.p1_usd_rate||1) : (viewing.p1_cash||0)+(viewing.p1_receivables||0)+(viewing.p1_investments||0)+(viewing.p1_loans_issued||0)+(viewing.p1_fixed_assets||0)+(viewing.p1_other_assets||0))}`],
                  ['Активы П2 ($тыс.)', `$${fmtDisp(viewing.currency !== 'USD' ? ((viewing.p2_cash||0)+(viewing.p2_receivables||0)+(viewing.p2_investments||0)+(viewing.p2_loans_issued||0)+(viewing.p2_fixed_assets||0)+(viewing.p2_other_assets||0))/(viewing.p2_usd_rate||1) : (viewing.p2_cash||0)+(viewing.p2_receivables||0)+(viewing.p2_investments||0)+(viewing.p2_loans_issued||0)+(viewing.p2_fixed_assets||0)+(viewing.p2_other_assets||0))}`],
                  ['Прибыль П1 ($тыс.)', `$${fmtDisp(viewing.currency !== 'USD' ? (viewing.p1_net_profit||0)/(viewing.p1_usd_rate||1) : (viewing.p1_net_profit||0))}`],
                  ['Прибыль П2 ($тыс.)', `$${fmtDisp(viewing.currency !== 'USD' ? (viewing.p2_net_profit||0)/(viewing.p2_usd_rate||1) : (viewing.p2_net_profit||0))}`],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {viewing.ai_conclusion && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI МСФО Анализ</p>
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
              <div>
                <h2 className="text-base font-semibold">
                  {editingId ? `Изменить анализ: ${form.code || ''}` : 'Финансовый анализ контрагента — МСФО'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editingId ? 'Скорректируйте данные и перегенерируйте AI анализ' : 'Стандарт: МСФО (IFRS 9, IFRS 16, IAS 1)'}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Mode switcher */}
            <div className="flex border-b border-gray-100 px-2 gap-0">
              <button onClick={() => { setInputMode('manual'); setExtractMsg(null) }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${inputMode === 'manual' ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <FileText className="w-3.5 h-3.5" /> Ввести вручную
              </button>
              <button onClick={() => { setInputMode('image'); setExtractMsg(null) }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${inputMode === 'image' ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Upload className="w-3.5 h-3.5" /> Скрин МСФО отчёта
              </button>
            </div>

            {/* Tabs — only in manual mode */}
            {inputMode === 'manual' && (
              <div className="flex border-b border-gray-100 px-2">
                {[{n:1,t:'Общее'},{n:2,t:'Активы'},{n:3,t:'Пассивы'},{n:4,t:'ОПУ / ОСД'}].map(({n:tn,t}) => (
                  <button key={tn} onClick={() => setTab(tn)}
                    className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${tab===tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tn}. {t}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5">

              {/* ─── Image/PDF upload ─── */}
              {inputMode === 'image' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-800 font-medium">📄 Загрузите скриншоты или PDF аудированной МСФО отчётности банка</p>
                    <p className="text-xs text-blue-700 mt-1">AI извлечёт данные из всех файлов и объединит · PNG, JPG, PDF · до 10 МБ каждый</p>
                  </div>
                  <label className="block cursor-pointer">
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${imageFiles.length > 0 ? 'border-[#1B8A4C] bg-green-50' : 'border-gray-200 hover:border-[#1B8A4C] hover:bg-gray-50'}`}>
                      {imageFiles.length > 0 ? (
                        <div className="space-y-3">
                          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                          <p className="text-sm font-medium text-gray-800">
                            {imageFiles.length === 1 ? imageFiles[0].name : `${imageFiles.length} файла выбрано`}
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {imageFiles.map((f, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-green-200 rounded-lg text-xs text-gray-600">
                                <FileText className="w-3 h-3 text-green-500" />
                                {f.name.length > 20 ? f.name.slice(0, 17) + '…' : f.name}
                                <span className="text-gray-400">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400">Нажмите чтобы изменить выбор</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                          <p className="text-sm font-medium text-gray-500">Нажмите или перетащите файлы</p>
                          <p className="text-xs text-gray-400">PNG, JPG, WEBP или PDF · до 10 МБ каждый · можно несколько</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="hidden"
                      onChange={e => { setImageFiles(Array.from(e.target.files || [])); setExtractMsg(null) }} />
                  </label>
                  {extractMsg && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600">{extractMsg}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Manual form ─── */}
              {inputMode === 'manual' && <>
                {extractMsg && (
                  <div className={`flex items-start gap-2 p-3 border rounded-lg mb-3 ${extractWarn.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'}`}>
                    {extractWarn.length > 0 ? <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className={`text-sm ${extractWarn.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{extractMsg}</p>
                      {extractWarn.length > 0 && <ul className="mt-1 space-y-0.5">{extractWarn.map(w => <li key={w} className="text-xs text-yellow-600">• Не найдено: {w}</li>)}</ul>}
                    </div>
                    <button onClick={() => { setExtractMsg(null); setExtractWarn([]) }}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
                  </div>
                )}
                {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-3"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}

                {/* TAB 1: General */}
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
                    <div><label className={lbl}>Период 1 (напр. 31.12.2024)</label><input type="text" value={form.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="31.12.2024" className={inp} /></div>
                    <div><label className={lbl}>Период 2 (напр. 31.12.2025)</label><input type="text" value={form.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="31.12.2025" className={inp} /></div>
                    <div>
                      <label className={lbl}>Валюта отчётности</label>
                      <select value={form.currency} onChange={e => {
                          const cur = e.target.value
                          setF('currency', cur)
                          if (cur === 'USD') { setF('p1_usd_rate', '1'); setF('p2_usd_rate', '1') }
                          else { setF('p1_usd_rate', ''); setF('p2_usd_rate', ''); setSameRate(false) }
                        }} className={inp}>
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className={lbl + ' mb-0'}>{form.currency === 'USD' ? 'Курс (USD — основная валюта)' : `Курс: 1 USD = ? ${form.currency}`}</label>
                        <div className="flex items-center gap-3">
                          {form.currency !== 'USD' && (
                            <button type="button" onClick={fetchRate} disabled={fetchingRate}
                              className="text-xs text-[#1B8A4C] hover:text-[#177040] font-medium flex items-center gap-1 disabled:opacity-50">
                              {fetchingRate ? <><Loader2 className="w-3 h-3 animate-spin" /> Загрузка...</> : '↻ Текущий курс'}
                            </button>
                          )}
                          {form.currency !== 'USD' && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={sameRate} onChange={e => { setSameRate(e.target.checked); if (e.target.checked) setF('p2_usd_rate', form.p1_usd_rate) }} className="rounded" />
                              <span className="text-xs text-gray-500">Одинаковый для П1 и П2</span>
                            </label>
                          )}
                        </div>
                      </div>
                      <div className={`grid gap-3 ${sameRate || form.currency === 'USD' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <div>
                          {!sameRate && form.currency !== 'USD' && <p className="text-xs text-gray-400 mb-1">Период 1</p>}
                          <input type="text" inputMode="decimal" value={form.p1_usd_rate}
                            onChange={e => { const v = e.target.value.replace(',', '.'); setF('p1_usd_rate', v); if (sameRate) setF('p2_usd_rate', v) }}
                            disabled={form.currency === 'USD'} placeholder={form.currency === 'USD' ? '1' : 'Напр. 10.92'}
                            className={`${inp} ${form.currency === 'USD' ? 'bg-gray-50 text-gray-400' : !form.p1_usd_rate || !Number(form.p1_usd_rate) ? 'border-red-300 focus:ring-red-400' : ''}`} />
                        </div>
                        {!sameRate && form.currency !== 'USD' && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Период 2</p>
                            <input type="text" inputMode="decimal" value={form.p2_usd_rate} onChange={e => setF('p2_usd_rate', e.target.value.replace(',', '.'))} placeholder="Напр. 10.85"
                              className={`${inp} ${!form.p2_usd_rate || !Number(form.p2_usd_rate) ? 'border-red-300 focus:ring-red-400' : ''}`} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs text-blue-800">💡 Вводите суммы в <strong>тысячах</strong> {form.currency}. Стандарт МСФО — IFRS 9 (фин. инструменты), IFRS 16 (аренда), IAS 1.</p>
                    </div>
                  </div>
                )}

                {/* TAB 2: Assets */}
                {tab === 2 && (
                  <FT title="ОТЧЁТ О ФИНАНСОВОМ ПОЛОЖЕНИИ — АКТИВЫ (МСФО IAS 1 / IFRS 9 / IFRS 16)" p1={p1lbl} p2={p2lbl} currency={form.currency}>
                    <SectionRow title="Денежные средства и эквиваленты" />
                    <FR label="Денежные средства и их эквиваленты" f1="p1_cash_cb" f2="p2_cash_cb" {...frProps} />
                    <FR label="Средства с ограниченным доступом (обяз. резервы НБТ)" f1="p1_restricted" f2="p2_restricted" indent {...frProps} />
                    <FR label="Средства в банках (МБК размещённые / ностро)" f1="p1_due_banks" f2="p2_due_banks" {...frProps} />
                    <SectionRow title="Финансовые инструменты (IFRS 9)" />
                    <FR label="Фин. инструменты по СС через ОПУ (FVTPL)" f1="p1_fvtpl" f2="p2_fvtpl" indent {...frProps} />
                    <FR label="Фин. инструменты по СС через ПСД (FVOCI)" f1="p1_fvoci" f2="p2_fvoci" indent {...frProps} />
                    <FR label="Инвестиции по амортизир. стоимости / ГЦБ" f1="p1_inv_ac" f2="p2_inv_ac" indent {...frProps} />
                    <FR label="▶ Итого финансовые инструменты" bold auto v1={p1_total_sec} v2={p2_total_sec} f1="" f2="" {...frProps} />
                    <SectionRow title="Кредитный портфель (IFRS 9 — ECL)" />
                    <FR label="Кредиты клиентам, валовые" f1="p1_gross_loans" f2="p2_gross_loans" {...frProps} />
                    <FR label="Минус: резерв под ОКУ (ECL / РППУ)" f1="p1_ecl_reserve" f2="p2_ecl_reserve" indent deduction {...frProps} />
                    <FR label="▶ Кредиты клиентам, нетто" bold auto v1={p1_net_loans} v2={p2_net_loans} f1="" f2="" {...frProps} />
                    <SectionRow title="Долгосрочные активы" />
                    <FR label="Основные средства (здания, оборудование, ТС)" f1="p1_ppe" f2="p2_ppe" indent {...frProps} />
                    <FR label="Нематериальные активы (НМА, гудвил, ПО)" f1="p1_intangibles" f2="p2_intangibles" indent {...frProps} />
                    <FR label="Активы в форме права пользования (МСФО 16)" f1="p1_rou" f2="p2_rou" indent {...frProps} />
                    <FR label="Долгосрочные активы для продажи" f1="p1_assets_held_sale" f2="p2_assets_held_sale" indent {...frProps} />
                    <FR label="Прочие активы (налоги, дебиторы и др.)" f1="p1_other_assets" f2="p2_other_assets" {...frProps} />
                    <FR label="══ ИТОГО АКТИВЫ" bold auto v1={p1_total_assets} v2={p2_total_assets} f1="" f2="" highlight="green" {...frProps} />
                  </FT>
                )}

                {/* TAB 3: Liabilities & Equity */}
                {tab === 3 && (
                  <div className="space-y-3">
                    <FT title="ОБЯЗАТЕЛЬСТВА (МСФО IAS 1 / IFRS 16)" p1={p1lbl} p2={p2lbl} currency={form.currency}>
                      <SectionRow title="Привлечённые средства" />
                      <FR label="Обязательства перед ЦБ / НБТ" f1="p1_due_cb" f2="p2_due_cb" indent {...frProps} />
                      <FR label="Средства банков и финансовых организаций (МБК)" f1="p1_ibl" f2="p2_ibl" indent {...frProps} />
                      <FR label="Счета клиентов (депозиты физ. и юрлиц)" f1="p1_cust_dep" f2="p2_cust_dep" {...frProps} />
                      <SectionRow title="Займы и рыночные заимствования" />
                      <FR label="Займы к оплате / выпущенные облигации" f1="p1_debt_issued" f2="p2_debt_issued" indent {...frProps} />
                      <FR label="Субординированный долг" f1="p1_subord" f2="p2_subord" indent {...frProps} />
                      <FR label="Обязательства по аренде (МСФО 16)" f1="p1_lease_liab" f2="p2_lease_liab" indent {...frProps} />
                      <FR label="Прочие обязательства (кред. убытки по гарантиям и др.)" f1="p1_other_liab" f2="p2_other_liab" {...frProps} />
                      <FR label="══ ИТОГО ОБЯЗАТЕЛЬСТВА" bold auto v1={p1_total_liab} v2={p2_total_liab} f1="" f2="" highlight="blue" {...frProps} />
                    </FT>
                    <FT title="КАПИТАЛ (МСФО IAS 1)" p1={p1lbl} p2={p2lbl} currency={form.currency}>
                      <FR label="Акционерный капитал (уставный + эмиссионный доход)" f1="p1_share_cap" f2="p2_share_cap" {...frProps} />
                      <FR label="Нераспределённая прибыль" f1="p1_retained" f2="p2_retained" {...frProps} />
                      <FR label="Прочие резервы (переоценка ОС, ПСД, фонды)" f1="p1_oci_eq" f2="p2_oci_eq" {...frProps} />
                      <FR label="══ ИТОГО КАПИТАЛ" bold auto v1={p1_equity} v2={p2_equity} f1="" f2="" highlight="green" {...frProps} />
                      <FR label="══ ИТОГО ОБЯЗАТЕЛЬСТВА И КАПИТАЛ" bold auto v1={p1_total_passiv} v2={p2_total_passiv} f1="" f2="" highlight="green" {...frProps} />
                    </FT>
                    {/* Balance check */}
                    {(p1_total_assets > 0 || p2_total_assets > 0) && (
                      <div className="grid grid-cols-2 gap-3">
                        {p1_total_assets > 0 && (
                          <div className={`p-3 rounded-lg border text-xs font-medium ${Math.abs(p1_total_assets - p1_total_passiv) < 1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {p1lbl}: {Math.abs(p1_total_assets - p1_total_passiv) < 1 ? '✅ Баланс сходится (Активы = Пассивы)' : `⚠️ Разница: ${fmtN(String(Math.abs(p1_total_assets - p1_total_passiv)))} тыс. ${currSymbol}`}
                          </div>
                        )}
                        {p2_total_assets > 0 && (
                          <div className={`p-3 rounded-lg border text-xs font-medium ${Math.abs(p2_total_assets - p2_total_passiv) < 1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {p2lbl}: {Math.abs(p2_total_assets - p2_total_passiv) < 1 ? '✅ Баланс сходится (Активы = Пассивы)' : `⚠️ Разница: ${fmtN(String(Math.abs(p2_total_assets - p2_total_passiv)))} тыс. ${currSymbol}`}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Live ratios */}
                    {(p1_car > 0 || p2_car > 0) && (
                      <div className="grid grid-cols-4 gap-3">
                        <RatioBadge label="CAR (Кап./Активы)" p1v={p1_car} p2v={p2_car} norm="норма НБТ ≥13%" good={13} warn={10} />
                        <RatioBadge label="ROE (Приб./Капитал)" p1v={p1_roe} p2v={p2_roe} norm="норма ≥10%" good={10} warn={5} />
                        <RatioBadge label="Ликвидность" p1v={p1_liquidity} p2v={p2_liquidity} norm="норма НБТ ≥30%" good={30} warn={20} />
                        <RatioBadge label="NPL proxy (ОКУ/Кредиты)" p1v={p1_npl} p2v={p2_npl} norm="норма <5%" good={5} warn={10} invert />
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: P&L / OCI */}
                {tab === 4 && (
                  <FT title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ И ПРОЧЕМ СОВОКУПНОМ ДОХОДЕ (МСФО IAS 1 / IFRS 9)" p1={p1lbl} p2={p2lbl} currency={form.currency}>
                    <SectionRow title="Процентные доходы (метод ЭПС — IFRS 9)" />
                    <FR label="Процентные доходы (кредиты, размещения, инвестиции)" f1="p1_int_income" f2="p2_int_income" {...frProps} />
                    <FR label="Процентные расходы (депозиты, займы, аренда)" f1="p1_int_expense" f2="p2_int_expense" {...frProps} />
                    <FR label="▶ Чистый процентный доход" bold auto v1={p1_nim} v2={p2_nim} f1="" f2="" highlight="green" {...frProps} />
                    <SectionRow title="Формирование резервов (IFRS 9 — ECL)" />
                    <FR label="Формирование резерва под ОКУ (ECL / РППУ)" f1="p1_ecl_charge" f2="p2_ecl_charge" {...frProps} />
                    <FR label="▶ Чистый процентный доход после резервов" bold auto v1={p1_after_ecl} v2={p2_after_ecl} f1="" f2="" {...frProps} />
                    <SectionRow title="Непроцентные доходы" />
                    <FR label="Комиссионные доходы" f1="p1_fee_income" f2="p2_fee_income" indent {...frProps} />
                    <FR label="Комиссионные расходы" f1="p1_fee_expense" f2="p2_fee_expense" indent {...frProps} />
                    <FR label="▶ Чистый комиссионный доход" bold auto v1={p1_net_fee} v2={p2_net_fee} f1="" f2="" {...frProps} />
                    <FR label="Чистый доход от операций с иностр. валютой" f1="p1_fx_income" f2="p2_fx_income" indent {...frProps} />
                    <FR label="Торговый доход / изменение СС фин. инструментов" f1="p1_trading" f2="p2_trading" indent {...frProps} />
                    <FR label="Прочие доходы" f1="p1_other_income" f2="p2_other_income" indent {...frProps} />
                    <FR label="══ ИТОГО ОПЕРАЦИОННЫЙ ДОХОД" bold auto v1={p1_op_income} v2={p2_op_income} f1="" f2="" highlight="green" {...frProps} />
                    <SectionRow title="Операционные расходы" />
                    <FR label="Расходы на персонал (зарплата, бонусы, ФСЗН)" f1="p1_personnel" f2="p2_personnel" indent {...frProps} />
                    <FR label="Амортизация ОС, НМА и активов ПП (МСФО 16)" f1="p1_depreciation" f2="p2_depreciation" indent {...frProps} />
                    <FR label="Административные расходы (аренда, IT, связь)" f1="p1_admin" f2="p2_admin" indent {...frProps} />
                    <FR label="Прочие расходы" f1="p1_other_expense" f2="p2_other_expense" indent {...frProps} />
                    <FR label="▶ Итого операционные расходы" bold auto v1={p1_total_opex} v2={p2_total_opex} f1="" f2="" {...frProps} />
                    <FR label="▶ Прибыль до налогообложения" bold auto v1={p1_pbt} v2={p2_pbt} f1="" f2="" highlight="blue" {...frProps} />
                    <FR label="Расходы по налогу на прибыль" f1="p1_tax" f2="p2_tax" {...frProps} />
                    <FR label="══ ЧИСТАЯ ПРИБЫЛЬ" bold auto v1={p1_net_profit} v2={p2_net_profit} f1="" f2="" highlight="green" {...frProps} />
                    <SectionRow title="Прочий совокупный доход (ПСД)" />
                    <FR label="ПСД (переоценка ОС, FVOCI, курсовые разницы)" f1="p1_oci" f2="p2_oci" {...frProps} />
                    <FR label="══ ИТОГО СОВОКУПНЫЙ ДОХОД" bold auto v1={p1_total_ci} v2={p2_total_ci} f1="" f2="" highlight="green" {...frProps} />
                  </FT>
                )}
              </>}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              {inputMode === 'image' ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    <button onClick={handleExtract} disabled={imageFiles.length === 0 || extracting}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {extracting
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Извлечение МСФО...</>
                        : <><Upload className="w-4 h-4" /> Извлечь данные{imageFiles.length > 1 ? ` (${imageFiles.length})` : ''}</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
                  <div className="flex gap-2">
                    <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    {tab < 4
                      ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                      : <button onClick={handleGenerate} disabled={generating}
                          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> {editingId ? 'Перегенерировать' : 'Сгенерировать анализ'}</>}
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

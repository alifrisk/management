'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, FileText, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Filter, Upload, Edit2 } from 'lucide-react'

interface Collateral { type: string; description: string; value: number }

interface CreditConclusion {
  id: string
  conclusion_number: number
  conclusion_type: string
  borrower_name: string; borrower_inn: string; business_type: string
  years_in_business: number; loan_amount: number; loan_currency: string
  loan_term: string; loan_term_months: number; interest_rate: number
  loan_purpose: string; credit_history: string; analyst_name: string
  existing_loan_balance: number
  p1_label: string; p2_label: string
  // ОПУ — старые поля (обратная совместимость, могут быть null у новых записей)
  p1_revenue?: number; p1_cogs?: number; p1_gross_profit?: number
  p1_sales_expense?: number; p1_admin_expense?: number; p1_other_op_income?: number
  p1_non_op?: number; p1_tax?: number; p1_net_profit?: number
  p2_revenue?: number; p2_cogs?: number; p2_gross_profit?: number
  p2_sales_expense?: number; p2_admin_expense?: number; p2_other_op_income?: number
  p2_non_op?: number; p2_tax?: number; p2_net_profit?: number
  // Баланс — старые поля
  p1_cash?: number; p1_receivables?: number; p1_inventory?: number; p1_fixed_assets?: number; p1_other_assets?: number
  p1_supplier_debt?: number; p1_bank_debt?: number; p1_other_liabilities?: number
  p1_equity_capital?: number; p1_reserves?: number; p1_retained_earnings?: number
  p2_cash?: number; p2_receivables?: number; p2_inventory?: number; p2_fixed_assets?: number; p2_other_assets?: number
  p2_supplier_debt?: number; p2_bank_debt?: number; p2_other_liabilities?: number
  p2_equity_capital?: number; p2_reserves?: number; p2_retained_earnings?: number
  // ОДДС — старые поля
  p1_cash_begin?: number; p1_op_inflow?: number; p1_op_outflow?: number
  p1_fin_inflow?: number; p1_fin_outflow?: number; p1_inv_inflow?: number; p1_inv_outflow?: number; p1_cash_end?: number
  p2_cash_begin?: number; p2_op_inflow?: number; p2_op_outflow?: number
  p2_fin_inflow?: number; p2_fin_outflow?: number; p2_inv_inflow?: number; p2_inv_outflow?: number; p2_cash_end?: number
  // Баланс Форма №1 — новые поля МФ РТ
  p1_cash_desk?: number; p1_cash_bank?: number; p1_st_invest?: number; p1_trade_rec?: number; p1_other_rec?: number; p1_founder_rec?: number; p1_prepaid?: number; p1_nca_sale?: number
  p1_ppe?: number; p1_nat_res?: number; p1_intangibles?: number; p1_bio_assets?: number; p1_invest_prop?: number; p1_lt_invest?: number; p1_def_tax_asset?: number; p1_lt_rec?: number
  p1_trade_pay?: number; p1_st_debt?: number; p1_accrued?: number; p1_taxes_pay?: number; p1_exp_reserves?: number; p1_other_st_liab?: number
  p1_lt_debt?: number; p1_def_income?: number; p1_def_tax_liab?: number
  p1_charter_cap?: number; p1_add_cap?: number; p1_retained?: number; p1_reserve_cap?: number; p1_minority?: number
  p2_cash_desk?: number; p2_cash_bank?: number; p2_st_invest?: number; p2_trade_rec?: number; p2_other_rec?: number; p2_founder_rec?: number; p2_prepaid?: number; p2_nca_sale?: number
  p2_ppe?: number; p2_nat_res?: number; p2_intangibles?: number; p2_bio_assets?: number; p2_invest_prop?: number; p2_lt_invest?: number; p2_def_tax_asset?: number; p2_lt_rec?: number
  p2_trade_pay?: number; p2_st_debt?: number; p2_accrued?: number; p2_taxes_pay?: number; p2_exp_reserves?: number; p2_other_st_liab?: number
  p2_lt_debt?: number; p2_def_income?: number; p2_def_tax_liab?: number
  p2_charter_cap?: number; p2_add_cap?: number; p2_retained?: number; p2_reserve_cap?: number; p2_minority?: number
  // ОПУ Форма №2 — новые поля
  p1_net_rev?: number; p1_sell_exp?: number; p1_admin_exp?: number; p1_other_op?: number
  p1_interest_exp?: number; p1_invest_inc?: number; p1_fx_diff?: number; p1_currency_ex?: number; p1_asset_disp?: number; p1_impairment?: number; p1_other_nonop?: number; p1_assoc_profit?: number; p1_discont?: number
  p2_net_rev?: number; p2_sell_exp?: number; p2_admin_exp?: number; p2_other_op?: number
  p2_interest_exp?: number; p2_invest_inc?: number; p2_fx_diff?: number; p2_currency_ex?: number; p2_asset_disp?: number; p2_impairment?: number; p2_other_nonop?: number; p2_assoc_profit?: number; p2_discont?: number
  // ОДДС Форма №5 — новые поля
  p1_cf_sales?: number; p1_cf_other_op_in?: number; p1_cf_cogs_paid?: number; p1_cf_salary?: number; p1_cf_services?: number; p1_cf_interest?: number; p1_cf_income_tax?: number; p1_cf_other_taxes?: number; p1_cf_other_op_out?: number
  p1_cf_asset_sold?: number; p1_cf_intang_sold?: number; p1_cf_sec_sold?: number; p1_cf_loan_ret?: number; p1_cf_other_inv_in?: number; p1_cf_asset_buy?: number; p1_cf_intang_buy?: number; p1_cf_sec_buy?: number; p1_cf_loans_given?: number; p1_cf_other_inv_out?: number
  p1_cf_shares?: number; p1_cf_bonds?: number; p1_cf_founders?: number; p1_cf_loans_in?: number; p1_cf_other_fin_in?: number; p1_cf_dividends?: number; p1_cf_loans_out?: number; p1_cf_buyback?: number; p1_cf_other_fin_out?: number
  p1_cf_fx?: number; p1_cf_cash_begin?: number
  p2_cf_sales?: number; p2_cf_other_op_in?: number; p2_cf_cogs_paid?: number; p2_cf_salary?: number; p2_cf_services?: number; p2_cf_interest?: number; p2_cf_income_tax?: number; p2_cf_other_taxes?: number; p2_cf_other_op_out?: number
  p2_cf_asset_sold?: number; p2_cf_intang_sold?: number; p2_cf_sec_sold?: number; p2_cf_loan_ret?: number; p2_cf_other_inv_in?: number; p2_cf_asset_buy?: number; p2_cf_intang_buy?: number; p2_cf_sec_buy?: number; p2_cf_loans_given?: number; p2_cf_other_inv_out?: number
  p2_cf_shares?: number; p2_cf_bonds?: number; p2_cf_founders?: number; p2_cf_loans_in?: number; p2_cf_other_fin_in?: number; p2_cf_dividends?: number; p2_cf_loans_out?: number; p2_cf_buyback?: number; p2_cf_other_fin_out?: number
  p2_cf_fx?: number; p2_cf_cash_begin?: number
  sector?: string
  collaterals: Collateral[]
  guarantors?: { name: string; inn: string; relation: string }[]
  ai_conclusion: string; recommendation: string; risk_level: string; created_at: string
}

const CONCLUSION_TYPES = [
  'Одобрение кредитной линии',
  'Увеличение кредитной линии',
  'Смена залога',
]

const EMPTY: Record<string, string> = {
  conclusion_type: 'Одобрение кредитной линии',
  existing_loan_balance: '',
  borrower_name: '', borrower_inn: '', business_type: '', years_in_business: '',
  loan_amount: '', loan_currency: 'TJS', loan_term_months: '', interest_rate: '',
  loan_purpose: '', credit_history: 'Положительная', analyst_name: '', sector: '',
  p1_label: '', p2_label: '',
  // Баланс Форма №1 — Краткосрочные активы
  p1_cash_desk: '', p1_cash_bank: '', p1_st_invest: '', p1_trade_rec: '', p1_other_rec: '', p1_founder_rec: '', p1_inventory: '', p1_prepaid: '', p1_nca_sale: '',
  // Баланс — Долгосрочные активы
  p1_ppe: '', p1_nat_res: '', p1_intangibles: '', p1_bio_assets: '', p1_invest_prop: '', p1_lt_invest: '', p1_def_tax_asset: '', p1_lt_rec: '',
  // Баланс — Краткосрочные обязательства
  p1_trade_pay: '', p1_st_debt: '', p1_accrued: '', p1_taxes_pay: '', p1_exp_reserves: '', p1_other_st_liab: '',
  // Баланс — Долгосрочные обязательства
  p1_lt_debt: '', p1_def_income: '', p1_def_tax_liab: '',
  // Баланс — Капитал
  p1_charter_cap: '', p1_add_cap: '', p1_retained: '', p1_reserve_cap: '', p1_minority: '',
  // p2 variants
  p2_cash_desk: '', p2_cash_bank: '', p2_st_invest: '', p2_trade_rec: '', p2_other_rec: '', p2_founder_rec: '', p2_inventory: '', p2_prepaid: '', p2_nca_sale: '',
  p2_ppe: '', p2_nat_res: '', p2_intangibles: '', p2_bio_assets: '', p2_invest_prop: '', p2_lt_invest: '', p2_def_tax_asset: '', p2_lt_rec: '',
  p2_trade_pay: '', p2_st_debt: '', p2_accrued: '', p2_taxes_pay: '', p2_exp_reserves: '', p2_other_st_liab: '',
  p2_lt_debt: '', p2_def_income: '', p2_def_tax_liab: '',
  p2_charter_cap: '', p2_add_cap: '', p2_retained: '', p2_reserve_cap: '', p2_minority: '',
  // ОПУ Форма №2
  p1_net_rev: '', p1_cogs: '', p1_sell_exp: '', p1_admin_exp: '', p1_other_op: '',
  p1_interest_exp: '', p1_invest_inc: '', p1_fx_diff: '', p1_currency_ex: '', p1_asset_disp: '', p1_impairment: '', p1_other_nonop: '', p1_assoc_profit: '', p1_tax: '', p1_discont: '',
  p2_net_rev: '', p2_cogs: '', p2_sell_exp: '', p2_admin_exp: '', p2_other_op: '',
  p2_interest_exp: '', p2_invest_inc: '', p2_fx_diff: '', p2_currency_ex: '', p2_asset_disp: '', p2_impairment: '', p2_other_nonop: '', p2_assoc_profit: '', p2_tax: '', p2_discont: '',
  // ОДДС Форма №5 — Операционная
  p1_cf_sales: '', p1_cf_other_op_in: '', p1_cf_cogs_paid: '', p1_cf_salary: '', p1_cf_services: '', p1_cf_interest: '', p1_cf_income_tax: '', p1_cf_other_taxes: '', p1_cf_other_op_out: '',
  p2_cf_sales: '', p2_cf_other_op_in: '', p2_cf_cogs_paid: '', p2_cf_salary: '', p2_cf_services: '', p2_cf_interest: '', p2_cf_income_tax: '', p2_cf_other_taxes: '', p2_cf_other_op_out: '',
  // ОДДС — Инвестиционная
  p1_cf_asset_sold: '', p1_cf_intang_sold: '', p1_cf_sec_sold: '', p1_cf_loan_ret: '', p1_cf_other_inv_in: '', p1_cf_asset_buy: '', p1_cf_intang_buy: '', p1_cf_sec_buy: '', p1_cf_loans_given: '', p1_cf_other_inv_out: '',
  p2_cf_asset_sold: '', p2_cf_intang_sold: '', p2_cf_sec_sold: '', p2_cf_loan_ret: '', p2_cf_other_inv_in: '', p2_cf_asset_buy: '', p2_cf_intang_buy: '', p2_cf_sec_buy: '', p2_cf_loans_given: '', p2_cf_other_inv_out: '',
  // ОДДС — Финансовая
  p1_cf_shares: '', p1_cf_bonds: '', p1_cf_founders: '', p1_cf_loans_in: '', p1_cf_other_fin_in: '', p1_cf_dividends: '', p1_cf_loans_out: '', p1_cf_buyback: '', p1_cf_other_fin_out: '',
  p2_cf_shares: '', p2_cf_bonds: '', p2_cf_founders: '', p2_cf_loans_in: '', p2_cf_other_fin_in: '', p2_cf_dividends: '', p2_cf_loans_out: '', p2_cf_buyback: '', p2_cf_other_fin_out: '',
  p1_cf_fx: '', p1_cf_cash_begin: '',
  p2_cf_fx: '', p2_cf_cash_begin: '',
}

const COLLATERAL_TYPES = ['Недвижимость', 'Автотранспорт', 'Оборудование', 'Товары в обороте', 'Депозит', 'Другое']
const CREDIT_HISTORY = ['Положительная', 'Нейтральная', 'Отрицательная', 'Отсутствует']
const CURRENCIES = ['TJS', 'USD', 'EUR', 'RUB']

const BUSINESS_SECTORS = [
  'Торговля (розничная)', 'Торговля (оптовая)', 'Производство продуктов питания',
  'Производство промышленное', 'Строительство', 'Сельское хозяйство',
  'Транспорт и логистика', 'Услуги (бытовые)', 'Услуги (профессиональные)',
  'IT и технологии', 'Здравоохранение', 'Образование', 'Гостиницы и рестораны',
  'Недвижимость', 'Другое',
]

const TYPE_COLORS: Record<string, string> = {
  'Одобрение кредитной линии': 'bg-blue-100 text-blue-800',
  'Увеличение кредитной линии': 'bg-purple-100 text-purple-800',
  'Смена залога': 'bg-orange-100 text-orange-800',
}
const TYPE_SHORT: Record<string, string> = {
  'Одобрение кредитной линии': 'Одобрение',
  'Увеличение кредитной линии': 'Увеличение',
  'Смена залога': 'Смена залога',
}

// ─── Sub-components OUTSIDE main component (prevent focus loss on re-render) ───

interface FRProps {
  label: string; f1?: string; f2?: string
  bold?: boolean; auto?: boolean; v1?: number; v2?: number
  formData: Record<string, string>; setF: (k: string, v: string) => void
}

function FR({ label, f1, f2, bold, auto, v1, v2, formData, setF }: FRProps) {
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))
  const cls = "w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] text-right bg-white"

  const fmtInput = (raw: string) => {
    if (!raw) return ''
    const isNeg = raw.startsWith('-')
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return isNeg ? '-' : ''
    return (isNeg ? '-' : '') + new Intl.NumberFormat('ru-RU').format(Number(digits))
  }
  const parseInput = (val: string) => val.replace(/[^0-9-]/g, '')

  return (
    <tr className={bold ? 'bg-gray-50' : 'hover:bg-blue-50/20'}>
      <td className={`px-3 py-2 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</td>
      <td className="px-2 py-1">
        {auto
          ? <div className={`text-sm font-bold text-right pr-2 ${(v1||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v1||0)}</div>
          : <input type="text" inputMode="numeric"
              value={f1 ? fmtInput(formData[f1] || '') : ''}
              onChange={e => f1 && setF(f1, parseInput(e.target.value))}
              className={cls} placeholder="0" />}
      </td>
      <td className="px-2 py-1">
        {auto
          ? <div className={`text-sm font-bold text-right pr-2 ${(v2||0) < 0 ? 'text-red-600' : bold ? 'text-[#1B8A4C]' : 'text-gray-900'}`}>{fmt(v2||0)}</div>
          : <input type="text" inputMode="numeric"
              value={f2 ? fmtInput(formData[f2] || '') : ''}
              onChange={e => f2 && setF(f2, parseInput(e.target.value))}
              className={cls} placeholder="0" />}
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNumber, setEditingNumber] = useState<number | null>(null)
  const [tab, setTab] = useState(1)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [inputMode, setInputMode] = useState<'manual' | 'image'>('manual')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<string | null>(null)

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

  // Баланс Форма №1 — Краткосрочные активы
  const p1_total_ca = n('p1_cash_desk') + n('p1_cash_bank') + n('p1_st_invest') + n('p1_trade_rec') + n('p1_other_rec') + n('p1_founder_rec') + n('p1_inventory') + n('p1_prepaid') + n('p1_nca_sale')
  const p2_total_ca = n('p2_cash_desk') + n('p2_cash_bank') + n('p2_st_invest') + n('p2_trade_rec') + n('p2_other_rec') + n('p2_founder_rec') + n('p2_inventory') + n('p2_prepaid') + n('p2_nca_sale')
  // Долгосрочные активы
  const p1_total_nca = n('p1_ppe') + n('p1_nat_res') + n('p1_intangibles') + n('p1_bio_assets') + n('p1_invest_prop') + n('p1_lt_invest') + n('p1_def_tax_asset') + n('p1_lt_rec')
  const p2_total_nca = n('p2_ppe') + n('p2_nat_res') + n('p2_intangibles') + n('p2_bio_assets') + n('p2_invest_prop') + n('p2_lt_invest') + n('p2_def_tax_asset') + n('p2_lt_rec')
  const p1_total_assets = p1_total_ca + p1_total_nca
  const p2_total_assets = p2_total_ca + p2_total_nca
  // Краткосрочные обязательства
  const p1_total_cl = n('p1_trade_pay') + n('p1_st_debt') + n('p1_accrued') + n('p1_taxes_pay') + n('p1_exp_reserves') + n('p1_other_st_liab')
  const p2_total_cl = n('p2_trade_pay') + n('p2_st_debt') + n('p2_accrued') + n('p2_taxes_pay') + n('p2_exp_reserves') + n('p2_other_st_liab')
  // Долгосрочные обязательства
  const p1_total_ll = n('p1_lt_debt') + n('p1_def_income') + n('p1_def_tax_liab')
  const p2_total_ll = n('p2_lt_debt') + n('p2_def_income') + n('p2_def_tax_liab')
  const p1_total_liab = p1_total_cl + p1_total_ll
  const p2_total_liab = p2_total_cl + p2_total_ll
  // Собственный капитал
  const p1_total_equity = n('p1_charter_cap') + n('p1_add_cap') + n('p1_retained') + n('p1_reserve_cap') + n('p1_minority')
  const p2_total_equity = n('p2_charter_cap') + n('p2_add_cap') + n('p2_retained') + n('p2_reserve_cap') + n('p2_minority')
  const p1_total_passiv = p1_total_liab + p1_total_equity
  const p2_total_passiv = p2_total_liab + p2_total_equity
  const p1_balance_diff = p1_total_assets - p1_total_passiv
  const p2_balance_diff = p2_total_assets - p2_total_passiv

  // ОПУ Форма №2
  const p1_gross = n('p1_net_rev') - n('p1_cogs')
  const p2_gross = n('p2_net_rev') - n('p2_cogs')
  const p1_total_op_exp = n('p1_sell_exp') + n('p1_admin_exp')
  const p2_total_op_exp = n('p2_sell_exp') + n('p2_admin_exp')
  const p1_op_profit = p1_gross - p1_total_op_exp + n('p1_other_op')
  const p2_op_profit = p2_gross - p2_total_op_exp + n('p2_other_op')
  const p1_total_nonop = n('p1_interest_exp') + n('p1_invest_inc') + n('p1_fx_diff') + n('p1_currency_ex') + n('p1_asset_disp') - n('p1_impairment') + n('p1_other_nonop')
  const p2_total_nonop = n('p2_interest_exp') + n('p2_invest_inc') + n('p2_fx_diff') + n('p2_currency_ex') + n('p2_asset_disp') - n('p2_impairment') + n('p2_other_nonop')
  const p1_ebt = p1_op_profit + p1_total_nonop + n('p1_assoc_profit')
  const p2_ebt = p2_op_profit + p2_total_nonop + n('p2_assoc_profit')
  const p1_continuing = p1_ebt - n('p1_tax')
  const p2_continuing = p2_ebt - n('p2_tax')
  const p1_net = p1_continuing + n('p1_discont')
  const p2_net = p2_continuing + n('p2_discont')

  // ОДДС Форма №5
  const p1_cf_total_op_in = n('p1_cf_sales') + n('p1_cf_other_op_in')
  const p2_cf_total_op_in = n('p2_cf_sales') + n('p2_cf_other_op_in')
  const p1_cf_total_op_out = n('p1_cf_cogs_paid') + n('p1_cf_salary') + n('p1_cf_services') + n('p1_cf_interest') + n('p1_cf_income_tax') + n('p1_cf_other_taxes') + n('p1_cf_other_op_out')
  const p2_cf_total_op_out = n('p2_cf_cogs_paid') + n('p2_cf_salary') + n('p2_cf_services') + n('p2_cf_interest') + n('p2_cf_income_tax') + n('p2_cf_other_taxes') + n('p2_cf_other_op_out')
  const p1_cf_net_op = p1_cf_total_op_in - p1_cf_total_op_out
  const p2_cf_net_op = p2_cf_total_op_in - p2_cf_total_op_out
  const p1_cf_total_inv_in = n('p1_cf_asset_sold') + n('p1_cf_intang_sold') + n('p1_cf_sec_sold') + n('p1_cf_loan_ret') + n('p1_cf_other_inv_in')
  const p2_cf_total_inv_in = n('p2_cf_asset_sold') + n('p2_cf_intang_sold') + n('p2_cf_sec_sold') + n('p2_cf_loan_ret') + n('p2_cf_other_inv_in')
  const p1_cf_total_inv_out = n('p1_cf_asset_buy') + n('p1_cf_intang_buy') + n('p1_cf_sec_buy') + n('p1_cf_loans_given') + n('p1_cf_other_inv_out')
  const p2_cf_total_inv_out = n('p2_cf_asset_buy') + n('p2_cf_intang_buy') + n('p2_cf_sec_buy') + n('p2_cf_loans_given') + n('p2_cf_other_inv_out')
  const p1_cf_net_inv = p1_cf_total_inv_in - p1_cf_total_inv_out
  const p2_cf_net_inv = p2_cf_total_inv_in - p2_cf_total_inv_out
  const p1_cf_total_fin_in = n('p1_cf_shares') + n('p1_cf_bonds') + n('p1_cf_founders') + n('p1_cf_loans_in') + n('p1_cf_other_fin_in')
  const p2_cf_total_fin_in = n('p2_cf_shares') + n('p2_cf_bonds') + n('p2_cf_founders') + n('p2_cf_loans_in') + n('p2_cf_other_fin_in')
  const p1_cf_total_fin_out = n('p1_cf_dividends') + n('p1_cf_loans_out') + n('p1_cf_buyback') + n('p1_cf_other_fin_out')
  const p2_cf_total_fin_out = n('p2_cf_dividends') + n('p2_cf_loans_out') + n('p2_cf_buyback') + n('p2_cf_other_fin_out')
  const p1_cf_net_fin = p1_cf_total_fin_in - p1_cf_total_fin_out
  const p2_cf_net_fin = p2_cf_total_fin_in - p2_cf_total_fin_out
  const p1_cf_net_change = p1_cf_net_op + p1_cf_net_inv + p1_cf_net_fin + n('p1_cf_fx')
  const p2_cf_net_change = p2_cf_net_op + p2_cf_net_inv + p2_cf_net_fin + n('p2_cf_fx')
  const p1_cash_end = n('p1_cf_cash_begin') + p1_cf_net_change
  const p2_cash_end = n('p2_cf_cash_begin') + p2_cf_net_change

  // Аннуитет
  const loanAmt = n('loan_amount')
  const rate = n('interest_rate') / 100 / 12
  const months = n('loan_term_months') || 12
  const monthlyPayment = rate > 0
    ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months)))
    : Math.round(loanAmt / months)

  // Покрытие залога (для Смены залога)
  const collateral_total = collaterals.reduce((s, c) => s + (c.value || 0), 0)
  const existing_balance = n('existing_loan_balance')
  const collateral_coverage_pct = existing_balance > 0 ? (collateral_total / existing_balance) * 100 : 0

  function handleEdit(c: CreditConclusion) {
    // 0 → '' so empty inputs look blank, not "0"
    const s = (v: number | null | undefined) => (v != null && v !== 0) ? String(Math.round(v)) : ''
    setForm({
      conclusion_type: c.conclusion_type || 'Одобрение кредитной линии',
      existing_loan_balance: s(c.existing_loan_balance),
      borrower_name: c.borrower_name || '',
      borrower_inn: c.borrower_inn || '',
      business_type: c.business_type || '',
      sector: c.sector || '',
      years_in_business: s(c.years_in_business),
      loan_amount: s(c.loan_amount),
      loan_currency: c.loan_currency || 'TJS',
      loan_term_months: s(c.loan_term_months),
      interest_rate: c.interest_rate ? String(c.interest_rate) : '',
      loan_purpose: c.loan_purpose || '',
      credit_history: c.credit_history || 'Положительная',
      analyst_name: c.analyst_name || '',
      p1_label: c.p1_label || '',
      p2_label: c.p2_label || '',
      // Баланс Форма №1 — новые поля с фолбэком на старые для старых записей
      p1_cash_desk: s(c.p1_cash_desk), p1_cash_bank: s(c.p1_cash_bank) || s(c.p1_cash),
      p1_st_invest: s(c.p1_st_invest), p1_trade_rec: s(c.p1_trade_rec) || s(c.p1_receivables),
      p1_other_rec: s(c.p1_other_rec), p1_founder_rec: s(c.p1_founder_rec),
      p1_inventory: s(c.p1_inventory), p1_prepaid: s(c.p1_prepaid), p1_nca_sale: s(c.p1_nca_sale),
      p1_ppe: s(c.p1_ppe) || s(c.p1_fixed_assets), p1_nat_res: s(c.p1_nat_res), p1_intangibles: s(c.p1_intangibles),
      p1_bio_assets: s(c.p1_bio_assets), p1_invest_prop: s(c.p1_invest_prop), p1_lt_invest: s(c.p1_lt_invest),
      p1_def_tax_asset: s(c.p1_def_tax_asset), p1_lt_rec: s(c.p1_lt_rec),
      p1_trade_pay: s(c.p1_trade_pay) || s(c.p1_supplier_debt), p1_st_debt: s(c.p1_st_debt) || s(c.p1_bank_debt),
      p1_accrued: s(c.p1_accrued), p1_taxes_pay: s(c.p1_taxes_pay),
      p1_exp_reserves: s(c.p1_exp_reserves), p1_other_st_liab: s(c.p1_other_st_liab) || s(c.p1_other_liabilities),
      p1_lt_debt: s(c.p1_lt_debt), p1_def_income: s(c.p1_def_income), p1_def_tax_liab: s(c.p1_def_tax_liab),
      p1_charter_cap: s(c.p1_charter_cap) || s(c.p1_equity_capital), p1_add_cap: s(c.p1_add_cap),
      p1_retained: s(c.p1_retained) || s(c.p1_retained_earnings),
      p1_reserve_cap: s(c.p1_reserve_cap) || s(c.p1_reserves), p1_minority: s(c.p1_minority),
      p2_cash_desk: s(c.p2_cash_desk), p2_cash_bank: s(c.p2_cash_bank) || s(c.p2_cash),
      p2_st_invest: s(c.p2_st_invest), p2_trade_rec: s(c.p2_trade_rec) || s(c.p2_receivables),
      p2_other_rec: s(c.p2_other_rec), p2_founder_rec: s(c.p2_founder_rec),
      p2_inventory: s(c.p2_inventory), p2_prepaid: s(c.p2_prepaid), p2_nca_sale: s(c.p2_nca_sale),
      p2_ppe: s(c.p2_ppe) || s(c.p2_fixed_assets), p2_nat_res: s(c.p2_nat_res), p2_intangibles: s(c.p2_intangibles),
      p2_bio_assets: s(c.p2_bio_assets), p2_invest_prop: s(c.p2_invest_prop), p2_lt_invest: s(c.p2_lt_invest),
      p2_def_tax_asset: s(c.p2_def_tax_asset), p2_lt_rec: s(c.p2_lt_rec),
      p2_trade_pay: s(c.p2_trade_pay) || s(c.p2_supplier_debt), p2_st_debt: s(c.p2_st_debt) || s(c.p2_bank_debt),
      p2_accrued: s(c.p2_accrued), p2_taxes_pay: s(c.p2_taxes_pay),
      p2_exp_reserves: s(c.p2_exp_reserves), p2_other_st_liab: s(c.p2_other_st_liab) || s(c.p2_other_liabilities),
      p2_lt_debt: s(c.p2_lt_debt), p2_def_income: s(c.p2_def_income), p2_def_tax_liab: s(c.p2_def_tax_liab),
      p2_charter_cap: s(c.p2_charter_cap) || s(c.p2_equity_capital), p2_add_cap: s(c.p2_add_cap),
      p2_retained: s(c.p2_retained) || s(c.p2_retained_earnings),
      p2_reserve_cap: s(c.p2_reserve_cap) || s(c.p2_reserves), p2_minority: s(c.p2_minority),
      // ОПУ Форма №2
      p1_net_rev: s(c.p1_net_rev) || s(c.p1_revenue), p1_cogs: s(c.p1_cogs),
      p1_sell_exp: s(c.p1_sell_exp) || s(c.p1_sales_expense), p1_admin_exp: s(c.p1_admin_exp) || s(c.p1_admin_expense),
      p1_other_op: s(c.p1_other_op) || s(c.p1_other_op_income),
      p1_interest_exp: s(c.p1_interest_exp), p1_invest_inc: s(c.p1_invest_inc),
      p1_fx_diff: s(c.p1_fx_diff), p1_currency_ex: s(c.p1_currency_ex), p1_asset_disp: s(c.p1_asset_disp),
      p1_impairment: s(c.p1_impairment), p1_other_nonop: s(c.p1_other_nonop) || s(c.p1_non_op),
      p1_assoc_profit: s(c.p1_assoc_profit), p1_tax: s(c.p1_tax), p1_discont: s(c.p1_discont),
      p2_net_rev: s(c.p2_net_rev) || s(c.p2_revenue), p2_cogs: s(c.p2_cogs),
      p2_sell_exp: s(c.p2_sell_exp) || s(c.p2_sales_expense), p2_admin_exp: s(c.p2_admin_exp) || s(c.p2_admin_expense),
      p2_other_op: s(c.p2_other_op) || s(c.p2_other_op_income),
      p2_interest_exp: s(c.p2_interest_exp), p2_invest_inc: s(c.p2_invest_inc),
      p2_fx_diff: s(c.p2_fx_diff), p2_currency_ex: s(c.p2_currency_ex), p2_asset_disp: s(c.p2_asset_disp),
      p2_impairment: s(c.p2_impairment), p2_other_nonop: s(c.p2_other_nonop) || s(c.p2_non_op),
      p2_assoc_profit: s(c.p2_assoc_profit), p2_tax: s(c.p2_tax), p2_discont: s(c.p2_discont),
      // ОДДС Форма №5
      p1_cf_sales: s(c.p1_cf_sales) || s(c.p1_op_inflow), p1_cf_other_op_in: s(c.p1_cf_other_op_in),
      p1_cf_cogs_paid: s(c.p1_cf_cogs_paid) || s(c.p1_op_outflow), p1_cf_salary: s(c.p1_cf_salary),
      p1_cf_services: s(c.p1_cf_services), p1_cf_interest: s(c.p1_cf_interest),
      p1_cf_income_tax: s(c.p1_cf_income_tax), p1_cf_other_taxes: s(c.p1_cf_other_taxes), p1_cf_other_op_out: s(c.p1_cf_other_op_out),
      p1_cf_asset_sold: s(c.p1_cf_asset_sold) || s(c.p1_inv_inflow), p1_cf_intang_sold: s(c.p1_cf_intang_sold),
      p1_cf_sec_sold: s(c.p1_cf_sec_sold), p1_cf_loan_ret: s(c.p1_cf_loan_ret), p1_cf_other_inv_in: s(c.p1_cf_other_inv_in),
      p1_cf_asset_buy: s(c.p1_cf_asset_buy) || s(c.p1_inv_outflow), p1_cf_intang_buy: s(c.p1_cf_intang_buy),
      p1_cf_sec_buy: s(c.p1_cf_sec_buy), p1_cf_loans_given: s(c.p1_cf_loans_given), p1_cf_other_inv_out: s(c.p1_cf_other_inv_out),
      p1_cf_shares: s(c.p1_cf_shares), p1_cf_bonds: s(c.p1_cf_bonds), p1_cf_founders: s(c.p1_cf_founders),
      p1_cf_loans_in: s(c.p1_cf_loans_in) || s(c.p1_fin_inflow), p1_cf_other_fin_in: s(c.p1_cf_other_fin_in),
      p1_cf_dividends: s(c.p1_cf_dividends), p1_cf_loans_out: s(c.p1_cf_loans_out) || s(c.p1_fin_outflow),
      p1_cf_buyback: s(c.p1_cf_buyback), p1_cf_other_fin_out: s(c.p1_cf_other_fin_out),
      p1_cf_fx: s(c.p1_cf_fx), p1_cf_cash_begin: s(c.p1_cf_cash_begin) || s(c.p1_cash_begin),
      p2_cf_sales: s(c.p2_cf_sales) || s(c.p2_op_inflow), p2_cf_other_op_in: s(c.p2_cf_other_op_in),
      p2_cf_cogs_paid: s(c.p2_cf_cogs_paid) || s(c.p2_op_outflow), p2_cf_salary: s(c.p2_cf_salary),
      p2_cf_services: s(c.p2_cf_services), p2_cf_interest: s(c.p2_cf_interest),
      p2_cf_income_tax: s(c.p2_cf_income_tax), p2_cf_other_taxes: s(c.p2_cf_other_taxes), p2_cf_other_op_out: s(c.p2_cf_other_op_out),
      p2_cf_asset_sold: s(c.p2_cf_asset_sold) || s(c.p2_inv_inflow), p2_cf_intang_sold: s(c.p2_cf_intang_sold),
      p2_cf_sec_sold: s(c.p2_cf_sec_sold), p2_cf_loan_ret: s(c.p2_cf_loan_ret), p2_cf_other_inv_in: s(c.p2_cf_other_inv_in),
      p2_cf_asset_buy: s(c.p2_cf_asset_buy) || s(c.p2_inv_outflow), p2_cf_intang_buy: s(c.p2_cf_intang_buy),
      p2_cf_sec_buy: s(c.p2_cf_sec_buy), p2_cf_loans_given: s(c.p2_cf_loans_given), p2_cf_other_inv_out: s(c.p2_cf_other_inv_out),
      p2_cf_shares: s(c.p2_cf_shares), p2_cf_bonds: s(c.p2_cf_bonds), p2_cf_founders: s(c.p2_cf_founders),
      p2_cf_loans_in: s(c.p2_cf_loans_in) || s(c.p2_fin_inflow), p2_cf_other_fin_in: s(c.p2_cf_other_fin_in),
      p2_cf_dividends: s(c.p2_cf_dividends), p2_cf_loans_out: s(c.p2_cf_loans_out) || s(c.p2_fin_outflow),
      p2_cf_buyback: s(c.p2_cf_buyback), p2_cf_other_fin_out: s(c.p2_cf_other_fin_out),
      p2_cf_fx: s(c.p2_cf_fx), p2_cf_cash_begin: s(c.p2_cf_cash_begin) || s(c.p2_cash_begin),
    })
    setCollaterals(c.collaterals?.length ? c.collaterals : [{ type: 'Недвижимость', description: '', value: 0 }])
    setGuarantors(c.guarantors || [])
    setEditingId(c.id)
    setEditingNumber(c.conclusion_number || null)
    setTab(1)
    setInputMode('manual')
    setImageFiles([])
    setExtractMsg(null)
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setForm(EMPTY)
    setCollaterals([{ type: 'Недвижимость', description: '', value: 0 }])
    setGuarantors([])
    setEditingId(null)
    setEditingNumber(null)
    setTab(1)
    setInputMode('manual')
    setImageFiles([])
    setExtractMsg(null)
    setError(null)
  }

  async function handleGenerate() {
    if (!form.borrower_name || !form.loan_purpose) {
      setError('Заполните обязательные поля: Заёмщик, Цель'); return
    }
    if (form.conclusion_type !== 'Смена залога' && !form.loan_amount) {
      setError('Заполните сумму кредита'); return
    }
    setGenerating(true); setError(null)
    try {
      const payload = {
        ...form, collaterals, conclusion_type: form.conclusion_type,
        existing_loan_balance: n('existing_loan_balance'),
        p1_gross, p2_gross, p1_op_profit, p2_op_profit,
        p1_ebt, p2_ebt, p1_net, p2_net,
        p1_total_assets, p2_total_assets,
        p1_total_liabilities: p1_total_liab, p2_total_liabilities: p2_total_liab,
        p1_total_ca, p2_total_ca,
        p1_total_cl, p2_total_cl,
        p1_total_equity, p2_total_equity,
        p1_cf_net_op, p2_cf_net_op,
        p1_cf_cash_end: p1_cash_end, p2_cf_cash_end: p2_cash_end,
        monthly_payment: monthlyPayment,
        collateral_total, collateral_coverage_pct,
      }
      const res = await apiFetch('/api/credit-risk/generate', {
        method: 'POST',
        body: JSON.stringify({ formData: payload }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const dbRow = {
        conclusion_type: form.conclusion_type || 'Одобрение кредитной линии',
        borrower_name: form.borrower_name, borrower_inn: form.borrower_inn,
        business_type: form.business_type, sector: form.sector || null, years_in_business: n('years_in_business'),
        loan_amount: n('loan_amount'), loan_currency: form.loan_currency,
        loan_term: `${form.loan_term_months} мес.`, loan_term_months: n('loan_term_months'),
        interest_rate: n('interest_rate'), loan_purpose: form.loan_purpose,
        credit_history: form.credit_history, analyst_name: form.analyst_name,
        existing_loan_balance: n('existing_loan_balance'),
        p1_label: form.p1_label || 'Период 1', p2_label: form.p2_label || 'Период 2',
        // Баланс Форма №1 — Краткосрочные активы
        p1_cash_desk: n('p1_cash_desk'), p1_cash_bank: n('p1_cash_bank'), p1_st_invest: n('p1_st_invest'),
        p1_trade_rec: n('p1_trade_rec'), p1_other_rec: n('p1_other_rec'), p1_founder_rec: n('p1_founder_rec'),
        p1_inventory: n('p1_inventory'), p1_prepaid: n('p1_prepaid'), p1_nca_sale: n('p1_nca_sale'),
        // Долгосрочные активы
        p1_ppe: n('p1_ppe'), p1_nat_res: n('p1_nat_res'), p1_intangibles: n('p1_intangibles'),
        p1_bio_assets: n('p1_bio_assets'), p1_invest_prop: n('p1_invest_prop'), p1_lt_invest: n('p1_lt_invest'),
        p1_def_tax_asset: n('p1_def_tax_asset'), p1_lt_rec: n('p1_lt_rec'),
        // Краткосрочные обязательства
        p1_trade_pay: n('p1_trade_pay'), p1_st_debt: n('p1_st_debt'), p1_accrued: n('p1_accrued'),
        p1_taxes_pay: n('p1_taxes_pay'), p1_exp_reserves: n('p1_exp_reserves'), p1_other_st_liab: n('p1_other_st_liab'),
        // Долгосрочные обязательства
        p1_lt_debt: n('p1_lt_debt'), p1_def_income: n('p1_def_income'), p1_def_tax_liab: n('p1_def_tax_liab'),
        // Капитал
        p1_charter_cap: n('p1_charter_cap'), p1_add_cap: n('p1_add_cap'), p1_retained: n('p1_retained'),
        p1_reserve_cap: n('p1_reserve_cap'), p1_minority: n('p1_minority'),
        // p2 variants
        p2_cash_desk: n('p2_cash_desk'), p2_cash_bank: n('p2_cash_bank'), p2_st_invest: n('p2_st_invest'),
        p2_trade_rec: n('p2_trade_rec'), p2_other_rec: n('p2_other_rec'), p2_founder_rec: n('p2_founder_rec'),
        p2_inventory: n('p2_inventory'), p2_prepaid: n('p2_prepaid'), p2_nca_sale: n('p2_nca_sale'),
        p2_ppe: n('p2_ppe'), p2_nat_res: n('p2_nat_res'), p2_intangibles: n('p2_intangibles'),
        p2_bio_assets: n('p2_bio_assets'), p2_invest_prop: n('p2_invest_prop'), p2_lt_invest: n('p2_lt_invest'),
        p2_def_tax_asset: n('p2_def_tax_asset'), p2_lt_rec: n('p2_lt_rec'),
        p2_trade_pay: n('p2_trade_pay'), p2_st_debt: n('p2_st_debt'), p2_accrued: n('p2_accrued'),
        p2_taxes_pay: n('p2_taxes_pay'), p2_exp_reserves: n('p2_exp_reserves'), p2_other_st_liab: n('p2_other_st_liab'),
        p2_lt_debt: n('p2_lt_debt'), p2_def_income: n('p2_def_income'), p2_def_tax_liab: n('p2_def_tax_liab'),
        p2_charter_cap: n('p2_charter_cap'), p2_add_cap: n('p2_add_cap'), p2_retained: n('p2_retained'),
        p2_reserve_cap: n('p2_reserve_cap'), p2_minority: n('p2_minority'),
        // ОПУ Форма №2
        p1_net_rev: n('p1_net_rev'), p1_cogs: n('p1_cogs'), p1_gross_profit: p1_gross,
        p1_sell_exp: n('p1_sell_exp'), p1_admin_exp: n('p1_admin_exp'), p1_other_op: n('p1_other_op'),
        p1_interest_exp: n('p1_interest_exp'), p1_invest_inc: n('p1_invest_inc'), p1_fx_diff: n('p1_fx_diff'),
        p1_currency_ex: n('p1_currency_ex'), p1_asset_disp: n('p1_asset_disp'), p1_impairment: n('p1_impairment'),
        p1_other_nonop: n('p1_other_nonop'), p1_assoc_profit: n('p1_assoc_profit'), p1_tax: n('p1_tax'),
        p1_discont: n('p1_discont'), p1_net_profit: p1_net,
        p2_net_rev: n('p2_net_rev'), p2_cogs: n('p2_cogs'), p2_gross_profit: p2_gross,
        p2_sell_exp: n('p2_sell_exp'), p2_admin_exp: n('p2_admin_exp'), p2_other_op: n('p2_other_op'),
        p2_interest_exp: n('p2_interest_exp'), p2_invest_inc: n('p2_invest_inc'), p2_fx_diff: n('p2_fx_diff'),
        p2_currency_ex: n('p2_currency_ex'), p2_asset_disp: n('p2_asset_disp'), p2_impairment: n('p2_impairment'),
        p2_other_nonop: n('p2_other_nonop'), p2_assoc_profit: n('p2_assoc_profit'), p2_tax: n('p2_tax'),
        p2_discont: n('p2_discont'), p2_net_profit: p2_net,
        // ОДДС Форма №5
        p1_cf_sales: n('p1_cf_sales'), p1_cf_other_op_in: n('p1_cf_other_op_in'), p1_cf_cogs_paid: n('p1_cf_cogs_paid'),
        p1_cf_salary: n('p1_cf_salary'), p1_cf_services: n('p1_cf_services'), p1_cf_interest: n('p1_cf_interest'),
        p1_cf_income_tax: n('p1_cf_income_tax'), p1_cf_other_taxes: n('p1_cf_other_taxes'), p1_cf_other_op_out: n('p1_cf_other_op_out'),
        p1_cf_asset_sold: n('p1_cf_asset_sold'), p1_cf_intang_sold: n('p1_cf_intang_sold'), p1_cf_sec_sold: n('p1_cf_sec_sold'),
        p1_cf_loan_ret: n('p1_cf_loan_ret'), p1_cf_other_inv_in: n('p1_cf_other_inv_in'),
        p1_cf_asset_buy: n('p1_cf_asset_buy'), p1_cf_intang_buy: n('p1_cf_intang_buy'), p1_cf_sec_buy: n('p1_cf_sec_buy'),
        p1_cf_loans_given: n('p1_cf_loans_given'), p1_cf_other_inv_out: n('p1_cf_other_inv_out'),
        p1_cf_shares: n('p1_cf_shares'), p1_cf_bonds: n('p1_cf_bonds'), p1_cf_founders: n('p1_cf_founders'),
        p1_cf_loans_in: n('p1_cf_loans_in'), p1_cf_other_fin_in: n('p1_cf_other_fin_in'),
        p1_cf_dividends: n('p1_cf_dividends'), p1_cf_loans_out: n('p1_cf_loans_out'), p1_cf_buyback: n('p1_cf_buyback'),
        p1_cf_other_fin_out: n('p1_cf_other_fin_out'), p1_cf_fx: n('p1_cf_fx'), p1_cf_cash_begin: n('p1_cf_cash_begin'),
        p1_cash_end,
        p2_cf_sales: n('p2_cf_sales'), p2_cf_other_op_in: n('p2_cf_other_op_in'), p2_cf_cogs_paid: n('p2_cf_cogs_paid'),
        p2_cf_salary: n('p2_cf_salary'), p2_cf_services: n('p2_cf_services'), p2_cf_interest: n('p2_cf_interest'),
        p2_cf_income_tax: n('p2_cf_income_tax'), p2_cf_other_taxes: n('p2_cf_other_taxes'), p2_cf_other_op_out: n('p2_cf_other_op_out'),
        p2_cf_asset_sold: n('p2_cf_asset_sold'), p2_cf_intang_sold: n('p2_cf_intang_sold'), p2_cf_sec_sold: n('p2_cf_sec_sold'),
        p2_cf_loan_ret: n('p2_cf_loan_ret'), p2_cf_other_inv_in: n('p2_cf_other_inv_in'),
        p2_cf_asset_buy: n('p2_cf_asset_buy'), p2_cf_intang_buy: n('p2_cf_intang_buy'), p2_cf_sec_buy: n('p2_cf_sec_buy'),
        p2_cf_loans_given: n('p2_cf_loans_given'), p2_cf_other_inv_out: n('p2_cf_other_inv_out'),
        p2_cf_shares: n('p2_cf_shares'), p2_cf_bonds: n('p2_cf_bonds'), p2_cf_founders: n('p2_cf_founders'),
        p2_cf_loans_in: n('p2_cf_loans_in'), p2_cf_other_fin_in: n('p2_cf_other_fin_in'),
        p2_cf_dividends: n('p2_cf_dividends'), p2_cf_loans_out: n('p2_cf_loans_out'), p2_cf_buyback: n('p2_cf_buyback'),
        p2_cf_other_fin_out: n('p2_cf_other_fin_out'), p2_cf_fx: n('p2_cf_fx'), p2_cf_cash_begin: n('p2_cf_cash_begin'),
        p2_cash_end,
        collaterals, guarantors, ai_conclusion: data.conclusion,
        recommendation: data.recommendation, risk_level: data.risk_level,
      }

      if (editingId) {
        // UPDATE — сохраняем тот же conclusion_number
        const { error: dbErr } = await supabase.from('credit_conclusions').update(dbRow).eq('id', editingId)
        if (dbErr) throw new Error(dbErr.message)
      } else {
        // INSERT — назначаем новый номер
        const { data: maxData } = await supabase
          .from('credit_conclusions')
          .select('conclusion_number')
          .order('conclusion_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        const conclusion_number = (maxData?.conclusion_number || 0) + 1
        const { error: dbErr } = await supabase.from('credit_conclusions').insert({ ...dbRow, conclusion_number })
        if (dbErr) throw new Error(dbErr.message)

        // Автоматически создать запись в реестре заёмщиков
        const { data: existingBorrower } = await supabase.from('borrowers').select('id').eq('code', form.borrower_name).single()
        if (!existingBorrower) {
          await supabase.from('borrowers').insert({ code: form.borrower_name })
        }
      }

      closeModal()
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setGenerating(false) }
  }

  async function handleExtract() {
    if (imageFiles.length === 0) return
    setExtracting(true); setExtractMsg(null)
    try {
      let merged: Record<string, string> = {}
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
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type, module: 'credit' }),
        })
        const data = await res.json()
        if (data.error) throw new Error(`Файл ${i + 1}: ${data.error}`)
        const STRING_KEYS = ['p1_label', 'p2_label']
        for (const [k, v] of Object.entries(data.data)) {
          if (v !== null && v !== undefined && v !== 0) {
            merged[k] = STRING_KEYS.includes(k) ? String(v) : String(Math.round(Number(v)))
          }
        }
      }
      setForm(prev => ({ ...prev, ...merged }))
      setInputMode('manual')
      setImageFiles([])
      setExtractMsg(`Данные извлечены из ${imageFiles.length > 1 ? `${imageFiles.length} скриншотов` : 'скриншота'}. Проверьте и при необходимости исправьте.`)
    } catch (err: unknown) {
      setExtractMsg('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setExtracting(false) }
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

  const isCollateralChange = form.conclusion_type === 'Смена залога'
  const isIncrease = form.conclusion_type === 'Увеличение кредитной линии'

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Кредитный риск — AI-заключения</h1>
            <p className="text-sm text-gray-500 mt-0.5">Анализ заёмщиков МСБ с помощью искусственного интеллекта</p>
          </div>
          <button onClick={() => { closeModal(); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
            <Plus className="w-4 h-4" /> Новое заключение
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
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
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap mt-3">
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
      </div>

      <div className="space-y-5 mt-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['№','Заёмщик','Тип','Сумма','Риск','Рекомендация','Дата',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              : conclusions.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Нет заключений</p></td></tr>
              : conclusions.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                    №{c.conclusion_number || '—'}
                  </td>
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{c.borrower_name}</p>{c.borrower_inn && <p className="text-xs text-gray-400">ИНН: {c.borrower_inn}</p>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TYPE_COLORS[c.conclusion_type] || 'bg-gray-100 text-gray-700'}`}>
                      {TYPE_SHORT[c.conclusion_type] || c.conclusion_type || 'Одобрение'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{fmt(c.loan_amount)} {c.loan_currency}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(c.risk_level)}`}>{c.risk_level}</span></td>
                  <td className="px-4 py-3"><span className={`text-sm font-medium ${recColor(c.recommendation)}`}>{c.recommendation}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(c)} title="Изменить и перегенерировать" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
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
      </div>

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">№{viewing.conclusion_number || '—'}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[viewing.conclusion_type] || 'bg-gray-100 text-gray-700'}`}>
                    {viewing.conclusion_type || 'Одобрение кредитной линии'}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">Заключение: {viewing.borrower_name}</h2>
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Заёмщик', viewing.borrower_name],
                  viewing.conclusion_type === 'Увеличение кредитной линии' && viewing.existing_loan_balance
                    ? ['Действующий лимит', `${fmt(viewing.existing_loan_balance)} ${viewing.loan_currency}`]
                    : null,
                  viewing.conclusion_type === 'Увеличение кредитной линии' && viewing.loan_amount
                    ? ['Желаемый лимит', `${fmt(viewing.loan_amount)} ${viewing.loan_currency}`]
                    : viewing.conclusion_type === 'Смена залога'
                    ? (viewing.existing_loan_balance ? ['Остаток кредита', `${fmt(viewing.existing_loan_balance)} ${viewing.loan_currency}`] : null)
                    : (viewing.loan_amount ? ['Сумма линии', `${fmt(viewing.loan_amount)} ${viewing.loan_currency}`] : null),
                  ['Срок линии', viewing.loan_term || '—'],
                  ['Ставка', viewing.interest_rate ? `${viewing.interest_rate}%` : '—'],
                  ['Бизнес', viewing.business_type || '—'],
                  ['Лет', String(viewing.years_in_business || '—')],
                  ['Выручка П1', `${fmt(viewing.p1_net_rev ?? viewing.p1_revenue ?? 0)} TJS`],
                  ['Выручка П2', `${fmt(viewing.p2_net_rev ?? viewing.p2_revenue ?? 0)} TJS`],
                  ['Прибыль П1', `${fmt(viewing.p1_net_profit ?? 0)} TJS`],
                  ['Прибыль П2', `${fmt(viewing.p2_net_profit ?? 0)} TJS`],
                  ['Уровень риска', viewing.risk_level || '—'],
                  ['Аналитик', viewing.analyst_name || '—'],
                ].filter((x): x is string[] => x !== null).map(([l, v]) => <div key={String(l)}><p className="text-xs text-gray-500">{l}</p><p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p></div>)}
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
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingId ? `Изменить заключение №${editingNumber}` : 'Заключение о кредитоспособности МСБ'}
                </h2>
                {form.conclusion_type && (
                  <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[form.conclusion_type] || 'bg-gray-100 text-gray-700'}`}>
                    {form.conclusion_type}
                  </span>
                )}
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
                <Upload className="w-3.5 h-3.5" /> Загрузить скрин
              </button>
            </div>

            {/* Tabs — only in manual mode */}
            {inputMode === 'manual' && (
            <div className="flex border-b border-gray-100 px-2">
              {[{n:1,t:'Заёмщик'},{n:2,t:'Баланс'},{n:3,t:'ОПУ'},{n:4,t:'КешФлоу'},{n:5,t:'Залог'}].map(({n:tn,t}) => (
                <button key={tn} onClick={() => setTab(tn)}
                  className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${tab === tn ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t}
                </button>
              ))}
            </div>
            )}

            <div className="flex-1 overflow-y-auto p-5">
              {/* Image upload zone */}
              {inputMode === 'image' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Загрузите один или несколько скриншотов финансовой отчётности — баланс, ОПУ, кеш-флоу. AI извлечёт данные из всех изображений и заполнит форму.</p>
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
                                <span className="text-gray-400">({(f.size / 1024).toFixed(0)}KB)</span>
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400">Нажмите чтобы изменить выбор</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                          <p className="text-sm font-medium text-gray-500">Нажмите или перетащите файлы</p>
                          <p className="text-xs text-gray-400">PNG, JPG, WEBP · до 5 МБ каждый · можно выбрать несколько</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
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

              {/* Manual form */}
              {inputMode === 'manual' && <>
              {extractMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg mb-4">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700 flex-1">{extractMsg}</p>
                  <button onClick={() => setExtractMsg(null)}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
                </div>
              )}
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><p className="text-sm text-red-600">{error}</p></div>}

              {/* Tab 1: Заёмщик */}
              {tab === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Тип заключения — первым делом */}
                  <div className="lg:col-span-2">
                    <label className={lbl}>Тип заключения *</label>
                    <div className="flex gap-2 flex-wrap">
                      {CONCLUSION_TYPES.map(t => (
                        <button key={t} type="button"
                          onClick={() => setF('conclusion_type', t)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            form.conclusion_type === t
                              ? 'border-[#1B8A4C] bg-[#1B8A4C] text-white'
                              : 'border-gray-200 text-gray-600 hover:border-[#1B8A4C] hover:text-[#1B8A4C]'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div><label className={lbl}>Код заёмщика *</label>
                    <input type="text" value={form.borrower_name} onChange={e => setF('borrower_name', e.target.value)} placeholder="Заёмщик-001" className={inp} />
                    <p className="text-xs text-gray-400 mt-1">Используйте код вместо реального имени (напр. Заёмщик-001)</p>
                  </div>
                  <div><label className={lbl}>Кредитная история</label><select value={form.credit_history} onChange={e => setF('credit_history', e.target.value)} className={inp}>{CREDIT_HISTORY.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label className={lbl}>Сектор бизнеса</label>
                    <select value={form.sector} onChange={e => setF('sector', e.target.value)} className={inp}>
                      <option value="">Выберите сектор</option>
                      {BUSINESS_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Вид деятельности (детально)</label><input type="text" value={form.business_type} onChange={e => setF('business_type', e.target.value)} placeholder="Торговля стройматериалами..." className={inp} /></div>
                  <div><label className={lbl}>Лет в бизнесе</label><input type="text" inputMode="numeric" value={form.years_in_business} onChange={e => setF('years_in_business', e.target.value.replace(/\D/g,''))} className={inp} /></div>

                  {/* Поля суммы — зависят от типа заключения */}
                  {isCollateralChange ? (
                    <div>
                      <label className={lbl}>Остаток по действующему кредиту *</label>
                      <input type="text" inputMode="numeric"
                        value={form.existing_loan_balance ? new Intl.NumberFormat('ru-RU').format(Number(form.existing_loan_balance)) : ''}
                        onChange={e => setF('existing_loan_balance', e.target.value.replace(/[^0-9]/g,''))}
                        placeholder="0" className={inp} />
                      <p className="text-xs text-gray-400 mt-1">Текущий долг заёмщика перед банком</p>
                    </div>
                  ) : isIncrease ? (
                    <>
                      <div>
                        <label className={lbl}>Действующий лимит *</label>
                        <input type="text" inputMode="numeric"
                          value={form.existing_loan_balance ? new Intl.NumberFormat('ru-RU').format(Number(form.existing_loan_balance)) : ''}
                          onChange={e => setF('existing_loan_balance', e.target.value.replace(/[^0-9]/g,''))}
                          placeholder="0" className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Текущий утверждённый лимит кредитной линии</p>
                      </div>
                      <div>
                        <label className={lbl}>Желаемый лимит *</label>
                        <input type="text" inputMode="numeric"
                          value={form.loan_amount ? new Intl.NumberFormat('ru-RU').format(Number(form.loan_amount)) : ''}
                          onChange={e => setF('loan_amount', e.target.value.replace(/[^0-9]/g,''))}
                          placeholder="0" className={inp} />
                        {form.loan_amount && form.existing_loan_balance && Number(form.loan_amount) > Number(form.existing_loan_balance) && (
                          <p className="text-xs text-[#1B8A4C] mt-1 font-medium">
                            +{new Intl.NumberFormat('ru-RU').format(Number(form.loan_amount) - Number(form.existing_loan_balance))} ({(((Number(form.loan_amount) - Number(form.existing_loan_balance)) / Number(form.existing_loan_balance)) * 100).toFixed(1)}% к действующему)
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className={lbl}>Сумма открываемой кредитной линии *</label>
                      <input type="text" inputMode="numeric"
                        value={form.loan_amount ? new Intl.NumberFormat('ru-RU').format(Number(form.loan_amount)) : ''}
                        onChange={e => setF('loan_amount', e.target.value.replace(/[^0-9]/g,''))}
                        placeholder="0" className={inp} />
                    </div>
                  )}

                  <div><label className={lbl}>Валюта</label><select value={form.loan_currency} onChange={e => setF('loan_currency', e.target.value)} className={inp}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>

                  {!isCollateralChange && <>
                    <div><label className={lbl}>Срок линии (месяцев)</label><input type="text" inputMode="numeric" value={form.loan_term_months} onChange={e => setF('loan_term_months', e.target.value.replace(/\D/g,''))} placeholder="12" className={inp} /></div>
                    <div><label className={lbl}>Процентная ставка (% годовых)</label><input type="text" inputMode="decimal" value={form.interest_rate} onChange={e => setF('interest_rate', e.target.value.replace(/[^0-9.]/g,''))} placeholder="24" className={inp} /></div>
                    {form.loan_amount && form.loan_term_months && (
                      <div className="lg:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                        <p className="text-xs text-gray-600">Ежемесячное погашение (аннуитет):</p>
                        <p className="text-base font-bold text-[#1B8A4C]">{new Intl.NumberFormat('ru-RU').format(monthlyPayment)} {form.loan_currency}/мес</p>
                      </div>
                    )}
                  </>}

                  <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
                  <div><label className={lbl}>Название периода 1 (напр. 31.12.2024)</label><input type="text" value={form.p1_label} onChange={e => setF('p1_label', e.target.value)} placeholder="31.12.2024" className={inp} /></div>
                  <div><label className={lbl}>Название периода 2 (напр. 31.03.2025)</label><input type="text" value={form.p2_label} onChange={e => setF('p2_label', e.target.value)} placeholder="31.03.2025" className={inp} /></div>
                  <div className="lg:col-span-2">
                    <label className={lbl}>
                      {isCollateralChange ? 'Причина смены залога *' : isIncrease ? 'Обоснование увеличения лимита *' : 'Цель кредитной линии *'}
                    </label>
                    <textarea value={form.loan_purpose} onChange={e => setF('loan_purpose', e.target.value)} rows={2}
                      placeholder={isCollateralChange ? 'Причина замены предмета залога...' : isIncrease ? 'Рост бизнеса, расширение оборотных средств...' : 'Пополнение оборотных средств...'}
                      className={inp + ' resize-none'} />
                  </div>
                </div>
              )}

              {/* Tab 2: Баланс — Форма №1 (МФ РТ Приказ №42) */}
              {tab === 2 && (
                <div className="space-y-2">
                  <FT title="РАЗДЕЛ 1. КРАТКОСРОЧНЫЕ АКТИВЫ" p1={p1} p2={p2}>
                    <FR label="Денежные средства в кассе (10100)" f1="p1_cash_desk" f2="p2_cash_desk" formData={form} setF={setF} />
                    <FR label="Денежные средства в банках (10200)" f1="p1_cash_bank" f2="p2_cash_bank" formData={form} setF={setF} />
                    <FR label="Краткосрочные инвестиции (10300)" f1="p1_st_invest" f2="p2_st_invest" formData={form} setF={setF} />
                    <FR label="Торговая дебиторская задолженность (10400)" f1="p1_trade_rec" f2="p2_trade_rec" formData={form} setF={setF} />
                    <FR label="Прочая дебиторская задолженность (10500)" f1="p1_other_rec" f2="p2_other_rec" formData={form} setF={setF} />
                    <FR label="Задолженность учредителей (10600)" f1="p1_founder_rec" f2="p2_founder_rec" formData={form} setF={setF} />
                    <FR label="Товарно-материальные запасы (10700)" f1="p1_inventory" f2="p2_inventory" formData={form} setF={setF} />
                    <FR label="Расходы будущих периодов (10800)" f1="p1_prepaid" f2="p2_prepaid" formData={form} setF={setF} />
                    <FR label="Долгосрочные активы для продажи (10900)" f1="p1_nca_sale" f2="p2_nca_sale" formData={form} setF={setF} />
                    <FR label="Итого краткосрочных активов" bold auto v1={p1_total_ca} v2={p2_total_ca} formData={form} setF={setF} />
                  </FT>
                  <FT title="РАЗДЕЛ 2. ДОЛГОСРОЧНЫЕ АКТИВЫ" p1={p1} p2={p2}>
                    <FR label="Основные средства (11000)" f1="p1_ppe" f2="p2_ppe" formData={form} setF={setF} />
                    <FR label="Природные ресурсы (11200)" f1="p1_nat_res" f2="p2_nat_res" formData={form} setF={setF} />
                    <FR label="Нематериальные активы (11300)" f1="p1_intangibles" f2="p2_intangibles" formData={form} setF={setF} />
                    <FR label="Биологические активы (11400)" f1="p1_bio_assets" f2="p2_bio_assets" formData={form} setF={setF} />
                    <FR label="Инвестиционное имущество (11500)" f1="p1_invest_prop" f2="p2_invest_prop" formData={form} setF={setF} />
                    <FR label="Долгосрочные инвестиции (11600)" f1="p1_lt_invest" f2="p2_lt_invest" formData={form} setF={setF} />
                    <FR label="Отложенные налоговые активы (11700)" f1="p1_def_tax_asset" f2="p2_def_tax_asset" formData={form} setF={setF} />
                    <FR label="Долгосрочная дебиторская задолженность (11800)" f1="p1_lt_rec" f2="p2_lt_rec" formData={form} setF={setF} />
                    <FR label="Итого долгосрочных активов" bold auto v1={p1_total_nca} v2={p2_total_nca} formData={form} setF={setF} />
                    <FR label="ИТОГО АКТИВЫ" bold auto v1={p1_total_assets} v2={p2_total_assets} formData={form} setF={setF} />
                  </FT>
                  <FT title="РАЗДЕЛ 3. КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА" p1={p1} p2={p2}>
                    <FR label="Торговая кредиторская задолженность (22000)" f1="p1_trade_pay" f2="p2_trade_pay" formData={form} setF={setF} />
                    <FR label="Краткосрочные долговые обязательства (22100)" f1="p1_st_debt" f2="p2_st_debt" formData={form} setF={setF} />
                    <FR label="Начисленные краткосрочные обязательства (22200)" f1="p1_accrued" f2="p2_accrued" formData={form} setF={setF} />
                    <FR label="Налоговые обязательства (22300)" f1="p1_taxes_pay" f2="p2_taxes_pay" formData={form} setF={setF} />
                    <FR label="Резервы на расходы (22400)" f1="p1_exp_reserves" f2="p2_exp_reserves" formData={form} setF={setF} />
                    <FR label="Прочие краткосрочные обязательства (22500)" f1="p1_other_st_liab" f2="p2_other_st_liab" formData={form} setF={setF} />
                    <FR label="Итого краткосрочных обязательств" bold auto v1={p1_total_cl} v2={p2_total_cl} formData={form} setF={setF} />
                  </FT>
                  <FT title="РАЗДЕЛ 4. ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА" p1={p1} p2={p2}>
                    <FR label="Долгосрочные долговые обязательства (22600)" f1="p1_lt_debt" f2="p2_lt_debt" formData={form} setF={setF} />
                    <FR label="Доходы будущих периодов (22700)" f1="p1_def_income" f2="p2_def_income" formData={form} setF={setF} />
                    <FR label="Отложенные налоговые обязательства (22800)" f1="p1_def_tax_liab" f2="p2_def_tax_liab" formData={form} setF={setF} />
                    <FR label="Итого долгосрочных обязательств" bold auto v1={p1_total_ll} v2={p2_total_ll} formData={form} setF={setF} />
                    <FR label="ИТОГО ОБЯЗАТЕЛЬСТВА" bold auto v1={p1_total_liab} v2={p2_total_liab} formData={form} setF={setF} />
                  </FT>
                  <FT title="РАЗДЕЛ 5. СОБСТВЕННЫЙ КАПИТАЛ" p1={p1} p2={p2}>
                    <FR label="Уставный капитал (33000)" f1="p1_charter_cap" f2="p2_charter_cap" formData={form} setF={setF} />
                    <FR label="Дополнительный капитал (33100)" f1="p1_add_cap" f2="p2_add_cap" formData={form} setF={setF} />
                    <FR label="Нераспределённая прибыль (33200)" f1="p1_retained" f2="p2_retained" formData={form} setF={setF} />
                    <FR label="Резервный капитал (33300)" f1="p1_reserve_cap" f2="p2_reserve_cap" formData={form} setF={setF} />
                    <FR label="Доля меньшинства (33400)" f1="p1_minority" f2="p2_minority" formData={form} setF={setF} />
                    <FR label="Итого собственный капитал" bold auto v1={p1_total_equity} v2={p2_total_equity} formData={form} setF={setF} />
                    <FR label="ИТОГО ПАССИВЫ" bold auto v1={p1_total_passiv} v2={p2_total_passiv} formData={form} setF={setF} />
                  </FT>
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

              {/* Tab 3: ОПУ — Форма №2 (МФ РТ Приказ №42) */}
              {tab === 3 && (
                <FT title="ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ — Форма №2" p1={p1} p2={p2}>
                  <FR label="Чистый доход от продаж (010)" f1="p1_net_rev" f2="p2_net_rev" formData={form} setF={setF} />
                  <FR label="Себестоимость продаж (020)" f1="p1_cogs" f2="p2_cogs" formData={form} setF={setF} />
                  <FR label="▶ Валовая прибыль (030)" bold auto v1={p1_gross} v2={p2_gross} formData={form} setF={setF} />
                  <FR label="Расходы на продажу (040)" f1="p1_sell_exp" f2="p2_sell_exp" formData={form} setF={setF} />
                  <FR label="Административные расходы (050)" f1="p1_admin_exp" f2="p2_admin_exp" formData={form} setF={setF} />
                  <FR label="▶ Итого операционные расходы (060)" bold auto v1={p1_total_op_exp} v2={p2_total_op_exp} formData={form} setF={setF} />
                  <FR label="Прочие операционные доходы/(расходы) (070)" f1="p1_other_op" f2="p2_other_op" formData={form} setF={setF} />
                  <FR label="▶ Операционная прибыль/(убыток) (080)" bold auto v1={p1_op_profit} v2={p2_op_profit} formData={form} setF={setF} />
                  <FR label="Доходы/(расходы) по процентам (100)" f1="p1_interest_exp" f2="p2_interest_exp" formData={form} setF={setF} />
                  <FR label="Доходы/(убыток) от инвестиций (110)" f1="p1_invest_inc" f2="p2_invest_inc" formData={form} setF={setF} />
                  <FR label="Доходы/(убыток) от курсовых разниц (120)" f1="p1_fx_diff" f2="p2_fx_diff" formData={form} setF={setF} />
                  <FR label="Доходы/(убыток) от обмена валюты (130)" f1="p1_currency_ex" f2="p2_currency_ex" formData={form} setF={setF} />
                  <FR label="Доходы/(убыток) от выбытия активов (140)" f1="p1_asset_disp" f2="p2_asset_disp" formData={form} setF={setF} />
                  <FR label="Убыток от обесценения (150)" f1="p1_impairment" f2="p2_impairment" formData={form} setF={setF} />
                  <FR label="Прочие неоперационные доходы/(расходы) (160)" f1="p1_other_nonop" f2="p2_other_nonop" formData={form} setF={setF} />
                  <FR label="▶ Итого неоперационных (170)" bold auto v1={p1_total_nonop} v2={p2_total_nonop} formData={form} setF={setF} />
                  <FR label="Доля прибыли ассоц. компаний (180)" f1="p1_assoc_profit" f2="p2_assoc_profit" formData={form} setF={setF} />
                  <FR label="▶ Прибыль до налогообложения (190)" bold auto v1={p1_ebt} v2={p2_ebt} formData={form} setF={setF} />
                  <FR label="Налог на прибыль (200)" f1="p1_tax" f2="p2_tax" formData={form} setF={setF} />
                  <FR label="▶ Прибыль от продолжаемой деятельности (210)" bold auto v1={p1_continuing} v2={p2_continuing} formData={form} setF={setF} />
                  <FR label="Прибыль/(убыток) от прекращённой деятельности (220)" f1="p1_discont" f2="p2_discont" formData={form} setF={setF} />
                  <FR label="▶ ЧИСТАЯ ПРИБЫЛЬ/(УБЫТОК) (230)" bold auto v1={p1_net} v2={p2_net} formData={form} setF={setF} />
                </FT>
              )}

              {/* Tab 4: КешФлоу */}
              {tab === 4 && (
                <div className="space-y-2">
                  <FT title="ОДДС — ОПЕРАЦИОННАЯ ДЕЯТЕЛЬНОСТЬ (Форма №5)" p1={p1} p2={p2}>
                    <FR label="Поступления от продаж (010) [+]" f1="p1_cf_sales" f2="p2_cf_sales" formData={form} setF={setF} />
                    <FR label="Прочие операционные поступления (020) [+]" f1="p1_cf_other_op_in" f2="p2_cf_other_op_in" formData={form} setF={setF} />
                    <FR label="Итого поступлений (030)" bold auto v1={p1_cf_total_op_in} v2={p2_cf_total_op_in} formData={form} setF={setF} />
                    <FR label="Оплата себестоимости продаж (050) [−]" f1="p1_cf_cogs_paid" f2="p2_cf_cogs_paid" formData={form} setF={setF} />
                    <FR label="Оплата труда и отчисления (060) [−]" f1="p1_cf_salary" f2="p2_cf_salary" formData={form} setF={setF} />
                    <FR label="Оплата прочих услуг (070) [−]" f1="p1_cf_services" f2="p2_cf_services" formData={form} setF={setF} />
                    <FR label="Выплата процентов (080) [−]" f1="p1_cf_interest" f2="p2_cf_interest" formData={form} setF={setF} />
                    <FR label="Уплата налога на прибыль (090) [−]" f1="p1_cf_income_tax" f2="p2_cf_income_tax" formData={form} setF={setF} />
                    <FR label="Уплата прочих налогов (100) [−]" f1="p1_cf_other_taxes" f2="p2_cf_other_taxes" formData={form} setF={setF} />
                    <FR label="Прочие операционные выплаты (110) [−]" f1="p1_cf_other_op_out" f2="p2_cf_other_op_out" formData={form} setF={setF} />
                    <FR label="Итого выплат (190)" bold auto v1={p1_cf_total_op_out} v2={p2_cf_total_op_out} formData={form} setF={setF} />
                    <FR label="▶ Чистый поток — операционная (200)" bold auto v1={p1_cf_net_op} v2={p2_cf_net_op} formData={form} setF={setF} />
                  </FT>
                  <FT title="ОДДС — ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ" p1={p1} p2={p2}>
                    <FR label="Продажа основных средств (210) [+]" f1="p1_cf_asset_sold" f2="p2_cf_asset_sold" formData={form} setF={setF} />
                    <FR label="Продажа нематериальных активов (220) [+]" f1="p1_cf_intang_sold" f2="p2_cf_intang_sold" formData={form} setF={setF} />
                    <FR label="Продажа ценных бумаг (230) [+]" f1="p1_cf_sec_sold" f2="p2_cf_sec_sold" formData={form} setF={setF} />
                    <FR label="Возврат займов (240) [+]" f1="p1_cf_loan_ret" f2="p2_cf_loan_ret" formData={form} setF={setF} />
                    <FR label="Прочие инвест. поступления (250) [+]" f1="p1_cf_other_inv_in" f2="p2_cf_other_inv_in" formData={form} setF={setF} />
                    <FR label="Итого инвест. поступлений (260)" bold auto v1={p1_cf_total_inv_in} v2={p2_cf_total_inv_in} formData={form} setF={setF} />
                    <FR label="Приобретение основных средств (270) [−]" f1="p1_cf_asset_buy" f2="p2_cf_asset_buy" formData={form} setF={setF} />
                    <FR label="Приобретение нематериальных активов (280) [−]" f1="p1_cf_intang_buy" f2="p2_cf_intang_buy" formData={form} setF={setF} />
                    <FR label="Приобретение ценных бумаг (290) [−]" f1="p1_cf_sec_buy" f2="p2_cf_sec_buy" formData={form} setF={setF} />
                    <FR label="Предоставление займов (300) [−]" f1="p1_cf_loans_given" f2="p2_cf_loans_given" formData={form} setF={setF} />
                    <FR label="Прочие инвест. выплаты (310) [−]" f1="p1_cf_other_inv_out" f2="p2_cf_other_inv_out" formData={form} setF={setF} />
                    <FR label="Итого инвест. выплат (320)" bold auto v1={p1_cf_total_inv_out} v2={p2_cf_total_inv_out} formData={form} setF={setF} />
                    <FR label="▶ Чистый поток — инвестиционная (330)" bold auto v1={p1_cf_net_inv} v2={p2_cf_net_inv} formData={form} setF={setF} />
                  </FT>
                  <FT title="ОДДС — ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ" p1={p1} p2={p2}>
                    <FR label="Эмиссия акций (410) [+]" f1="p1_cf_shares" f2="p2_cf_shares" formData={form} setF={setF} />
                    <FR label="Эмиссия облигаций (420) [+]" f1="p1_cf_bonds" f2="p2_cf_bonds" formData={form} setF={setF} />
                    <FR label="Вклады учредителей (430) [+]" f1="p1_cf_founders" f2="p2_cf_founders" formData={form} setF={setF} />
                    <FR label="Полученные займы и кредиты (440) [+]" f1="p1_cf_loans_in" f2="p2_cf_loans_in" formData={form} setF={setF} />
                    <FR label="Прочие фин. поступления (450) [+]" f1="p1_cf_other_fin_in" f2="p2_cf_other_fin_in" formData={form} setF={setF} />
                    <FR label="Итого фин. поступлений (460)" bold auto v1={p1_cf_total_fin_in} v2={p2_cf_total_fin_in} formData={form} setF={setF} />
                    <FR label="Выплата дивидендов (470) [−]" f1="p1_cf_dividends" f2="p2_cf_dividends" formData={form} setF={setF} />
                    <FR label="Погашение займов и кредитов (480) [−]" f1="p1_cf_loans_out" f2="p2_cf_loans_out" formData={form} setF={setF} />
                    <FR label="Выкуп собственных акций (490) [−]" f1="p1_cf_buyback" f2="p2_cf_buyback" formData={form} setF={setF} />
                    <FR label="Прочие фин. выплаты (500) [−]" f1="p1_cf_other_fin_out" f2="p2_cf_other_fin_out" formData={form} setF={setF} />
                    <FR label="Итого фин. выплат (510)" bold auto v1={p1_cf_total_fin_out} v2={p2_cf_total_fin_out} formData={form} setF={setF} />
                    <FR label="▶ Чистый поток — финансовая (520)" bold auto v1={p1_cf_net_fin} v2={p2_cf_net_fin} formData={form} setF={setF} />
                  </FT>
                  <FT title="ОДДС — ИТОГО" p1={p1} p2={p2}>
                    <FR label="Влияние курсовых разниц (600)" f1="p1_cf_fx" f2="p2_cf_fx" formData={form} setF={setF} />
                    <FR label="▶ Нетто изменение денежных средств" bold auto v1={p1_cf_net_change} v2={p2_cf_net_change} formData={form} setF={setF} />
                    <FR label="Остаток на начало периода" bold f1="p1_cf_cash_begin" f2="p2_cf_cash_begin" formData={form} setF={setF} />
                    <FR label="▶ Остаток на конец периода" bold auto v1={p1_cash_end} v2={p2_cash_end} formData={form} setF={setF} />
                  </FT>
                </div>
              )}

              {/* Tab 5: Залог */}
              {tab === 5 && (
                <div className="space-y-3">
                  {/* Покрытие залога — только для Смены залога */}
                  {isCollateralChange && existing_balance > 0 && (
                    <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                      collateral_coverage_pct >= 150 ? 'bg-green-50 border-green-300' :
                      collateral_coverage_pct >= 100 ? 'bg-yellow-50 border-yellow-300' :
                      'bg-red-50 border-red-300'
                    }`}>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Уровень покрытия залога</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Залог {fmt(collateral_total)} TJS / Остаток кредита {fmt(existing_balance)} TJS
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          collateral_coverage_pct >= 150 ? 'text-green-700' :
                          collateral_coverage_pct >= 100 ? 'text-yellow-700' : 'text-red-700'
                        }`}>
                          {collateral_coverage_pct.toFixed(1)}%
                        </p>
                        <p className={`text-xs font-medium mt-0.5 ${
                          collateral_coverage_pct >= 150 ? 'text-green-600' :
                          collateral_coverage_pct >= 100 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {collateral_coverage_pct >= 150 ? '✅ Достаточно (норма ≥150%)' :
                           collateral_coverage_pct >= 100 ? '⚠️ Допустимо (рекомендуется ≥150%)' :
                           '❌ Недостаточно (менее 100%)'}
                        </p>
                      </div>
                    </div>
                  )}

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
                          <input type="text" inputMode="numeric"
                          value={col.value ? new Intl.NumberFormat('ru-RU').format(col.value) : ''}
                          onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,value:Number(e.target.value.replace(/[^0-9]/g,''))} : c))}
                          placeholder="0" className={inp} /></div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setCollaterals(p => [...p, {type:'Недвижимость',description:'',value:0}])}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#1B8A4C] hover:text-[#1B8A4C] w-full justify-center">
                    <Plus className="w-4 h-4" /> Добавить залог
                  </button>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Общая стоимость залога</p>
                    <p className="text-base font-bold text-gray-900">{fmt(collateral_total)} TJS</p>
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
                          <div><label className={lbl}>Доход поручителя (TJS)</label>
                            <input type="text" inputMode="numeric"
                              value={g.inn ? new Intl.NumberFormat('ru-RU').format(Number(g.inn)) : ''}
                              onChange={e => setGuarantors(p => p.map((x,i) => i===idx ? {...x, inn: e.target.value.replace(/[^0-9]/g,'')} : x))}
                              placeholder="0" className={inp} /></div>
                          <div><label className={lbl}>Связь с заёмщиком</label>
                            <input type="text" value={g.relation} onChange={e => setGuarantors(p => p.map((x,i) => i===idx ? {...x, relation: e.target.value} : x))} placeholder="Учредитель, супруг..." className={inp} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              {inputMode === 'image' ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowModal(false); setForm(EMPTY); setInputMode('manual'); setImageFiles([]); setExtractMsg(null) }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    <button onClick={handleExtract} disabled={imageFiles.length === 0 || extracting}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                      {extracting
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Извлечение...</>
                        : <><Upload className="w-4 h-4" /> Извлечь данные{imageFiles.length > 1 ? ` (${imageFiles.length})` : ''}</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>{tab > 1 && <button onClick={() => setTab(tab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowModal(false); setForm(EMPTY); setInputMode('manual'); setImageFiles([]); setExtractMsg(null) }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                    {tab < 5
                      ? <button onClick={() => setTab(tab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                      : <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI анализирует...</> : <><CheckCircle2 className="w-4 h-4" /> {editingId ? 'Перегенерировать' : 'Сгенерировать'}</>}
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

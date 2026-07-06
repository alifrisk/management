'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Plus, FileText, Download, Eye, Trash2, X, Loader2, CheckCircle2, AlertCircle, Filter, Upload, Edit2 } from 'lucide-react'

interface Collateral { type: string; description: string; address?: string; value: number }

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
  additional_info?: string
  collaterals: Collateral[]
  guarantors?: { name: string; inn: string; relation: string }[]
  exchange_rate?: number
  sme_sector_portfolio?: number
  bank_total_portfolio?: number
  current_par30_pct?: number
  current_msb_par30_pct?: number
  ra_conc_limit?: number
  ra_par30_limit?: number
  ra_msb_par30_limit?: number
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
  // Концентрация / Риск-аппетит
  exchange_rate: '',
  sme_sector_portfolio: '',
  bank_total_portfolio: '',
  ra_conc_limit: '',
  current_par30_pct: '',
  ra_par30_limit: '',
  current_msb_par30_pct: '',
  ra_msb_par30_limit: '',
  additional_info: '',
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

// ─── Main component ───

export default function CreditRiskPage() {
  const [conclusions, setConclusions] = useState<CreditConclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [collaterals, setCollaterals] = useState<Collateral[]>([{ type: 'Недвижимость', description: '', address: '', value: 0 }])
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
  const exchangeRate = form.loan_currency !== 'TJS' ? (n('exchange_rate') || 1) : 1
  const loanAmtTJS = loanAmt * exchangeRate
  const rate = n('interest_rate') / 100 / 12
  const months = n('loan_term_months') || 12
  const monthlyPayment = rate > 0
    ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months)))
    : Math.round(loanAmt / months)

  // Покрытие залога (для Смены залога)
  const collateral_total = collaterals.reduce((s, c) => s + (c.value || 0), 0)
  const existing_balance = n('existing_loan_balance')
  const collateral_coverage_pct = existing_balance > 0 ? (collateral_total / existing_balance) * 100 : 0

  // Концентрация / Риск-аппетит
  const smePf      = n('sme_sector_portfolio')
  const bankPf     = n('bank_total_portfolio')
  const raConc     = parseFloat(form.ra_conc_limit)       || 0
  const raPar30    = parseFloat(form.ra_par30_limit)      || 0
  const curPar30Pct    = parseFloat(form.current_par30_pct)     || 0
  const curMsbPar30Pct = parseFloat(form.current_msb_par30_pct) || 0
  const raMsbPar30     = parseFloat(form.ra_msb_par30_limit)    || 0

  // Концентрация МСБ в портфеле банка (доля сектора, не одного заёмщика)
  // loanAmtTJS — сумма кредита, конвертированная в TJS через exchangeRate
  const concSmeNowPct   = smePf > 0 && bankPf > 0 ? (smePf / bankPf) * 100 : 0
  const concSmeAfterPct = bankPf > 0 ? ((smePf + loanAmtTJS) / bankPf) * 100 : 0
  const concViolates    = raConc > 0 && concSmeAfterPct > raConc
  // Доля одного заёмщика в МСБ-портфеле (справочно)
  const borrowerInSmePct = smePf > 0 && loanAmtTJS > 0 ? (loanAmtTJS / smePf) * 100 : 0

  // PAR30 по всему портфелю банка
  const par30Delta    = bankPf > 0 && loanAmtTJS > 0 ? (loanAmtTJS / bankPf) * 100 : 0
  const par30After    = curPar30Pct + par30Delta
  const par30Violates = raPar30 > 0 && par30After > raPar30

  // PAR30 по портфелю МСБ
  const par30MsbDelta    = smePf > 0 && loanAmtTJS > 0 ? (loanAmtTJS / smePf) * 100 : 0
  const par30MsbAfter    = curMsbPar30Pct + par30MsbDelta
  const par30MsbViolates = raMsbPar30 > 0 && par30MsbAfter > raMsbPar30

  // ── Financial ratios (for Tab 2 — populated via image extraction) ──
  const rv = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(2) : '—'
  const pv = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(1) + '%' : '—'
  const p1_curr_ratio = p1_total_cl > 0 ? p1_total_ca / p1_total_cl : NaN
  const p2_curr_ratio = p2_total_cl > 0 ? p2_total_ca / p2_total_cl : NaN
  const p1_quick_ratio = p1_total_cl > 0 ? (p1_total_ca - n('p1_inventory')) / p1_total_cl : NaN
  const p2_quick_ratio = p2_total_cl > 0 ? (p2_total_ca - n('p2_inventory')) / p2_total_cl : NaN
  const p1_leverage = p1_total_liab > 0 ? p1_total_equity / p1_total_liab : NaN
  const p2_leverage = p2_total_liab > 0 ? p2_total_equity / p2_total_liab : NaN
  const p1_roa = p1_total_assets > 0 ? (p1_net / p1_total_assets) * 100 : NaN
  const p2_roa = p2_total_assets > 0 ? (p2_net / p2_total_assets) * 100 : NaN
  const p1_roe = p1_total_equity > 0 ? (p1_net / p1_total_equity) * 100 : NaN
  const p2_roe = p2_total_equity > 0 ? (p2_net / p2_total_equity) * 100 : NaN
  const hasFinData = p1_total_assets > 0 || n('p1_net_rev') > 0

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
      exchange_rate: c.exchange_rate ? String(c.exchange_rate) : '',
      sme_sector_portfolio: c.sme_sector_portfolio ? String(Math.round(c.sme_sector_portfolio)) : '',
      bank_total_portfolio: c.bank_total_portfolio ? String(Math.round(c.bank_total_portfolio)) : '',
      ra_conc_limit: c.ra_conc_limit ? String(c.ra_conc_limit) : '',
      current_par30_pct: c.current_par30_pct ? String(c.current_par30_pct) : '',
      ra_par30_limit: c.ra_par30_limit ? String(c.ra_par30_limit) : '',
      current_msb_par30_pct: c.current_msb_par30_pct ? String(c.current_msb_par30_pct) : '',
      ra_msb_par30_limit: c.ra_msb_par30_limit ? String(c.ra_msb_par30_limit) : '',
      additional_info: c.additional_info || '',
    })
    setCollaterals(c.collaterals?.length ? c.collaterals.map(col => ({ ...col, address: col.address || '' })) : [{ type: 'Недвижимость', description: '', address: '', value: 0 }])
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
    setCollaterals([{ type: 'Недвижимость', description: '', address: '', value: 0 }])
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
        additional_info: form.additional_info || '',
        existing_loan_balance: n('existing_loan_balance'),
        p1_gross, p2_gross, p1_op_profit, p2_op_profit,
        p1_ebt, p2_ebt, p1_net, p2_net,
        p1_total_assets, p2_total_assets,
        p1_total_liabilities: p1_total_liab, p2_total_liabilities: p2_total_liab,
        p1_total_ca, p2_total_ca,
        p1_total_cl, p2_total_cl,
        p1_total_equity, p2_total_equity,
        p1_cf_net_op, p2_cf_net_op,
        p1_cf_net_inv, p2_cf_net_inv,
        p1_cf_net_fin, p2_cf_net_fin,
        p1_cf_cash_end: p1_cash_end, p2_cf_cash_end: p2_cash_end,
        monthly_payment: monthlyPayment,
        collateral_total, collateral_coverage_pct,
        // Концентрация МСБ в портфеле банка
        concentration_sme_now_pct:   concSmeNowPct   > 0 ? Math.round(concSmeNowPct   * 100) / 100 : null,
        concentration_sme_after_pct: concSmeAfterPct > 0 ? Math.round(concSmeAfterPct * 100) / 100 : null,
        borrower_in_sme_pct:         borrowerInSmePct > 0 ? Math.round(borrowerInSmePct * 100) / 100 : null,
        risk_appetite_conc_pct:      raConc  || null,
        concentration_violates:      concViolates,
        // PAR30 — общий портфель банка
        current_par30_pct:           curPar30Pct   || null,
        par30_delta_pct:             par30Delta > 0 ? Math.round(par30Delta * 100) / 100 : null,
        par30_after_pct:             curPar30Pct > 0 && par30Delta > 0 ? Math.round(par30After * 100) / 100 : null,
        risk_appetite_par30_pct:     raPar30   || null,
        par30_violates:              par30Violates,
        // PAR30 — портфель МСБ
        current_msb_par30_pct:       curMsbPar30Pct || null,
        par30_msb_delta_pct:         par30MsbDelta > 0 ? Math.round(par30MsbDelta * 100) / 100 : null,
        par30_msb_after_pct:         curMsbPar30Pct > 0 && par30MsbDelta > 0 ? Math.round(par30MsbAfter * 100) / 100 : null,
        risk_appetite_msb_par30_pct: raMsbPar30 || null,
        par30_msb_violates:          par30MsbViolates,
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
        collaterals, guarantors,
        exchange_rate: form.loan_currency !== 'TJS' ? (n('exchange_rate') || null) : null,
        sme_sector_portfolio:  n('sme_sector_portfolio') || null,
        bank_total_portfolio:  n('bank_total_portfolio') || null,
        ra_conc_limit:         raConc       || null,
        current_par30_pct:     curPar30Pct  || null,
        ra_par30_limit:        raPar30      || null,
        current_msb_par30_pct: curMsbPar30Pct || null,
        ra_msb_par30_limit:    raMsbPar30   || null,
        additional_info: form.additional_info || null,
        ai_conclusion: data.conclusion,
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
  const recColor = (r: string) => r === 'Не рекомендуется' ? 'text-red-600' : 'text-green-600'

  const parseAISection = (text: string, key: string): string => {
    const marker = `[${key}]`
    const idx = text.indexOf(marker)
    if (idx === -1) return ''
    const start = idx + marker.length
    const siblings = ['[ХАРАКТЕРИСТИКА ЗАЁМЩИКА]', '[ОБОСНОВАНИЕ ОПЕРАЦИИ]', '[ОЦЕНКА РИСКОВ]', '[РЕШЕНИЕ И ОБОСНОВАНИЕ]']
    let end = text.length
    for (const m of siblings) {
      if (m === marker) continue
      const i = text.indexOf(m, start)
      if (i > -1 && i < end) end = i
    }
    const stopAt = text.indexOf('Руководитель СУР', start)
    if (stopAt > -1 && stopAt < end) end = stopAt
    const stopRec = text.indexOf('РЕКОМЕНДАЦИЯ:', start)
    if (stopRec > -1 && stopRec < end) end = stopRec
    return text.slice(start, end).trim()
  }
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

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Всего заключений', value: conclusions.length, c: 'text-gray-900' },
            { label: 'Рекомендуется', value: conclusions.filter(c => c.recommendation === 'Рекомендуется').length, c: 'text-green-600' },
            { label: 'Не рекомендуется', value: conclusions.filter(c => c.recommendation === 'Не рекомендуется').length, c: 'text-red-600' },
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
              {['№','Заёмщик','Тип','Сумма линии','Риск','Рекомендация','Дата',''].map(h => (
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
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* 1. Общая информация */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">1. Общая информация</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Заёмщик', viewing.borrower_name],
                    ['Кредитная история', viewing.credit_history || '—'],
                    ['Сектор бизнеса', viewing.sector || '—'],
                    ['Вид деятельности', viewing.business_type || '—'],
                    viewing.conclusion_type === 'Увеличение кредитной линии'
                      ? ['Действ. / Желаемый лимит', `${fmt(viewing.existing_loan_balance)} / ${fmt(viewing.loan_amount)} ${viewing.loan_currency}`]
                      : viewing.conclusion_type === 'Смена залога'
                      ? ['Остаток кредита', `${fmt(viewing.existing_loan_balance)} ${viewing.loan_currency}`]
                      : ['Сумма линии', `${fmt(viewing.loan_amount)} ${viewing.loan_currency}`],
                    ['Тип операции', viewing.conclusion_type || '—'],
                    ['Цель', viewing.loan_purpose || '—'],
                    ['Менеджер', viewing.analyst_name || '—'],
                  ].filter((x): x is string[] => x !== null).map(([l, v]) => (
                    <div key={String(l)}><p className="text-xs text-gray-500">{l}</p><p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p></div>
                  ))}
                </div>
                {viewing.ai_conclusion && parseAISection(viewing.ai_conclusion, 'ХАРАКТЕРИСТИКА ЗАЁМЩИКА') && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{parseAISection(viewing.ai_conclusion, 'ХАРАКТЕРИСТИКА ЗАЁМЩИКА')}</p>
                  </div>
                )}
              </div>

              {/* 2. Обеспечение (залог) */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">2. Обеспечение (залог)</p>
                {(viewing.collaterals || []).length === 0
                  ? <p className="text-xs text-gray-400">Залог не указан</p>
                  : <div className="space-y-2">
                    {(viewing.collaterals || []).map((col, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-bold text-gray-400 mt-0.5">#{i+1}</span>
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><p className="text-[10px] text-gray-400">Тип</p><p className="text-xs font-medium">{col.type}</p></div>
                          <div><p className="text-[10px] text-gray-400">Стоимость</p><p className="text-xs font-medium">{fmt(col.value)} TJS</p></div>
                          {col.description && <div><p className="text-[10px] text-gray-400">Описание</p><p className="text-xs">{col.description}</p></div>}
                          {col.address && <div><p className="text-[10px] text-gray-400">Адрес</p><p className="text-xs">{col.address}</p></div>}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs px-1 pt-1">
                      <span className="text-gray-500">Итого залог:</span>
                      <span className="font-bold text-gray-900">{fmt((viewing.collaterals || []).reduce((s, c) => s + (c.value || 0), 0))} TJS</span>
                    </div>
                  </div>
                }
              </div>

              {/* 3. Финансовые коэффициенты */}
              {(() => {
                const vca = (viewing.p1_cash_desk||0)+(viewing.p1_cash_bank||0)+(viewing.p1_st_invest||0)+(viewing.p1_trade_rec||0)+(viewing.p1_other_rec||0)+(viewing.p1_founder_rec||0)+(viewing.p1_inventory||0)+(viewing.p1_prepaid||0)+(viewing.p1_nca_sale||0) || (viewing.p1_cash||0)+(viewing.p1_receivables||0)+(viewing.p1_inventory||0)
                const v2ca = (viewing.p2_cash_desk||0)+(viewing.p2_cash_bank||0)+(viewing.p2_st_invest||0)+(viewing.p2_trade_rec||0)+(viewing.p2_other_rec||0)+(viewing.p2_founder_rec||0)+(viewing.p2_inventory||0)+(viewing.p2_prepaid||0)+(viewing.p2_nca_sale||0) || (viewing.p2_cash||0)+(viewing.p2_receivables||0)+(viewing.p2_inventory||0)
                const vnca = (viewing.p1_ppe||0)+(viewing.p1_nat_res||0)+(viewing.p1_intangibles||0)+(viewing.p1_bio_assets||0)+(viewing.p1_invest_prop||0)+(viewing.p1_lt_invest||0)+(viewing.p1_def_tax_asset||0)+(viewing.p1_lt_rec||0) || (viewing.p1_fixed_assets||0)+(viewing.p1_other_assets||0)
                const v2nca = (viewing.p2_ppe||0)+(viewing.p2_nat_res||0)+(viewing.p2_intangibles||0)+(viewing.p2_bio_assets||0)+(viewing.p2_invest_prop||0)+(viewing.p2_lt_invest||0)+(viewing.p2_def_tax_asset||0)+(viewing.p2_lt_rec||0) || (viewing.p2_fixed_assets||0)+(viewing.p2_other_assets||0)
                const va = vca + vnca; const v2a = v2ca + v2nca
                const vcl = (viewing.p1_trade_pay||0)+(viewing.p1_st_debt||0)+(viewing.p1_accrued||0)+(viewing.p1_taxes_pay||0)+(viewing.p1_exp_reserves||0)+(viewing.p1_other_st_liab||0) || (viewing.p1_supplier_debt||0)+(viewing.p1_bank_debt||0)
                const v2cl = (viewing.p2_trade_pay||0)+(viewing.p2_st_debt||0)+(viewing.p2_accrued||0)+(viewing.p2_taxes_pay||0)+(viewing.p2_exp_reserves||0)+(viewing.p2_other_st_liab||0) || (viewing.p2_supplier_debt||0)+(viewing.p2_bank_debt||0)
                const ve = (viewing.p1_charter_cap||0)+(viewing.p1_add_cap||0)+(viewing.p1_retained||0)+(viewing.p1_reserve_cap||0)+(viewing.p1_minority||0) || (viewing.p1_equity_capital||0)+(viewing.p1_reserves||0)+(viewing.p1_retained_earnings||0)
                const v2e = (viewing.p2_charter_cap||0)+(viewing.p2_add_cap||0)+(viewing.p2_retained||0)+(viewing.p2_reserve_cap||0)+(viewing.p2_minority||0) || (viewing.p2_equity_capital||0)+(viewing.p2_reserves||0)+(viewing.p2_retained_earnings||0)
                const vrev = (viewing.p1_net_rev||0)||(viewing.p1_revenue||0); const v2rev = (viewing.p2_net_rev||0)||(viewing.p2_revenue||0)
                const vnet = (viewing.p1_net_profit||0); const v2net = (viewing.p2_net_profit||0)
                const vr = (v: number) => isFinite(v) && !isNaN(v) && v !== 0 ? v.toFixed(2) : '—'
                const vp = (v: number) => isFinite(v) && !isNaN(v) && v !== 0 ? v.toFixed(1)+'%' : '—'
                if (va === 0 && vrev === 0) return null
                const ctl1 = vcl > 0 ? vca/vcl : NaN; const ctl2 = v2cl > 0 ? v2ca/v2cl : NaN
                const roa2 = v2a > 0 ? (v2net/v2a)*100 : NaN
                const roe2 = v2e > 0 ? (v2net/v2e)*100 : NaN
                return (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">3. Финансовые коэффициенты</p>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-gray-50 text-gray-500"><th className="text-left px-3 py-1.5 font-medium">Показатель</th><th className="text-center px-2 py-1.5">П1</th><th className="text-center px-2 py-1.5">П2</th><th className="text-center px-2 py-1.5">Норма</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {vrev > 0 && <tr><td className="px-3 py-1.5 text-gray-600">Чистая выручка</td><td className="text-center px-2 py-1.5">{fmt(vrev)}</td><td className="text-center px-2 py-1.5 font-medium">{fmt(v2rev)}</td><td className="text-center px-2 py-1.5 text-gray-400">—</td></tr>}
                          {(vnet !== 0 || v2net !== 0) && <tr><td className="px-3 py-1.5 text-gray-600">Чистая прибыль</td><td className="text-center px-2 py-1.5">{fmt(vnet)}</td><td className="text-center px-2 py-1.5 font-medium">{fmt(v2net)}</td><td className="text-center px-2 py-1.5 text-gray-400">&gt;0</td></tr>}
                          {vcl > 0 && <tr><td className="px-3 py-1.5 text-gray-600">Ктл (ликвидность)</td><td className="text-center px-2 py-1.5">{vr(ctl1)}</td><td className="text-center px-2 py-1.5 font-medium">{vr(ctl2)}</td><td className="text-center px-2 py-1.5 text-gray-400">&gt;2.0</td></tr>}
                          {v2a > 0 && <tr><td className="px-3 py-1.5 text-gray-600">ROA</td><td className="text-center px-2 py-1.5">—</td><td className="text-center px-2 py-1.5 font-medium">{vp(roa2)}</td><td className="text-center px-2 py-1.5 text-gray-400">&gt;6%</td></tr>}
                          {v2e > 0 && <tr><td className="px-3 py-1.5 text-gray-600">ROE</td><td className="text-center px-2 py-1.5">—</td><td className="text-center px-2 py-1.5 font-medium">{vp(roe2)}</td><td className="text-center px-2 py-1.5 text-gray-400">&gt;20%</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}

              {/* 4. Концентрация */}
              {(viewing.sme_sector_portfolio || viewing.bank_total_portfolio) && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">4. Концентрация</p>
                  {(() => {
                    const vSme   = viewing.sme_sector_portfolio || 0
                    const vBank  = viewing.bank_total_portfolio  || 0
                    const vLoan  = viewing.loan_amount           || 0
                    const vRate  = viewing.loan_currency !== 'TJS' ? (viewing.exchange_rate || 1) : 1
                    const vLoanTJS = vLoan * vRate
                    const vLimit = viewing.ra_conc_limit         || 0
                    const vNow   = vSme > 0 && vBank > 0 ? (vSme / vBank) * 100 : 0
                    const vAfter = vBank > 0 ? ((vSme + vLoanTJS) / vBank) * 100 : 0
                    const vVio   = vLimit > 0 && vAfter > vLimit
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                          {vNow > 0 && (
                            <div className="p-3 rounded-xl border-2 bg-gray-50 border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Доля МСБ в портфеле (до)</p>
                              <p className="text-xl font-bold text-gray-800">{vNow.toFixed(2)}%</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Intl.NumberFormat('ru-RU').format(vSme)} / {new Intl.NumberFormat('ru-RU').format(vBank)} TJS</p>
                            </div>
                          )}
                          {vAfter > 0 && vLoanTJS > 0 && (
                            <div className={`p-3 rounded-xl border-2 ${vVio ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                              <p className="text-xs text-gray-500 mb-1">Доля МСБ в портфеле (после)</p>
                              <p className={`text-xl font-bold ${vVio ? 'text-red-700' : 'text-green-700'}`}>{vAfter.toFixed(2)}%</p>
                              {vLimit > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{vVio ? '❌' : '✅'} Лимит: {vLimit}%</p>}
                            </div>
                          )}
                        </div>
                        {vSme > 0 && vLoanTJS > 0 && (
                          <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">Доля заёмщика в МСБ-портфеле (справочно): <span className="font-bold">{(vLoanTJS/vSme*100).toFixed(2)}%</span></p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* 5. Риск-аппетит */}
              {(viewing.current_msb_par30_pct != null || viewing.current_par30_pct != null) && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">5. Риск-аппетит</p>
                  <div className="space-y-3">
                    {/* PAR30 МСБ */}
                    {viewing.current_msb_par30_pct != null && viewing.sme_sector_portfolio && viewing.loan_amount ? (() => {
                      const vRate = viewing.loan_currency !== 'TJS' ? (viewing.exchange_rate || 1) : 1
                      const delta = viewing.loan_amount * vRate / viewing.sme_sector_portfolio * 100
                      const after = (viewing.current_msb_par30_pct || 0) + delta
                      const vio   = viewing.ra_msb_par30_limit && after > viewing.ra_msb_par30_limit
                      return (
                        <div className={`p-3 rounded-xl border-2 ${vio ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                          <p className="text-xs font-semibold text-gray-600">PAR30 МСБ-портфеля</p>
                          <p className="text-[10px] text-blue-500 mb-2">Информационно — не является критерием вердикта</p>
                          <div className="grid grid-cols-3 gap-2 text-xs text-center">
                            <div><p className="text-gray-400">Сейчас</p><p className="font-bold text-lg">{viewing.current_msb_par30_pct.toFixed(2)}%</p></div>
                            <div><p className="text-gray-400">Прирост</p><p className="font-bold text-lg text-orange-600">+{delta.toFixed(2)}%</p></div>
                            <div><p className="text-gray-400">После</p><p className={`font-bold text-lg ${vio ? 'text-red-700' : 'text-green-700'}`}>{after.toFixed(2)}%</p></div>
                          </div>
                          {viewing.ra_msb_par30_limit && (
                            <p className={`text-xs font-bold mt-2 ${vio ? 'text-red-700' : 'text-green-700'}`}>
                              {vio ? `❌ Нарушает лимит МСБ ${viewing.ra_msb_par30_limit}%` : `✅ В пределах лимита МСБ ${viewing.ra_msb_par30_limit}%`}
                            </p>
                          )}
                        </div>
                      )
                    })() : null}
                    {/* PAR30 общего портфеля */}
                    {viewing.current_par30_pct != null && viewing.bank_total_portfolio && viewing.loan_amount ? (() => {
                      const vRate = viewing.loan_currency !== 'TJS' ? (viewing.exchange_rate || 1) : 1
                      const delta = viewing.loan_amount * vRate / viewing.bank_total_portfolio * 100
                      const after = (viewing.current_par30_pct || 0) + delta
                      const vio   = viewing.ra_par30_limit && after > viewing.ra_par30_limit
                      return (
                        <div className={`p-3 rounded-xl border-2 ${vio ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                          <p className="text-xs font-semibold text-gray-600">PAR30 общего портфеля банка</p>
                          <p className="text-[10px] text-orange-500 mb-2">Нарушение = основание для «Не рекомендуется»</p>
                          <div className="grid grid-cols-3 gap-2 text-xs text-center">
                            <div><p className="text-gray-400">Сейчас</p><p className="font-bold text-lg">{viewing.current_par30_pct.toFixed(2)}%</p></div>
                            <div><p className="text-gray-400">Прирост</p><p className="font-bold text-lg text-orange-600">+{delta.toFixed(2)}%</p></div>
                            <div><p className="text-gray-400">После</p><p className={`font-bold text-lg ${vio ? 'text-red-700' : 'text-green-700'}`}>{after.toFixed(2)}%</p></div>
                          </div>
                          {viewing.ra_par30_limit && (
                            <p className={`text-xs font-bold mt-2 ${vio ? 'text-red-700' : 'text-green-700'}`}>
                              {vio ? `❌ Нарушает лимит банка ${viewing.ra_par30_limit}%` : `✅ В пределах лимита банка ${viewing.ra_par30_limit}%`}
                            </p>
                          )}
                        </div>
                      )
                    })() : null}
                  </div>
                </div>
              )}

              {/* 6. Обоснование операции (only for new records with section markers) */}
              {viewing.ai_conclusion && parseAISection(viewing.ai_conclusion, 'ОБОСНОВАНИЕ ОПЕРАЦИИ') && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-2">6. Обоснование операции</p>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {parseAISection(viewing.ai_conclusion, 'ОБОСНОВАНИЕ ОПЕРАЦИИ')}
                    </p>
                  </div>
                </div>
              )}

              {/* 7. Заключение СУР */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 mb-3">7. Заключение Службы управления рисками</p>
                <div className="space-y-3">
                  {viewing.ai_conclusion && parseAISection(viewing.ai_conclusion, 'ОЦЕНКА РИСКОВ') && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Оценка рисков</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {parseAISection(viewing.ai_conclusion, 'ОЦЕНКА РИСКОВ')}
                      </p>
                    </div>
                  )}
                  {viewing.ai_conclusion && parseAISection(viewing.ai_conclusion, 'РЕШЕНИЕ И ОБОСНОВАНИЕ') && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Решение и обоснование</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {parseAISection(viewing.ai_conclusion, 'РЕШЕНИЕ И ОБОСНОВАНИЕ')}
                      </p>
                    </div>
                  )}
                  {/* Fallback: old records without section markers */}
                  {viewing.ai_conclusion && !parseAISection(viewing.ai_conclusion, 'ОЦЕНКА РИСКОВ') && !parseAISection(viewing.ai_conclusion, 'РЕШЕНИЕ И ОБОСНОВАНИЕ') && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{viewing.ai_conclusion}</p>
                    </div>
                  )}
                  <div className={`p-4 rounded-xl border-2 ${viewing.recommendation === 'Не рекомендуется' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-xs text-gray-500 mb-1">Рекомендация</p>
                    <p className={`text-xl font-bold ${recColor(viewing.recommendation)}`}>{viewing.recommendation}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Руководитель СУР</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">Сангинова Ф.</p>
                      <p className="text-xs text-gray-400 mt-2 border-t border-dashed border-gray-300 pt-2">Подпись ________________</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Менеджер</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{viewing.analyst_name || '—'}</p>
                      <p className="text-xs text-gray-400 mt-2 border-t border-dashed border-gray-300 pt-2">Подпись ________________</p>
                    </div>
                  </div>
                </div>
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
              {[{n:1,t:'Заёмщик'},{n:2,t:'Фин. коэф.'},{n:3,t:'Залог'},{n:4,t:'Концентрация'},{n:5,t:'Риск-аппетит'},{n:6,t:'Дополнение'}].map(({n:tn,t}) => (
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

                  <div><label className={lbl}>Валюта</label><select value={form.loan_currency} onChange={e => { setF('loan_currency', e.target.value); setF('exchange_rate', '') }} className={inp}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>

                  {form.loan_currency !== 'TJS' && (
                    <div>
                      <label className={lbl}>Курс {form.loan_currency}/TJS на дату отчётности *</label>
                      <input type="text" inputMode="decimal"
                        value={form.exchange_rate}
                        onChange={e => setF('exchange_rate', e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="11.50" className={inp} />
                      <p className="text-xs text-gray-400 mt-1">
                        Используется для расчёта концентрации и PAR30 в сомони
                        {form.exchange_rate && loanAmt > 0
                          ? ` → ${fmt(loanAmtTJS)} TJS`
                          : ''}
                      </p>
                    </div>
                  )}

                  <div><label className={lbl}>Менеджер</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className={inp} /></div>
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

              {/* Tab 2: Финансовые коэффициенты */}
              {tab === 2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                    <Upload className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-blue-700 font-medium">Финансовые коэффициенты из скриншота</p>
                      <p className="text-xs text-blue-500 mt-0.5">Загрузите скриншот(ы) финансовой отчётности через вкладку «Загрузить скрин» — AI автоматически извлечёт данные и рассчитает коэффициенты ниже.</p>
                    </div>
                  </div>
                  {!hasFinData ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <FileText className="w-10 h-10 text-gray-200" />
                      <p className="text-sm text-gray-400">Нет финансовых данных</p>
                      <p className="text-xs text-gray-300">Используйте «Загрузить скрин» для автозаполнения</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#1B8A4C] text-white">
                            <th className="text-left px-3 py-2 font-medium">Показатель</th>
                            <th className="text-center px-3 py-2 font-medium">{form.p1_label || 'П1'}</th>
                            <th className="text-center px-3 py-2 font-medium">{form.p2_label || 'П2'}</th>
                            <th className="text-center px-3 py-2 font-medium">Норма</th>
                            <th className="text-center px-3 py-2 font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {[
                            { label: 'Чистая выручка, TJS', v1: n('p1_net_rev') ? new Intl.NumberFormat('ru-RU').format(Math.round(n('p1_net_rev'))) : '—', v2: n('p2_net_rev') ? new Intl.NumberFormat('ru-RU').format(Math.round(n('p2_net_rev'))) : '—', norm: '—', ok: null },
                            { label: 'Чистая прибыль, TJS', v1: new Intl.NumberFormat('ru-RU').format(Math.round(p1_net)), v2: new Intl.NumberFormat('ru-RU').format(Math.round(p2_net)), norm: '>0', ok: p2_net > 0 },
                            { label: 'Ктл (текущая ликвидность)', v1: rv(p1_curr_ratio), v2: rv(p2_curr_ratio), norm: '>2.0', ok: isFinite(p2_curr_ratio) ? p2_curr_ratio > 2.0 : null },
                            { label: 'Кбл (быстрая ликвидность)', v1: rv(p1_quick_ratio), v2: rv(p2_quick_ratio), norm: '>1.0', ok: isFinite(p2_quick_ratio) ? p2_quick_ratio > 1.0 : null },
                            { label: 'ROA (рентабельность активов)', v1: pv(p1_roa), v2: pv(p2_roa), norm: '>6%', ok: isFinite(p2_roa) ? p2_roa > 6 : null },
                            { label: 'ROE (рентабельность капитала)', v1: pv(p1_roe), v2: pv(p2_roe), norm: '>20%', ok: isFinite(p2_roe) ? p2_roe > 20 : null },
                            { label: 'Кфин (леверидж Капитал/Долг)', v1: rv(p1_leverage), v2: rv(p2_leverage), norm: '≤0.5', ok: isFinite(p2_leverage) ? p2_leverage <= 0.5 : null },
                            { label: 'Опер. ден. поток, TJS', v1: new Intl.NumberFormat('ru-RU').format(Math.round(p1_cf_net_op)), v2: new Intl.NumberFormat('ru-RU').format(Math.round(p2_cf_net_op)), norm: '>0', ok: p2_cf_net_op > 0 },
                          ].map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700 font-medium">{row.label}</td>
                              <td className="px-3 py-2 text-center text-gray-600">{row.v1}</td>
                              <td className="px-3 py-2 text-center text-gray-900 font-semibold">{row.v2}</td>
                              <td className="px-3 py-2 text-center text-gray-400">{row.norm}</td>
                              <td className="px-3 py-2 text-center">
                                {row.ok === null ? <span className="text-gray-300">—</span> : row.ok ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-500 font-bold">✗</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Концентрация */}
              {tab === 4 && (
                <div className="space-y-5">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">Анализ концентрации кредитного риска МСБ</p>
                    <p className="text-xs text-blue-500 mt-0.5">Показывает долю сектора МСБ в общем кредитном портфеле банка до и после выдачи кредита. PAR30 анализируется на вкладке «Риск-аппетит».</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Портфель МСБ банка (TJS)</label>
                      <input type="text" inputMode="numeric"
                        value={form.sme_sector_portfolio ? new Intl.NumberFormat('ru-RU').format(Number(form.sme_sector_portfolio)) : ''}
                        onChange={e => setF('sme_sector_portfolio', e.target.value.replace(/[^0-9]/g,''))}
                        placeholder="0" className={inp} />
                      <p className="text-xs text-gray-400 mt-1">Текущий портфель МСБ банка до выдачи</p>
                    </div>
                    <div>
                      <label className={lbl}>Общий кредитный портфель банка (TJS)</label>
                      <input type="text" inputMode="numeric"
                        value={form.bank_total_portfolio ? new Intl.NumberFormat('ru-RU').format(Number(form.bank_total_portfolio)) : ''}
                        onChange={e => setF('bank_total_portfolio', e.target.value.replace(/[^0-9]/g,''))}
                        placeholder="0" className={inp} />
                      <p className="text-xs text-gray-400 mt-1">Общий кредитный портфель банка до выдачи</p>
                    </div>
                    <div className="lg:col-span-2">
                      <label className={lbl}>Лимит концентрации МСБ внутри всего портфеля (%)</label>
                      <input type="text" inputMode="decimal"
                        value={form.ra_conc_limit}
                        onChange={e => setF('ra_conc_limit', e.target.value.replace(/[^0-9.]/g,''))}
                        placeholder="30.00" className={inp} />
                      <p className="text-xs text-gray-400 mt-1">Максимально допустимая доля сектора МСБ в общем кредитном портфеле банка · <span className="italic">например, 25%</span></p>
                    </div>
                  </div>

                  {bankPf > 0 && smePf > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Результаты расчёта</p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border-2 bg-gray-50 border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Доля МСБ сейчас</p>
                          <p className="text-2xl font-bold text-gray-800">{concSmeNowPct.toFixed(2)}%</p>
                          <p className="text-xs text-gray-400 mt-1">{fmt(smePf)} / {fmt(bankPf)} TJS</p>
                        </div>
                        {loanAmtTJS > 0 && (
                          <div className={`p-4 rounded-xl border-2 ${concViolates ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                            <p className="text-xs text-gray-500 mb-1">Доля МСБ после выдачи</p>
                            <p className={`text-2xl font-bold ${concViolates ? 'text-red-700' : 'text-green-700'}`}>
                              {concSmeAfterPct.toFixed(2)}%
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {fmt(smePf + loanAmtTJS)} / {fmt(bankPf)} TJS{raConc > 0 ? ` · лимит: ${raConc}%` : ''}
                            </p>
                            <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${concViolates ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {concViolates ? '❌ Нарушает лимит концентрации' : '✅ В пределах лимита'}
                            </div>
                          </div>
                        )}
                      </div>
                      {loanAmtTJS > 0 && smePf > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-xs text-blue-600">Доля этого заёмщика в МСБ-портфеле (справочно): <span className="font-bold">{borrowerInSmePct.toFixed(2)}%</span> ({fmt(loanAmtTJS)} / {fmt(smePf)} TJS)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Риск-аппетит */}
              {tab === 5 && (
                <div className="space-y-5">
                  <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                    <p className="text-xs text-orange-700 font-medium">Анализ риск-аппетита — PAR30</p>
                    <p className="text-xs text-orange-500 mt-0.5">Оценка влияния выдачи кредита на PAR30 МСБ-портфеля и общего портфеля банка при уходе заёмщика в просрочку.</p>
                  </div>

                  {/* PAR30 МСБ-портфеля */}
                  <div>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">PAR30 портфеля МСБ</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Текущий PAR30 портфеля МСБ (%)</label>
                        <input type="text" inputMode="decimal"
                          value={form.current_msb_par30_pct}
                          onChange={e => setF('current_msb_par30_pct', e.target.value.replace(/[^0-9.]/g,''))}
                          placeholder="3.50" className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Текущий PAR30 по кредитному портфелю МСБ банка</p>
                      </div>
                      <div>
                        <label className={lbl}>Риск-аппетит PAR30 для портфеля МСБ (%)</label>
                        <input type="text" inputMode="decimal"
                          value={form.ra_msb_par30_limit}
                          onChange={e => setF('ra_msb_par30_limit', e.target.value.replace(/[^0-9.]/g,''))}
                          placeholder="7.00" className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Лимит риск-аппетита по PAR30 для МСБ-портфеля · <span className="italic">например, 2%</span></p>
                      </div>
                    </div>
                    {smePf > 0 && loanAmtTJS > 0 && (
                      <div className={`mt-3 p-4 rounded-xl border-2 ${par30MsbViolates ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Влияние на PAR30 МСБ при уходе заёмщика в просрочку</p>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="bg-white rounded-lg p-3 text-center">
                            <p className="text-gray-400 mb-1">PAR30 МСБ сейчас</p>
                            <p className="text-xl font-bold text-gray-900">{curMsbPar30Pct > 0 ? `${curMsbPar30Pct.toFixed(2)}%` : '—'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center">
                            <p className="text-gray-400 mb-1">Прирост</p>
                            <p className="text-xl font-bold text-orange-600">+{par30MsbDelta.toFixed(2)}%</p>
                          </div>
                          <div className={`rounded-lg p-3 text-center ${par30MsbViolates ? 'bg-red-100' : 'bg-green-100'}`}>
                            <p className="text-gray-400 mb-1">PAR30 МСБ после</p>
                            <p className={`text-xl font-bold ${par30MsbViolates ? 'text-red-700' : 'text-green-700'}`}>
                              {curMsbPar30Pct > 0 ? `${par30MsbAfter.toFixed(2)}%` : `+${par30MsbDelta.toFixed(2)}%`}
                            </p>
                          </div>
                        </div>
                        {raMsbPar30 > 0 && (
                          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${par30MsbViolates ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {par30MsbViolates ? `❌ Нарушает лимит PAR30 МСБ (${raMsbPar30}%)` : `✅ В пределах лимита PAR30 МСБ (${raMsbPar30}%)`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    {/* PAR30 общего портфеля банка */}
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">PAR30 общего портфеля банка</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Текущий PAR30 общего портфеля (%)</label>
                        <input type="text" inputMode="decimal"
                          value={form.current_par30_pct}
                          onChange={e => setF('current_par30_pct', e.target.value.replace(/[^0-9.]/g,''))}
                          placeholder="2.50" className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Текущий PAR30 по всему кредитному портфелю банка</p>
                      </div>
                      <div>
                        <label className={lbl}>Риск-аппетит PAR30 для общего портфеля (%)</label>
                        <input type="text" inputMode="decimal"
                          value={form.ra_par30_limit}
                          onChange={e => setF('ra_par30_limit', e.target.value.replace(/[^0-9.]/g,''))}
                          placeholder="5.00" className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Лимит риск-аппетита по PAR30 для общего портфеля · <span className="italic">например, 10%</span></p>
                      </div>
                    </div>
                    {bankPf > 0 && loanAmtTJS > 0 && (
                      <div className={`mt-3 p-4 rounded-xl border-2 ${par30Violates ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Влияние на PAR30 общего портфеля при уходе заёмщика в просрочку</p>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="bg-white rounded-lg p-3 text-center">
                            <p className="text-gray-400 mb-1">PAR30 сейчас</p>
                            <p className="text-xl font-bold text-gray-900">{curPar30Pct > 0 ? `${curPar30Pct.toFixed(2)}%` : '—'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center">
                            <p className="text-gray-400 mb-1">Прирост</p>
                            <p className="text-xl font-bold text-orange-600">+{par30Delta.toFixed(2)}%</p>
                          </div>
                          <div className={`rounded-lg p-3 text-center ${par30Violates ? 'bg-red-100' : 'bg-green-100'}`}>
                            <p className="text-gray-400 mb-1">PAR30 после</p>
                            <p className={`text-xl font-bold ${par30Violates ? 'text-red-700' : 'text-green-700'}`}>
                              {curPar30Pct > 0 ? `${par30After.toFixed(2)}%` : `+${par30Delta.toFixed(2)}%`}
                            </p>
                          </div>
                        </div>
                        {raPar30 > 0 && (
                          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${par30Violates ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {par30Violates ? `❌ Нарушает лимит PAR30 банка (${raPar30}%)` : `✅ В пределах лимита PAR30 банка (${raPar30}%)`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {(bankPf === 0 || loanAmtTJS === 0) && smePf === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Заполните портфель МСБ и банка на вкладке «Концентрация», сумму линии — на вкладке «Заёмщик»</p>
                  )}
                </div>
              )}

              {/* Tab 6: Дополнение */}
              {tab === 6 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">Дополнительная информация о заёмщике</p>
                    <p className="text-xs text-blue-500 mt-0.5">Укажите любую информацию, которую AI должен учесть при составлении заключения: репутация, рыночная ситуация, связанные стороны, история отношений с банком, особые обстоятельства и т.д.</p>
                  </div>
                  <div>
                    <label className={lbl}>Комментарий аналитика</label>
                    <textarea
                      value={form.additional_info || ''}
                      onChange={e => setF('additional_info', e.target.value)}
                      rows={10}
                      placeholder={'Например:\n— Заёмщик является крупным поставщиком стройматериалов в регионе, имеет долгосрочные контракты с госструктурами\n— Ранее кредитовался в 2022 году, погасил досрочно\n— Учредитель имеет дополнительный бизнес (ресторан), не отражённый в текущей отчётности\n— В 4 квартале ожидается крупная сделка...'}
                      className={inp + ' resize-y text-sm leading-relaxed'}
                    />
                    <p className="text-xs text-gray-400 mt-1">{(form.additional_info || '').length} символов</p>
                  </div>
                </div>
              )}

              {/* Tab 3: Залог */}
              {tab === 3 && (
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
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div><label className={lbl}>Тип залога</label>
                          <select value={col.type} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,type:e.target.value} : c))} className={inp}>
                            {COLLATERAL_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select></div>
                        <div><label className={lbl}>Стоимость (TJS)</label>
                          <input type="text" inputMode="numeric"
                          value={col.value ? new Intl.NumberFormat('ru-RU').format(col.value) : ''}
                          onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,value:Number(e.target.value.replace(/[^0-9]/g,''))} : c))}
                          placeholder="0" className={inp} /></div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div><label className={lbl}>Описание залога</label>
                          <input type="text" value={col.description} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,description:e.target.value} : c))} placeholder="Марка, характеристики..." className={inp} /></div>
                        <div><label className={lbl}>Адрес залога</label>
                          <input type="text" value={col.address || ''} onChange={e => setCollaterals(p => p.map((c,i) => i===idx ? {...c,address:e.target.value} : c))} placeholder="г. Душанбе, ул. ..." className={inp} /></div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setCollaterals(p => [...p, {type:'Недвижимость',description:'',address:'',value:0}])}
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
                    {tab < 6
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

'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Download, Eye, Trash2, X, AlertTriangle, CheckCircle, Filter } from 'lucide-react'

interface StressTest {
  id: string
  test_name: string
  analyst_name: string
  test_date: string
  scenario: string
  due_to_banks: number
  current_accounts: number
  electronic_wallet: number
  savings: number
  term_deposits: number
  borrowings: number
  other_liabilities: number
  credit_line_salom: number
  credit_line_sme: number
  cash_equivalents: number
  cash_only: number
  outflow_t1: number; drawdown_t1: number; need_t1: number
  coverage_cash_t1: number; coverage_only_t1: number; risk_t1: string
  outflow_t7: number; drawdown_t7: number; need_t7: number
  coverage_cash_t7: number; coverage_only_t7: number; risk_t7: string
  outflow_t30: number; drawdown_t30: number; need_t30: number
  coverage_cash_t30: number; coverage_only_t30: number; risk_t30: string
  created_at: string
  results?: {
    version?: number
    scenario?: string
    // v1 legacy fields
    exchange_rate?: number
    tjs?: { inputs: Record<string, number>; rates: Record<string, HRate>; t1: HData; t7: HData; t30: HData }
    fx?: { inputs: Record<string, number>; rates: Record<string, HRate>; t1: HData; t7: HData; t30: HData }
    cons?: { t1: HData; t7: HData; t30: HData }
    // v2 fields
    fx_rates?: { usd: number; eur: number; rub: number }
    rates_map?: Record<string, HRate>
    total?: { inputs: Record<string, number>; t1: HData; t7: HData; t30: HData }
    fx_only?: { inputs: Record<string, number>; t1: HData; t7: HData; t30: HData }
    per_row_fx?: Record<string, { cur: string; native: number; tjs: number }>
  }
}

type HRate = { t1: number; t7: number; t30: number }
type ScRates = Record<string, HRate>
type ScenarioName = 'Оптимистичный' | 'Пессимистичный' | 'Катастрофический'
type RatesMap = Record<ScenarioName, ScRates>
type ViewMode = 'TOTAL' | 'FX'
type HData = { liab: number; draw: number; need: number; cov_cash: number; cov_only: number; risk: string }
type CalcResult = { t1: HData; t7: HData; t30: HData }

const ALL_SCENARIOS: RatesMap = {
  'Оптимистичный': {
    due_to_banks:      { t1: 0.10, t7: 0.20, t30: 0.30 },
    current_accounts:  { t1: 0.05, t7: 0.10, t30: 0.15 },
    electronic_wallet: { t1: 0.02, t7: 0.05, t30: 0.08 },
    savings:           { t1: 0.01, t7: 0.03, t30: 0.05 },
    term_deposits:     { t1: 0.01, t7: 0.05, t30: 0.10 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.00 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.02, t7: 0.03, t30: 0.05 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
  'Пессимистичный': {
    due_to_banks:      { t1: 1.00, t7: 1.00, t30: 1.00 },
    current_accounts:  { t1: 0.20, t7: 0.35, t30: 0.50 },
    electronic_wallet: { t1: 0.10, t7: 0.15, t30: 0.20 },
    savings:           { t1: 0.03, t7: 0.07, t30: 0.10 },
    term_deposits:     { t1: 0.05, t7: 0.20, t30: 0.35 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.00 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.05, t7: 0.07, t30: 0.10 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
  'Катастрофический': {
    due_to_banks:      { t1: 1.00, t7: 1.00, t30: 1.00 },
    current_accounts:  { t1: 0.40, t7: 0.60, t30: 0.80 },
    electronic_wallet: { t1: 0.25, t7: 0.40, t30: 0.60 },
    savings:           { t1: 0.10, t7: 0.20, t30: 0.35 },
    term_deposits:     { t1: 0.15, t7: 0.40, t30: 0.60 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.05 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.10, t7: 0.15, t30: 0.20 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
}

const initRates = (): RatesMap => JSON.parse(JSON.stringify(ALL_SCENARIOS))

function calcStress(f: Record<string, number>, scenario: ScenarioName, rm: RatesMap = ALL_SCENARIOS): CalcResult {
  const r = rm[scenario]
  const calc = (h: 't1' | 't7' | 't30'): HData => {
    const liab = (
      (f.due_to_banks      || 0) * (r.due_to_banks?.[h]      || 0) +
      (f.current_accounts  || 0) * (r.current_accounts?.[h]  || 0) +
      (f.electronic_wallet || 0) * (r.electronic_wallet?.[h] || 0) +
      (f.savings           || 0) * (r.savings?.[h]           || 0) +
      (f.term_deposits     || 0) * (r.term_deposits?.[h]     || 0) +
      (f.borrowings        || 0) * (r.borrowings?.[h]        || 0) +
      (f.other_liabilities || 0) * (r.other_liabilities?.[h] || 0)
    )
    const draw = (
      (f.credit_line_salom || 0) * (r.credit_line_salom?.[h] || 0) +
      (f.credit_line_sme   || 0) * (r.credit_line_sme?.[h]   || 0)
    )
    const need = liab + draw
    const cov_cash = need > 0 ? (f.cash_equivalents || 0) / need : 0
    const cov_only = need > 0 ? (f.cash_only || 0) / need : 0
    const risk = cov_only < 1 ? 'High' : cov_cash < 1 ? 'High' : cov_only < 1.1 ? 'Elevated' : cov_cash < 1.1 ? 'Elevated' : 'Normal'
    return { liab, draw, need, cov_cash, cov_only, risk }
  }
  return { t1: calc('t1'), t7: calc('t7'), t30: calc('t30') }
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const formatNum = (v: string) => { const num = v.replace(/\D/g, ''); if (!num) return ''; return new Intl.NumberFormat('ru-RU').format(Number(num)) }
const parseNum = (v: string) => Number(v.replace(/\D/g, '')) || 0

const ALL_ROW_KEYS = [
  'due_to_banks', 'current_accounts', 'electronic_wallet', 'savings', 'term_deposits',
  'borrowings', 'other_liabilities', 'credit_line_salom', 'credit_line_sme',
  'cash_equivalents', 'cash_only',
]

const EMPTY: Record<string, string> = {
  test_name: '', analyst_name: '',
  due_to_banks: '', current_accounts: '', electronic_wallet: '', savings: '',
  term_deposits: '', borrowings: '', other_liabilities: '',
  credit_line_salom: '', credit_line_sme: '',
  cash_equivalents: '', cash_only: '',
  ...Object.fromEntries(ALL_ROW_KEYS.flatMap(k => [
    [k + '_fx_cur', 'none'],
    [k + '_fx_native', ''],
  ])),
  rate_usd: '10.90',
  rate_eur: '11.80',
  rate_rub: '0.12',
}

const SCENARIO_STYLES: Record<ScenarioName, { bg: string; text: string; border: string; badge: string }> = {
  'Оптимистичный':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  badge: 'bg-green-100 text-green-700'  },
  'Пессимистичный':   { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700' },
  'Катастрофический': { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700'      },
}

const LIAB_DEFS = [
  { key: 'due_to_banks',     label: 'Межбанковские обязательства' },
  { key: 'current_accounts', label: 'Текущие счета клиентов' },
  { key: 'electronic_wallet',label: 'Электронный кошелёк' },
  { key: 'savings',          label: 'Накопительные счета' },
  { key: 'term_deposits',    label: 'Срочные депозиты' },
  { key: 'borrowings',       label: 'Заимствования' },
  { key: 'other_liabilities',label: 'Прочие обязательства' },
]
const CL_DEFS = [
  { key: 'credit_line_salom', label: 'Кредитная линия Salom' },
  { key: 'credit_line_sme',   label: 'Кредитная линия SME' },
]

export default function LiquidityPage() {
  const [tests, setTests] = useState<StressTest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [scenario, setScenario] = useState<ScenarioName>('Пессимистичный')
  const [viewMode, setViewMode] = useState<ViewMode>('TOTAL')
  const [customRates, setCustomRates] = useState<RatesMap>(initRates)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<StressTest | null>(null)
  const [viewScenario, setViewScenario] = useState<ScenarioName>('Пессимистичный')
  const [viewViewMode, setViewViewMode] = useState<ViewMode>('TOTAL')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('liquidity_stress_tests').select('*').order('created_at', { ascending: false })
    if (filterYear) query = query.gte('test_date', `${filterYear}-01-01`).lte('test_date', `${filterYear}-12-31`)
    if (filterMonth && filterYear) query = query.gte('test_date', `${filterYear}-${filterMonth}-01`).lte('test_date', `${filterYear}-${filterMonth}-31`)
    const { data } = await query
    setTests(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  const n = (k: string) => parseNum(form[k] || '')
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const setNum = (k: string, v: string) => setForm(p => ({ ...p, [k]: formatNum(v) }))

  const getFxRate = useCallback((cur: string) => {
    if (cur === 'USD') return parseFloat(form.rate_usd) || 0
    if (cur === 'EUR') return parseFloat(form.rate_eur) || 0
    if (cur === 'RUB') return parseFloat(form.rate_rub) || 0
    return 0
  }, [form.rate_usd, form.rate_eur, form.rate_rub])

  const getFxTjs = useCallback((key: string) => {
    const cur = form[key + '_fx_cur']
    if (!cur || cur === 'none') return 0
    return parseNum(form[key + '_fx_native'] || '') * getFxRate(cur)
  }, [form, getFxRate])

  const totalInputs = {
    due_to_banks: n('due_to_banks'), current_accounts: n('current_accounts'),
    electronic_wallet: n('electronic_wallet'), savings: n('savings'), term_deposits: n('term_deposits'),
    borrowings: n('borrowings'), other_liabilities: n('other_liabilities'),
    credit_line_salom: n('credit_line_salom'), credit_line_sme: n('credit_line_sme'),
    cash_equivalents: n('cash_equivalents'), cash_only: n('cash_only'),
  }
  const fxOnlyInputs = {
    due_to_banks: getFxTjs('due_to_banks'), current_accounts: getFxTjs('current_accounts'),
    electronic_wallet: getFxTjs('electronic_wallet'), savings: getFxTjs('savings'),
    term_deposits: getFxTjs('term_deposits'), borrowings: getFxTjs('borrowings'),
    other_liabilities: getFxTjs('other_liabilities'),
    credit_line_salom: getFxTjs('credit_line_salom'), credit_line_sme: getFxTjs('credit_line_sme'),
    cash_equivalents: getFxTjs('cash_equivalents'), cash_only: getFxTjs('cash_only'),
  }

  const updateRate = (key: string, h: 't1' | 't7' | 't30', val: string) => {
    const num = Math.max(0, Math.min(100, parseFloat(val) || 0)) / 100
    setCustomRates(prev => ({
      ...prev,
      [scenario]: { ...prev[scenario], [key]: { ...prev[scenario][key], [h]: num } }
    }))
  }

  const allComputedTotal: Record<ScenarioName, CalcResult> = {
    'Оптимистичный':    calcStress(totalInputs, 'Оптимистичный',    customRates),
    'Пессимистичный':   calcStress(totalInputs, 'Пессимистичный',   customRates),
    'Катастрофический': calcStress(totalInputs, 'Катастрофический', customRates),
  }
  const allComputedFX: Record<ScenarioName, CalcResult> = {
    'Оптимистичный':    calcStress(fxOnlyInputs, 'Оптимистичный',    customRates),
    'Пессимистичный':   calcStress(fxOnlyInputs, 'Пессимистичный',   customRates),
    'Катастрофический': calcStress(fxOnlyInputs, 'Катастрофический', customRates),
  }
  const displayedAll = viewMode === 'TOTAL' ? allComputedTotal : allComputedFX

  const riskColor = (r: string) => r === 'High' ? 'text-red-600 bg-red-50' : r === 'Elevated' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50'
  const riskLabel = (r: string) => r === 'High' ? 'Высокий' : r === 'Elevated' ? 'Повышенный' : 'Нормальный'
  const covColor = (v: number) => v >= 1.1 ? 'text-green-600' : v >= 1 ? 'text-yellow-600' : 'text-red-600'

  async function handleSave() {
    if (!form.test_name.trim()) { setError('Введите название теста'); return }
    setSaving(true); setError(null)
    try {
      const totalResult = calcStress(totalInputs, scenario, customRates)
      const fxResult    = calcStress(fxOnlyInputs, scenario, customRates)

      const perRowFx: Record<string, { cur: string; native: number; tjs: number }> = {}
      for (const key of ALL_ROW_KEYS) {
        const cur = form[key + '_fx_cur']
        if (cur && cur !== 'none') {
          const native = parseNum(form[key + '_fx_native'] || '')
          const tjs = native * getFxRate(cur)
          if (native > 0) perRowFx[key] = { cur, native, tjs }
        }
      }

      const resultsPayload = {
        version: 2,
        scenario,
        fx_rates: {
          usd: parseFloat(form.rate_usd) || 0,
          eur: parseFloat(form.rate_eur) || 0,
          rub: parseFloat(form.rate_rub) || 0,
        },
        rates_map: customRates[scenario],
        total: { inputs: { ...totalInputs }, t1: totalResult.t1, t7: totalResult.t7, t30: totalResult.t30 },
        fx_only: { inputs: { ...fxOnlyInputs }, t1: fxResult.t1, t7: fxResult.t7, t30: fxResult.t30 },
        per_row_fx: perRowFx,
      }

      const { error: dbErr } = await supabase.from('liquidity_stress_tests').insert({
        test_name: form.test_name, analyst_name: form.analyst_name,
        scenario,
        test_date: new Date().toISOString().split('T')[0],
        ...totalInputs,
        outflow_t1: totalResult.t1.liab, drawdown_t1: totalResult.t1.draw, need_t1: totalResult.t1.need,
        coverage_cash_t1: totalResult.t1.cov_cash, coverage_only_t1: totalResult.t1.cov_only, risk_t1: totalResult.t1.risk,
        outflow_t7: totalResult.t7.liab, drawdown_t7: totalResult.t7.draw, need_t7: totalResult.t7.need,
        coverage_cash_t7: totalResult.t7.cov_cash, coverage_only_t7: totalResult.t7.cov_only, risk_t7: totalResult.t7.risk,
        outflow_t30: totalResult.t30.liab, drawdown_t30: totalResult.t30.draw, need_t30: totalResult.t30.need,
        coverage_cash_t30: totalResult.t30.cov_cash, coverage_only_t30: totalResult.t30.cov_only, risk_t30: totalResult.t30.risk,
        results: resultsPayload,
      })
      if (dbErr) throw new Error(dbErr.message)

      const conclusion = [
        `Сценарий: ${scenario}.`,
        `T+1 — потребность: ${fmt(totalResult.t1.need)} TJS, покрытие: ${(totalResult.t1.cov_cash*100).toFixed(0)}%, риск: ${riskLabel(totalResult.t1.risk)}.`,
        `T+7 — потребность: ${fmt(totalResult.t7.need)} TJS, покрытие: ${(totalResult.t7.cov_cash*100).toFixed(0)}%, риск: ${riskLabel(totalResult.t7.risk)}.`,
        `T+30 — потребность: ${fmt(totalResult.t30.need)} TJS, покрытие: ${(totalResult.t30.cov_cash*100).toFixed(0)}%, риск: ${riskLabel(totalResult.t30.risk)}.`,
        fxResult.t30.need > 0 ? `В т.ч. ин. валюта (TJS экв.) T+30: потребность ${fmt(fxResult.t30.need)} TJS, покрытие ${(fxResult.t30.cov_cash*100).toFixed(0)}%.` : '',
      ].filter(Boolean).join(' ')

      await supabase.from('stress_test_registry').insert({
        risk_type: 'Риск ликвидности',
        analyst_name: form.analyst_name,
        period: form.test_name,
        inputs: { total: totalInputs, fx_only: fxOnlyInputs, per_row_fx: perRowFx, scenario },
        results: resultsPayload,
        conclusion,
        status: 'Проведён',
      })

      setShowModal(false); setForm(EMPTY); setScenario('Пессимистичный')
      setViewMode('TOTAL'); setCustomRates(initRates())
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function downloadWord(t: StressTest) {
    try {
      const res = await fetch('/api/liquidity/export-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: t }),
      })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `Стресс-тест_${t.test_name}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { alert('Ошибка: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('liquidity_stress_tests').delete().eq('id', id)
    fetch_()
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"
  const rInp = "w-full px-1 py-0.5 border border-gray-200 rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white"

  const HorizonCard = ({ h, data }: { h: string; data: HData }) => (
    <div className={`p-4 rounded-xl border-2 ${data.risk === 'High' ? 'border-red-200 bg-red-50' : data.risk === 'Elevated' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-800">{h}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskColor(data.risk)}`}>{riskLabel(data.risk)}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Отток обязательств:</span><span className="font-medium">{fmt(data.liab)} TJS</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Использование линий:</span><span className="font-medium">{fmt(data.draw)} TJS</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5"><span className="font-semibold text-gray-700">Стресс-потребность:</span><span className="font-bold text-gray-900">{fmt(data.need)} TJS</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Покрытие (Cash & Eq):</span><span className={`font-bold ${covColor(data.cov_cash)}`}>{(data.cov_cash * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Покрытие (Cash Only):</span><span className={`font-bold ${covColor(data.cov_only)}`}>{(data.cov_only * 100).toFixed(0)}%</span></div>
        {data.cov_cash >= 1 && data.cov_only < 1 && (
          <div className="mt-1 p-1.5 bg-red-100 border border-red-200 rounded text-red-700 text-[10px] font-medium">⚠️ Cash Only недостаточно</div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          {data.cov_cash >= 1
            ? <><span className="text-green-700 font-semibold">Профицит:</span><span className="font-bold text-green-700">+{fmt(Math.round((data.cov_cash - 1) * data.need))} TJS</span></>
            : <><span className="text-red-700 font-semibold">Дефицит:</span><span className="font-bold text-red-700">-{fmt(Math.round((1 - data.cov_cash) * data.need))} TJS</span></>
          }
        </div>
        {data.cov_only < 1 && (
          <div className="flex justify-between">
            <span className="text-red-700 font-semibold">Дефицит (Only):</span>
            <span className="font-bold text-red-700">-{fmt(Math.round((1 - data.cov_only) * data.need))} TJS</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Ликвидность — Стресс-тест</h1>
            <p className="text-sm text-gray-500 mt-0.5">Оптимистичный / Пессимистичный / Катастрофический · T+1 / T+7 / T+30</p>
          </div>
          <button onClick={() => { setForm(EMPTY); setScenario('Пессимистичный'); setViewMode('TOTAL'); setCustomRates(initRates()); setError(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
            <Plus className="w-4 h-4" /> Новый стресс-тест
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Всего тестов',  value: tests.length,                                          c: 'text-gray-900'   },
            { label: 'Нормальный',    value: tests.filter(t => t.risk_t30 === 'Normal').length,    c: 'text-green-600'  },
            { label: 'Повышенный',    value: tests.filter(t => t.risk_t30 === 'Elevated').length,  c: 'text-yellow-600' },
            { label: 'Высокий риск',  value: tests.filter(t => t.risk_t30 === 'High').length,      c: 'text-red-600'    },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap mt-3">
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
      </div>

      <div className="space-y-5 mt-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Тест','Сценарий','Дата','T+1 риск','T+7 риск','T+30 риск','T+1 покрытие','T+7 покрытие','T+30 покрытие','Аналитик',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={11} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                  : tests.length === 0 ? <tr><td colSpan={11} className="text-center py-12 text-gray-400">Нет стресс-тестов</td></tr>
                  : tests.map(t => {
                    const sc = (t.scenario || 'Пессимистичный') as ScenarioName
                    const style = SCENARIO_STYLES[sc] || SCENARIO_STYLES['Пессимистичный']
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{t.test_name}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>{sc}</span></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
                        {[{r:t.risk_t1},{r:t.risk_t7},{r:t.risk_t30}].map(({r},i) => (
                          <td key={i} className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskColor(r)}`}>
                              {r === 'High' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                              {riskLabel(r)}
                            </span>
                          </td>
                        ))}
                        {[{v:t.coverage_cash_t1},{v:t.coverage_cash_t7},{v:t.coverage_cash_t30}].map(({v},i) => (
                          <td key={i} className={`px-4 py-3 font-bold text-sm ${covColor(v)}`}>{(v*100).toFixed(0)}%</td>
                        ))}
                        <td className="px-4 py-3 text-gray-600 text-xs">{t.analyst_name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setViewing(t); setViewScenario((t.scenario as ScenarioName) || 'Пессимистичный'); setViewViewMode('TOTAL') }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => downloadWord(t)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">{viewing.test_name}</h2>
                {viewing.scenario && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${(SCENARIO_STYLES[viewing.scenario as ScenarioName] || SCENARIO_STYLES['Пессимистичный']).badge}`}>
                    {viewing.scenario}
                  </span>
                )}
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* v2 format */}
              {(viewing.results?.version === 2 || viewing.results?.total) ? (() => {
                const r = viewing.results!
                const sc = (r.scenario || 'Пессимистичный') as ScenarioName
                const displayComp = viewViewMode === 'FX' && r.fx_only
                  ? { t1: r.fx_only.t1, t7: r.fx_only.t7, t30: r.fx_only.t30 }
                  : r.total
                    ? { t1: r.total.t1, t7: r.total.t7, t30: r.total.t30 }
                    : null
                return (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${SCENARIO_STYLES[sc]?.badge || 'bg-gray-100 text-gray-600'}`}>{sc}</span>
                      {r.fx_rates && (
                        <span className="text-xs text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
                          💱 USD: {r.fx_rates.usd} · EUR: {r.fx_rates.eur} · RUB: {r.fx_rates.rub} TJS
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full max-w-sm">
                      {([
                        { id: 'TOTAL' as ViewMode, label: '🇹🇯 Сомони' },
                        { id: 'FX'    as ViewMode, label: '💵 В т.ч. инвалюта' },
                      ]).map(tab => (
                        <button key={tab.id} onClick={() => setViewViewMode(tab.id)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${viewViewMode === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {displayComp && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {viewViewMode === 'FX' ? '💵 В т.ч. иностранная валюта (TJS экв.)' : '🇹🇯 Сомони — общий расчёт'}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <HorizonCard h="T+1 (1 день)" data={displayComp.t1} />
                          <HorizonCard h="T+7 (7 дней)" data={displayComp.t7} />
                          <HorizonCard h="T+30 (30 дней)" data={displayComp.t30} />
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Входные данные (TJS)
                        {r.rates_map && <span className="ml-2 text-[#1B8A4C] font-normal">% отток: {sc}</span>}
                      </p>
                      <div className="grid grid-cols-1 gap-1.5 text-xs">
                        {([
                          { label: 'Межбанковские обязательства', key: 'due_to_banks' },
                          { label: 'Текущие счета',               key: 'current_accounts' },
                          { label: 'Электронный кошелёк',         key: 'electronic_wallet' },
                          { label: 'Накопительные счета',         key: 'savings' },
                          { label: 'Срочные депозиты',            key: 'term_deposits' },
                          { label: 'Заимствования',               key: 'borrowings' },
                          { label: 'Прочие обязательства',        key: 'other_liabilities' },
                          { label: 'Кредитная линия Salom',       key: 'credit_line_salom' },
                          { label: 'Кредитная линия SME',         key: 'credit_line_sme' },
                        ]).map(item => {
                          const totalVal = r.total?.inputs[item.key] || 0
                          const fxInfo   = r.per_row_fx?.[item.key]
                          const rm = r.rates_map as Record<string, HRate> | undefined
                          const rate = rm?.[item.key]
                          const rateStr = rate ? `${(rate.t1*100).toFixed(0)}% / ${(rate.t7*100).toFixed(0)}% / ${(rate.t30*100).toFixed(0)}%` : null
                          return (
                            <div key={item.key} className="p-1.5 bg-white rounded">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-500 flex-1">{item.label}</span>
                                {rateStr && <span className="text-[#1B8A4C] font-medium text-[10px] whitespace-nowrap">{rateStr}</span>}
                                <span className="font-medium text-gray-900 whitespace-nowrap">{fmt(totalVal)} TJS</span>
                              </div>
                              {fxInfo && (
                                <div className="text-[10px] text-blue-500 mt-0.5">
                                  В т.ч.: {fmt(fxInfo.native)} {fxInfo.cur} ≈ {fmt(fxInfo.tjs)} TJS
                                  {totalVal > 0 && <span className="text-gray-400"> ({Math.round(fxInfo.tjs/totalVal*100)}%)</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <div className="border-t border-gray-200 mt-1 pt-1.5 space-y-1">
                          {[
                            { label: 'Буфер: Cash & Equivalents', key: 'cash_equivalents' },
                            { label: 'Буфер: Cash Only',          key: 'cash_only' },
                          ].map(item => {
                            const totalVal = r.total?.inputs[item.key] || 0
                            const fxInfo   = r.per_row_fx?.[item.key]
                            return (
                              <div key={item.key} className="p-1.5 bg-white rounded">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">{item.label}</span>
                                  <span className="font-bold">{fmt(totalVal)} TJS</span>
                                </div>
                                {fxInfo && (
                                  <div className="text-[10px] text-blue-500 mt-0.5">
                                    В т.ч.: {fmt(fxInfo.native)} {fxInfo.cur} ≈ {fmt(fxInfo.tjs)} TJS
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()

              /* v1 legacy: has results.tjs */
              : viewing.results?.tjs ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${SCENARIO_STYLES[viewing.results.scenario as ScenarioName]?.badge || 'bg-gray-100 text-gray-600'}`}>
                      {viewing.results.scenario}
                    </span>
                    <span className="text-xs text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
                      💱 Курс НБТ: <strong>{viewing.results.exchange_rate}</strong> TJS/USD (устаревший формат)
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🔗 Консолидировано</p>
                    <div className="grid grid-cols-3 gap-3">
                      <HorizonCard h="T+1 (1 день)" data={viewing.results.cons!.t1} />
                      <HorizonCard h="T+7 (7 дней)" data={viewing.results.cons!.t7} />
                      <HorizonCard h="T+30 (30 дней)" data={viewing.results.cons!.t30} />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🇹🇯 Сомони (TJS)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <HorizonCard h="T+1" data={viewing.results.tjs.t1} />
                      <HorizonCard h="T+7" data={viewing.results.tjs.t7} />
                      <HorizonCard h="T+30" data={viewing.results.tjs.t30} />
                    </div>
                  </div>
                  {viewing.results.fx && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">💵 Иностранная валюта (в TJS экв.)</p>
                      <div className="grid grid-cols-3 gap-3">
                        <HorizonCard h="T+1" data={viewing.results.fx.t1} />
                        <HorizonCard h="T+7" data={viewing.results.fx.t7} />
                        <HorizonCard h="T+30" data={viewing.results.fx.t30} />
                      </div>
                    </div>
                  )}
                </>

              /* No results JSONB: recalculate from flat columns */
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(ALL_SCENARIOS) as ScenarioName[]).map(sc => {
                      const style = SCENARIO_STYLES[sc]
                      const active = viewScenario === sc
                      const isSaved = (viewing.scenario || 'Пессимистичный') === sc
                      return (
                        <button key={sc} onClick={() => setViewScenario(sc)}
                          className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${active ? `${style.bg} ${style.border} ${style.text}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {sc === 'Оптимистичный' ? '📈' : sc === 'Пессимистичный' ? '📉' : '⚠️'} {sc}
                          {isSaved && <span className="ml-1 text-[10px] opacity-70">(сохранён)</span>}
                        </button>
                      )
                    })}
                  </div>
                  {(() => {
                    const vi = {
                      due_to_banks: viewing.due_to_banks, current_accounts: viewing.current_accounts,
                      electronic_wallet: viewing.electronic_wallet, savings: viewing.savings,
                      term_deposits: viewing.term_deposits, borrowings: viewing.borrowings,
                      other_liabilities: viewing.other_liabilities,
                      credit_line_salom: viewing.credit_line_salom, credit_line_sme: viewing.credit_line_sme,
                      cash_equivalents: viewing.cash_equivalents, cash_only: viewing.cash_only,
                    }
                    const res = calcStress(vi, viewScenario)
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <HorizonCard h="T+1 (1 день)" data={res.t1} />
                        <HorizonCard h="T+7 (7 дней)" data={res.t7} />
                        <HorizonCard h="T+30 (30 дней)" data={res.t30} />
                      </div>
                    )
                  })()}
                </>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">Стресс-тест ликвидности</h2>
                <p className="text-xs text-gray-500 mt-0.5">3 сценария · T+1 / T+7 / T+30 · Единый расчёт в сомони с разбивкой по валютам</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              {/* Name + Analyst */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Название теста *</label>
                  <input type="text" value={form.test_name} onChange={e => setF('test_name', e.target.value)} placeholder="Стресс-тест Март 2026"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" /></div>
                <div><label className={lbl}>Аналитик</label>
                  <input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" /></div>
              </div>

              {/* FX rates */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-3">💱 Курсы валют НБТ (TJS за 1 единицу)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'rate_usd', label: 'USD', placeholder: '10.90' },
                    { key: 'rate_eur', label: 'EUR', placeholder: '11.80' },
                    { key: 'rate_rub', label: 'RUB', placeholder: '0.12'  },
                  ].map(r => (
                    <div key={r.key}>
                      <label className={lbl}>{r.label}</label>
                      <input type="text" inputMode="decimal" value={form[r.key]}
                        onChange={e => setF(r.key, e.target.value)} placeholder={r.placeholder}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-right" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-blue-500 mt-2">Курсы применяются к строкам с выбранной иностранной валютой · конвертируются в TJS-эквивалент</p>
              </div>

              {/* Scenario selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Сохранить как сценарий</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ALL_SCENARIOS) as ScenarioName[]).map(sc => {
                    const style = SCENARIO_STYLES[sc]
                    const active = scenario === sc
                    return (
                      <button key={sc} onClick={() => setScenario(sc)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${active ? `${style.bg} ${style.border} ${style.text}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {sc === 'Оптимистичный' ? '📈' : sc === 'Пессимистичный' ? '📉' : '⚠️'} {sc}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* View mode toggle */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Отображение результатов</p>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  {([
                    { id: 'TOTAL' as ViewMode, label: '🇹🇯 Сомони' },
                    { id: 'FX'    as ViewMode, label: '💵 В т.ч. инвалюта' },
                  ]).map(tab => (
                    <button key={tab.id} onClick={() => setViewMode(tab.id)}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${viewMode === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {viewMode === 'FX' && (
                  <p className="text-[11px] text-blue-500 mt-1.5 text-center">Только валютная часть (TJS экв.) — подмножество «Сомони», не добавка</p>
                )}
              </div>

              {/* Scenario result cards */}
              <div className="space-y-3">
                {(Object.keys(displayedAll) as ScenarioName[]).map(sc => {
                  const style = SCENARIO_STYLES[sc]
                  const res = displayedAll[sc]
                  const isSaved = scenario === sc
                  return (
                    <div key={sc} className={`rounded-xl border-2 overflow-hidden ${isSaved ? style.border : 'border-gray-200'}`}>
                      <div className={`px-4 py-2 flex items-center justify-between ${isSaved ? style.bg : 'bg-gray-50'}`}>
                        <span className={`text-xs font-bold ${isSaved ? style.text : 'text-gray-500'}`}>
                          {sc === 'Оптимистичный' ? '📈' : sc === 'Пессимистичный' ? '📉' : '⚠️'} {sc}
                          {viewMode === 'FX' && <span className="ml-1 opacity-60 font-normal">(в т.ч. инвалюта TJS экв.)</span>}
                        </span>
                        {isSaved && <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>будет сохранён</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-3 p-3">
                        <HorizonCard h="T+1" data={res.t1} />
                        <HorizonCard h="T+7" data={res.t7} />
                        <HorizonCard h="T+30" data={res.t30} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Liabilities */}
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Обязательства (TJS)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {LIAB_DEFS.map(f => {
                      const cur = form[f.key + '_fx_cur'] || 'none'
                      const fxTjs = getFxTjs(f.key)
                      const totalTjs = n(f.key)
                      const r = (customRates[scenario] || {})[f.key] || { t1: 0, t7: 0, t30: 0 }
                      return (
                        <div key={f.key}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric" value={form[f.key]}
                            onChange={e => setNum(f.key, e.target.value)} placeholder="0" className={inp} />
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">В т.ч.:</span>
                            <select value={cur} onChange={e => setF(f.key + '_fx_cur', e.target.value)}
                              className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]">
                              <option value="none">TJS</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="RUB">RUB</option>
                            </select>
                            {cur !== 'none' && (
                              <>
                                <input type="text" inputMode="numeric" value={form[f.key + '_fx_native'] || ''}
                                  onChange={e => setNum(f.key + '_fx_native', e.target.value)}
                                  placeholder={`0 ${cur}`}
                                  className="flex-1 min-w-0 px-2 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] text-right" />
                                {fxTjs > 0 && (
                                  <span className="text-[10px] text-blue-500 whitespace-nowrap">
                                    ≈{fmt(fxTjs)} TJS{totalTjs > 0 ? ` (${Math.round(fxTjs/totalTjs*100)}%)` : ''}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {(['t1', 't7', 't30'] as const).map(h => (
                              <div key={h} className="flex-1">
                                <div className="text-[9px] text-gray-400 text-center mb-0.5">{h === 't1' ? 'T+1' : h === 't7' ? 'T+7' : 'T+30'}</div>
                                <div className="flex items-center gap-0.5">
                                  <input type="number" min="0" max="100" step="1"
                                    value={(r[h] * 100).toFixed(0)}
                                    onChange={e => updateRate(f.key, h, e.target.value)}
                                    className={rInp} />
                                  <span className="text-[9px] text-gray-400">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Кредитные линии (TJS)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CL_DEFS.map(f => {
                      const cur = form[f.key + '_fx_cur'] || 'none'
                      const fxTjs = getFxTjs(f.key)
                      const totalTjs = n(f.key)
                      const r = (customRates[scenario] || {})[f.key] || { t1: 0, t7: 0, t30: 0 }
                      return (
                        <div key={f.key}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric" value={form[f.key]}
                            onChange={e => setNum(f.key, e.target.value)} placeholder="0" className={inp} />
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">В т.ч.:</span>
                            <select value={cur} onChange={e => setF(f.key + '_fx_cur', e.target.value)}
                              className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]">
                              <option value="none">TJS</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="RUB">RUB</option>
                            </select>
                            {cur !== 'none' && (
                              <>
                                <input type="text" inputMode="numeric" value={form[f.key + '_fx_native'] || ''}
                                  onChange={e => setNum(f.key + '_fx_native', e.target.value)}
                                  placeholder={`0 ${cur}`}
                                  className="flex-1 min-w-0 px-2 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] text-right" />
                                {fxTjs > 0 && (
                                  <span className="text-[10px] text-blue-500 whitespace-nowrap">
                                    ≈{fmt(fxTjs)} TJS{totalTjs > 0 ? ` (${Math.round(fxTjs/totalTjs*100)}%)` : ''}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {(['t1', 't7', 't30'] as const).map(h => (
                              <div key={h} className="flex-1">
                                <div className="text-[9px] text-gray-400 text-center mb-0.5">{h === 't1' ? 'T+1' : h === 't7' ? 'T+7' : 'T+30'}</div>
                                <div className="flex items-center gap-0.5">
                                  <input type="number" min="0" max="100" step="1"
                                    value={(r[h] * 100).toFixed(0)}
                                    onChange={e => updateRate(f.key, h, e.target.value)}
                                    className={rInp} />
                                  <span className="text-[9px] text-gray-400">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Буфер ликвидности (TJS)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'cash_equivalents', label: 'Cash & Cash Equivalents', hint: 'Наличные + счета в ЦБ + краткосрочные ЦБ' },
                      { key: 'cash_only',         label: 'Cash Only (наличные)',    hint: 'Только физические наличные деньги' },
                    ].map(f => {
                      const cur = form[f.key + '_fx_cur'] || 'none'
                      const fxTjs = getFxTjs(f.key)
                      const totalTjs = n(f.key)
                      return (
                        <div key={f.key}>
                          <label className={lbl}>{f.label}</label>
                          <input type="text" inputMode="numeric" value={form[f.key]}
                            onChange={e => setNum(f.key, e.target.value)} placeholder="0" className={inp} />
                          <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">В т.ч.:</span>
                            <select value={cur} onChange={e => setF(f.key + '_fx_cur', e.target.value)}
                              className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]">
                              <option value="none">TJS</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="RUB">RUB</option>
                            </select>
                            {cur !== 'none' && (
                              <>
                                <input type="text" inputMode="numeric" value={form[f.key + '_fx_native'] || ''}
                                  onChange={e => setNum(f.key + '_fx_native', e.target.value)}
                                  placeholder={`0 ${cur}`}
                                  className="flex-1 min-w-0 px-2 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] text-right" />
                                {fxTjs > 0 && (
                                  <span className="text-[10px] text-blue-500 whitespace-nowrap">
                                    ≈{fmt(fxTjs)} TJS{totalTjs > 0 ? ` (${Math.round(fxTjs/totalTjs*100)}%)` : ''}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100">
              <p className="text-xs text-gray-400">Суммы в TJS · ин. валюта — часть TJS-суммы, не добавка</p>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                  {saving ? 'Сохранение...' : <><CheckCircle className="w-4 h-4" /> Сохранить</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

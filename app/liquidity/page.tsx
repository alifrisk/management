'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Download, Eye, Trash2, X, AlertTriangle, CheckCircle, TrendingDown, Filter } from 'lucide-react'
interface StressTest {
  id: string
  test_name: string
  analyst_name: string
  test_date: string
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
}
const STRESS_RATES = {
  due_to_banks:     { t1: 1.00, t7: 1.00, t30: 1.00 },
  current_accounts: { t1: 0.20, t7: 0.35, t30: 0.50 },
  electronic_wallet:        { t1: 0.10, t7: 0.15, t30: 0.20 },
  savings:          { t1: 0.03, t7: 0.07, t30: 0.10 },
  term_deposits:    { t1: 0.05, t7: 0.20, t30: 0.35 },
  borrowings:       { t1: 0.00, t7: 0.00, t30: 0.00 },
  other_liabilities:{ t1: 0.00, t7: 0.00, t30: 0.00 },
  credit_line_salom:{ t1: 0.05, t7: 0.07, t30: 0.10 },
  credit_line_sme:  { t1: 0.00, t7: 0.00, t30: 0.00 },
}
function calcStress(f: Record<string, number>) {
  const calc = (horizon: 't1' | 't7' | 't30') => {
    const liab = (
      f.due_to_banks * STRESS_RATES.due_to_banks[horizon] +
      f.current_accounts * STRESS_RATES.current_accounts[horizon] +
      f.electronic_wallet * STRESS_RATES.electronic_wallet[horizon] +
      f.savings * STRESS_RATES.savings[horizon] +
      f.term_deposits * STRESS_RATES.term_deposits[horizon] +
      f.borrowings * STRESS_RATES.borrowings[horizon] +
      f.other_liabilities * STRESS_RATES.other_liabilities[horizon]
    )
    const draw = (
      f.credit_line_salom * STRESS_RATES.credit_line_salom[horizon] +
      f.credit_line_sme * STRESS_RATES.credit_line_sme[horizon]
    )
    const need = liab + draw
    const cov_cash = need > 0 ? f.cash_equivalents / need : 0
    const cov_only = need > 0 ? f.cash_only / need : 0
    const risk = cov_only < 1 ? 'High' : cov_cash < 1 ? 'High' : cov_only < 1.1 ? 'Elevated' : cov_cash < 1.1 ? 'Elevated' : 'Normal'
    return { liab, draw, need, cov_cash, cov_only, risk }
  }
  return { t1: calc('t1'), t7: calc('t7'), t30: calc('t30') }
}
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct = (n: number) => n ? (n * 100).toFixed(0) + '%' : '—'
const formatNum = (v: string) => {
  const num = v.replace(/\D/g, '')
  if (!num) return ''
  return new Intl.NumberFormat('ru-RU').format(Number(num))
}
const parseNum = (v: string) => Number(v.replace(/\D/g, '')) || 0
const EMPTY: Record<string, string> = {
  test_name: '', analyst_name: '',
  due_to_banks: '', current_accounts: '', electronic_wallet: '', savings: '',
  term_deposits: '', borrowings: '', other_liabilities: '',
  credit_line_salom: '', credit_line_sme: '',
  cash_equivalents: '', cash_only: '',
}
export default function LiquidityPage() {
  const [tests, setTests] = useState<StressTest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<StressTest | null>(null)
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
  const computed = calcStress({
    due_to_banks: n('due_to_banks'), current_accounts: n('current_accounts'),
    electronic_wallet: n('electronic_wallet'), savings: n('savings'), term_deposits: n('term_deposits'),
    borrowings: n('borrowings'), other_liabilities: n('other_liabilities'),
    credit_line_salom: n('credit_line_salom'), credit_line_sme: n('credit_line_sme'),
    cash_equivalents: n('cash_equivalents'), cash_only: n('cash_only'),
  })
  const riskColor = (r: string) => r === 'High' ? 'text-red-600 bg-red-50' : r === 'Elevated' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50'
  const riskLabel = (r: string) => r === 'High' ? 'Высокий' : r === 'Elevated' ? 'Повышенный' : 'Нормальный'
  const covColor = (v: number) => v >= 1.1 ? 'text-green-600' : v >= 1 ? 'text-yellow-600' : 'text-red-600'
  async function handleSave() {
    if (!form.test_name.trim()) { setError('Введите название теста'); return }
    setSaving(true); setError(null)
    try {
      const { error: dbErr } = await supabase.from('liquidity_stress_tests').insert({
        test_name: form.test_name, analyst_name: form.analyst_name,
        test_date: new Date().toISOString().split('T')[0],
        due_to_banks: n('due_to_banks'), current_accounts: n('current_accounts'),
        electronic_wallet: n('electronic_wallet'), savings: n('savings'), term_deposits: n('term_deposits'),
        borrowings: n('borrowings'), other_liabilities: n('other_liabilities'),
        credit_line_salom: n('credit_line_salom'), credit_line_sme: n('credit_line_sme'),
        cash_equivalents: n('cash_equivalents'), cash_only: n('cash_only'),
        outflow_t1: computed.t1.liab, drawdown_t1: computed.t1.draw, need_t1: computed.t1.need,
        coverage_cash_t1: computed.t1.cov_cash, coverage_only_t1: computed.t1.cov_only, risk_t1: computed.t1.risk,
        outflow_t7: computed.t7.liab, drawdown_t7: computed.t7.draw, need_t7: computed.t7.need,
        coverage_cash_t7: computed.t7.cov_cash, coverage_only_t7: computed.t7.cov_only, risk_t7: computed.t7.risk,
        outflow_t30: computed.t30.liab, drawdown_t30: computed.t30.draw, need_t30: computed.t30.need,
        coverage_cash_t30: computed.t30.cov_cash, coverage_only_t30: computed.t30.cov_only, risk_t30: computed.t30.risk,
      })
      if (dbErr) throw new Error(dbErr.message)
      setShowModal(false); setForm(EMPTY); fetch_()
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
  const HorizonCard = ({ h, data }: { h: string; data: { liab: number; draw: number; need: number; cov_cash: number; cov_only: number; risk: string } }) => (
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
          <div className="mt-1 p-1.5 bg-red-100 border border-red-200 rounded text-red-700 text-[10px] font-medium">
            ⚠️ Cash Only недостаточно — причина высокого риска
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          {data.cov_cash >= 1
            ? <><span className="text-green-700 font-semibold">Профицит (Cash & Eq):</span><span className="font-bold text-green-700">+{fmt(Math.round((data.cov_cash - 1) * data.need))} TJS</span></>
            : <><span className="text-red-700 font-semibold">Дефицит:</span><span className="font-bold text-red-700">-{fmt(Math.round((1 - data.cov_cash) * data.need))} TJS</span></>
          }
        </div>
        {data.cov_only < 1 && (
          <div className="flex justify-between">
            <span className="text-red-700 font-semibold">Дефицит (Cash Only):</span>
            <span className="font-bold text-red-700">-{fmt(Math.round((1 - data.cov_only) * data.need))} TJS</span>
          </div>
        )}
      </div>
    </div>
  )
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ликвидность — Стресс-тест</h1>
          <p className="text-sm text-gray-500 mt-0.5">Пессимистический сценарий T+1 / T+7 / T+30</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Новый стресс-тест
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего тестов', value: tests.length, c: 'text-gray-900' },
          { label: 'Нормальный', value: tests.filter(t => t.risk_t30 === 'Normal').length, c: 'text-green-600' },
          { label: 'Повышенный', value: tests.filter(t => t.risk_t30 === 'Elevated').length, c: 'text-yellow-600' },
          { label: 'Высокий риск', value: tests.filter(t => t.risk_t30 === 'High').length, c: 'text-red-600' },
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
                {['Тест','Дата','T+1 риск','T+7 риск','T+30 риск','T+1 покрытие','T+7 покрытие','T+30 покрытие','Аналитик',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : tests.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">Нет стресс-тестов</td></tr>
                : tests.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.test_name}</td>
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
                        <button onClick={() => setViewing(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadWord(t)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{viewing.test_name}</h2>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <HorizonCard h="T+1 (1 день)" data={{ liab: viewing.outflow_t1, draw: viewing.drawdown_t1, need: viewing.need_t1, cov_cash: viewing.coverage_cash_t1, cov_only: viewing.coverage_only_t1, risk: viewing.risk_t1 }} />
                <HorizonCard h="T+7 (7 дней)" data={{ liab: viewing.outflow_t7, draw: viewing.drawdown_t7, need: viewing.need_t7, cov_cash: viewing.coverage_cash_t7, cov_only: viewing.coverage_only_t7, risk: viewing.risk_t7 }} />
                <HorizonCard h="T+30 (30 дней)" data={{ liab: viewing.outflow_t30, draw: viewing.drawdown_t30, need: viewing.need_t30, cov_cash: viewing.coverage_cash_t30, cov_only: viewing.coverage_only_t30, risk: viewing.risk_t30 }} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Входные данные</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Межбанковские обязательства', viewing.due_to_banks],
                    ['Текущие счета', viewing.current_accounts],
                    ['Электронный кошелёк', viewing.electronic_wallet],
                    ['Накопительные счета', viewing.savings],
                    ['Срочные депозиты', viewing.term_deposits],
                    ['Заимствования', viewing.borrowings],
                    ['Прочие обязательства', viewing.other_liabilities],
                    ['Кредитная линия Salom', viewing.credit_line_salom],
                    ['Кредитная линия SME', viewing.credit_line_sme],
                    ['Буфер: Cash & Equivalents', viewing.cash_equivalents],
                    ['Буфер: Cash Only', viewing.cash_only],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between p-1.5 bg-white rounded">
                      <span className="text-gray-500">{l}</span>
                      <span className="font-medium">{fmt(v as number)} TJS</span>
                    </div>
                  ))}
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold">Стресс-тест ликвидности</h2>
                <p className="text-xs text-gray-500 mt-0.5">Пессимистический сценарий · T+1 / T+7 / T+30</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg"><span className="text-sm text-red-600">{error}</span></div>}
              <div className="grid grid-cols-3 gap-3">
                <HorizonCard h="T+1" data={computed.t1} />
                <HorizonCard h="T+7" data={computed.t7} />
                <HorizonCard h="T+30" data={computed.t30} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Название теста *</label><input type="text" value={form.test_name} onChange={e => setF('test_name', e.target.value)} placeholder="Стресс-тест Март 2026" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" /></div>
                <div><label className={lbl}>Аналитик</label><input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)} placeholder="ФИО" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white" /></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Обязательства (TJS)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'due_to_banks', label: 'Межбанковские обязательства', rates: '100% / 100% / 100%' },
                    { key: 'current_accounts', label: 'Текущие счета клиентов', rates: '20% / 35% / 50%' },
                    { key: 'electronic_wallet', label: 'Электронный кошелёк', rates: '10% / 15% / 20%' },
                    { key: 'savings', label: 'Накопительные счета', rates: '3% / 7% / 10%' },
                    { key: 'term_deposits', label: 'Срочные депозиты', rates: '5% / 20% / 35%' },
                    { key: 'borrowings', label: 'Заимствования', rates: '0% / 0% / 0%' },
                    { key: 'other_liabilities', label: 'Прочие обязательства', rates: '0% / 0% / 0%' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={lbl}>{f.label}</label>
                      <input type="text" inputMode="numeric" value={form[f.key]} onChange={e => setNum(f.key, e.target.value)} placeholder="0" className={inp} />
                      <p className="text-xs text-gray-400 mt-0.5">Стресс: {f.rates}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Кредитные линии (TJS)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'credit_line_salom', label: 'Кредитная линия Salom', rates: '5% / 7% / 10%' },
                    { key: 'credit_line_sme', label: 'Кредитная линия SME', rates: '0% / 0% / 0%' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={lbl}>{f.label}</label>
                      <input type="text" inputMode="numeric" value={form[f.key]} onChange={e => setNum(f.key, e.target.value)} placeholder="0" className={inp} />
                      <p className="text-xs text-gray-400 mt-0.5">Стресс: {f.rates}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Буфер ликвидности (TJS)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Cash & Cash Equivalents</label>
                    <input type="text" inputMode="numeric" value={form.cash_equivalents} onChange={e => setNum('cash_equivalents', e.target.value)} placeholder="0" className={inp} />
                    <p className="text-xs text-gray-400 mt-0.5">Наличные + счета в ЦБ + краткосрочные ЦБ</p>
                  </div>
                  <div>
                    <label className={lbl}>Cash Only (наличные)</label>
                    <input type="text" inputMode="numeric" value={form.cash_only} onChange={e => setNum('cash_only', e.target.value)} placeholder="0" className={inp} />
                    <p className="text-xs text-gray-400 mt-0.5">Только физические наличные деньги</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {saving ? 'Сохранение...' : <><CheckCircle className="w-4 h-4" /> Сохранить тест</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

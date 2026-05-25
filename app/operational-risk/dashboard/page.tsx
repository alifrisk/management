'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, ResponsiveContainer, LabelList
} from 'recharts'
import { Shield, Download } from 'lucide-react'
const COLORS = ['#1B8A4C', '#2EAD62', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899']
const RISK_COLORS: Record<string, string> = {
  'Низкий': '#16a34a', 'Средний': '#ca8a04', 'Высокий': '#ea580c', 'Экстремальные': '#dc2626',
}
interface Incident {
  factor: string; business_process: string; risk_level: string; incident_status: string
  client_work_status: string; frequency: string; department: string; system: string
  loss_amount_tjs: number; recovery_amount: number; discovery_date: string; incident_date: string
}
const MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']
export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState('')
  const [prevIncidents, setPrevIncidents] = useState<{loss_amount_tjs: number; recovery_amount: number; risk_level: string; incident_status: string}[]>([])
  const dashboardRef = useRef<HTMLDivElement>(null)
  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('operational_incidents')
      .select('factor, business_process, risk_level, incident_status, client_work_status, frequency, department, system, loss_amount_tjs, recovery_amount, discovery_date, incident_date')
      .gte('discovery_date', `${year}-01-01`)
      .lte('discovery_date', `${year}-12-31`)
    if (filterMonth) {
      const monthNum = String(parseInt(filterMonth)).padStart(2, '0')
      query = query.gte('discovery_date', `${year}-${monthNum}-01`).lte('discovery_date', `${year}-${monthNum}-31`)
    }
    const [{ data }, { data: prevData }] = await Promise.all([
      query,
      supabase.from('operational_incidents')
        .select('loss_amount_tjs, recovery_amount, risk_level, incident_status')
        .gte('discovery_date', `${year - 1}-01-01`)
        .lte('discovery_date', `${year - 1}-12-31`)
    ])
    setIncidents(data || [])
    setPrevIncidents(prevData || [])
    setLoading(false)
  }, [year, filterMonth])
  useEffect(() => { fetchData() }, [fetchData])
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
  const total = incidents.length
  const totalLoss = incidents.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)
  const totalRecovery = incidents.reduce((s, i) => s + (i.recovery_amount || 0), 0)
  const recoveryRate = totalLoss > 0 ? (totalRecovery / totalLoss * 100).toFixed(1) : '0'
  const open = incidents.filter(i => i.incident_status === 'Открыт' || i.incident_status === 'В процессе').length
  const high = incidents.filter(i => i.risk_level === 'Высокий' || i.risk_level === 'Экстремальные').length
  const prevLoss = prevIncidents.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)
  const prevCount = prevIncidents.length
  const lossDiff = prevLoss > 0 ? ((totalLoss - prevLoss) / prevLoss * 100).toFixed(1) : null
  const countDiff = prevCount > 0 ? ((total - prevCount) / prevCount * 100).toFixed(1) : null
  const top3 = [...incidents].sort((a, b) => (b.loss_amount_tjs || 0) - (a.loss_amount_tjs || 0)).slice(0, 3)
  const monthData = MONTHS.map((month, idx) => {
    const m = incidents.filter(i => i.discovery_date && new Date(i.discovery_date).getMonth() === idx)
    return { name: month.slice(0, 3), count: m.length, loss: Math.round(m.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)), recovery: Math.round(m.reduce((s, i) => s + (i.recovery_amount || 0), 0)) }
  })
  const bpData = Object.entries(incidents.reduce((acc, i) => {
    if (!i.business_process) return acc
    if (!acc[i.business_process]) acc[i.business_process] = { loss: 0, recovery: 0, count: 0 }
    acc[i.business_process].loss += i.loss_amount_tjs || 0
    acc[i.business_process].recovery += i.recovery_amount || 0
    acc[i.business_process].count += 1
    return acc
  }, {} as Record<string, { loss: number; recovery: number; count: number }>)).sort((a, b) => b[1].loss - a[1].loss).slice(0, 10).map(([name, v]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, loss: Math.round(v.loss), recovery: Math.round(v.recovery), count: v.count }))
  const systemData = Object.entries(incidents.reduce((acc, i) => {
    if (!i.system) return acc
    if (!acc[i.system]) acc[i.system] = { loss: 0, recovery: 0, count: 0 }
    acc[i.system].loss += i.loss_amount_tjs || 0
    acc[i.system].recovery += i.recovery_amount || 0
    acc[i.system].count += 1
    return acc
  }, {} as Record<string, { loss: number; recovery: number; count: number }>)).sort((a, b) => b[1].loss - a[1].loss).slice(0, 8).map(([name, v]) => ({ name, loss: Math.round(v.loss), recovery: Math.round(v.recovery), count: v.count }))
  const factorData = ['Риск систем', 'Риск человеческого фактора', 'Риск внутренний процесс', 'Юридический риск', 'Внешний риск'].map(f => {
    const m = incidents.filter(i => i.factor === f)
    return { name: f, count: m.length, loss: Math.round(m.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)), recovery: Math.round(m.reduce((s, i) => s + (i.recovery_amount || 0), 0)) }
  }).filter(d => d.count > 0)
  const riskData = ['Низкий', 'Средний', 'Высокий'].map(r => ({ name: r, count: incidents.filter(i => i.risk_level === r).length, loss: Math.round(incidents.filter(i => i.risk_level === r).reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)) })).filter(d => d.count > 0)
  const statusData = ['Открыт', 'В процессе', 'Закрыт'].map(s => ({ name: s, value: incidents.filter(i => i.incident_status === s).length })).filter(d => d.value > 0)
  const frequencyData = ['Часто повторяющиеся', 'Редко повторяющиеся', 'Единичный случай'].map(f => ({ name: f, value: incidents.filter(i => i.frequency === f).length })).filter(d => d.value > 0)
  const clientStatusData = ['В процессе обзвона', 'В ожидании возмещения', 'Возмещенно', 'Невозмещаемый', 'Нефинансовый инцидент', 'Процесс возмещения не начался', 'Процесс возмещения не идет'].map(s => ({ name: s.length > 22 ? s.slice(0, 22) + '…' : s, count: incidents.filter(i => i.client_work_status === s).length })).filter(d => d.count > 0)
  const deptData = Object.entries(incidents.reduce((acc, i) => { if (i.department) acc[i.department] = (acc[i.department] || 0) + 1; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name: name.length > 25 ? name.slice(0, 25) + '…' : name, count }))

  async function handleDownload() {
    try {
      const printStyle = document.createElement('style')
      printStyle.innerHTML = `@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } button, select { display: none !important; } .no-print { display: none !important; } }`
      document.head.appendChild(printStyle)
      window.print()
      setTimeout(() => document.head.removeChild(printStyle), 1000)
    } catch { alert('Используйте Ctrl+P для печати/сохранения в PDF') }
  }

  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"
  const title = "text-sm font-semibold text-gray-700 mb-4"

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Загрузка...</div></div>

  return (
    <div className="max-w-7xl mx-auto space-y-5" ref={dashboardRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд — Операционный риск</h1>
          <p className="text-sm text-gray-500 mt-0.5">Аналитика за {year}{filterMonth ? ` · ${MONTHS[parseInt(filterMonth) - 1]}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setFilterMonth('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
            {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
            <option value="">Все месяцы</option>
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
          {filterMonth && <button onClick={() => setFilterMonth('')} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Сбросить</button>}
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
            <Download className="w-4 h-4" /> Скачать PDF
          </button>
        </div>
      </div>

      {/* ✅ KPI Cards с тултипами */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">

        {/* Всего инцидентов */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Всего инцидентов</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          {countDiff && <p className={`text-xs mt-1 font-medium ${parseFloat(countDiff) > 0 ? 'text-red-500' : 'text-green-600'}`}>{parseFloat(countDiff) > 0 ? '▲' : '▼'} {Math.abs(parseFloat(countDiff))}% vs {year-1}</p>}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-52 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">Разбивка по статусу</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Открыт:</span><span className="font-medium text-blue-300">{incidents.filter(i => i.incident_status === 'Открыт').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">В процессе:</span><span className="font-medium text-yellow-300">{incidents.filter(i => i.incident_status === 'В процессе').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Закрыт:</span><span className="font-medium text-green-300">{incidents.filter(i => i.incident_status === 'Закрыт').length}</span></div>
              {prevCount > 0 && <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1"><span className="text-gray-300">Пред. год ({year-1}):</span><span>{prevCount}</span></div>}
            </div>
            <div className="absolute top-full left-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

        {/* Открытые */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Открытые</p>
          <p className="text-2xl font-bold text-blue-600">{open}</p>
          <p className="text-xs text-gray-400 mt-1">{total > 0 ? ((open/total)*100).toFixed(0) : 0}% от всех</p>
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-52 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">Незакрытые инциденты</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Открыт:</span><span className="text-blue-300">{incidents.filter(i => i.incident_status === 'Открыт').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">В процессе:</span><span className="text-yellow-300">{incidents.filter(i => i.incident_status === 'В процессе').length}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1"><span className="text-gray-300">Доля от всех:</span><span className="font-medium">{total > 0 ? ((open/total)*100).toFixed(1) : 0}%</span></div>
            </div>
            <div className="absolute top-full left-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

        {/* Высокий риск */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Высокий риск</p>
          <p className="text-2xl font-bold text-orange-600">{high}</p>
          <p className="text-xs text-gray-400 mt-1">{total > 0 ? ((high/total)*100).toFixed(0) : 0}% от всех</p>
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-52 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">По уровню риска</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Низкий:</span><span className="text-green-400">{incidents.filter(i => i.risk_level === 'Низкий').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Средний:</span><span className="text-yellow-400">{incidents.filter(i => i.risk_level === 'Средний').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Высокий:</span><span className="text-orange-400">{incidents.filter(i => i.risk_level === 'Высокий').length}</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Экстремальный:</span><span className="text-red-400">{incidents.filter(i => i.risk_level === 'Экстремальные').length}</span></div>
            </div>
            <div className="absolute top-full left-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

        {/* Ущерб */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Ущерб (TJS)</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalLoss)}</p>
          {lossDiff && <p className={`text-xs mt-1 font-medium ${parseFloat(lossDiff) > 0 ? 'text-red-500' : 'text-green-600'}`}>{parseFloat(lossDiff) > 0 ? '▲' : '▼'} {Math.abs(parseFloat(lossDiff))}% vs {year-1}</p>}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">Детали ущерба</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Итого ущерб:</span><span className="text-red-300">{fmt(totalLoss)} TJS</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Пред. год ({year-1}):</span><span>{fmt(prevLoss)} TJS</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1"><span className="text-gray-300">Среднее на инцидент:</span><span>{total > 0 ? fmt(Math.round(totalLoss/total)) : '—'} TJS</span></div>
            </div>
            <div className="absolute top-full left-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

        {/* Возврат */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Возврат (TJS)</p>
          <p className="text-2xl font-bold text-[#1B8A4C]">{fmt(totalRecovery)}</p>
          <p className="text-xs text-gray-400 mt-1">{recoveryRate}% от ущерба</p>
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">Детали возврата</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Возвращено:</span><span className="text-green-400">{fmt(totalRecovery)} TJS</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Не возвращено:</span><span className="text-red-400">{fmt(Math.max(0, totalLoss - totalRecovery))} TJS</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1"><span className="text-gray-300">Возвратность:</span><span className="font-bold text-green-400">{recoveryRate}%</span></div>
            </div>
            <div className="absolute top-full left-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

        {/* Возвратность */}
        <div className={`${card} group relative cursor-default`}>
          <p className="text-xs text-gray-500 mb-1">Возвратность</p>
          <p className="text-2xl font-bold text-[#1B8A4C]">{recoveryRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{fmt(totalRecovery)} / {fmt(totalLoss)}</p>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-30 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
            <p className="font-semibold mb-2 border-b border-white/20 pb-1.5">Коэффициент возвратности</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-300">Возвращено:</span><span className="text-green-400">{fmt(totalRecovery)} TJS</span></div>
              <div className="flex justify-between"><span className="text-gray-300">Общий ущерб:</span><span>{fmt(totalLoss)} TJS</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1"><span className="text-gray-300">Коэффициент:</span><span className="font-bold text-green-400">{recoveryRate}%</span></div>
            </div>
            <div className="absolute top-full right-5 -mt-px border-4 border-transparent border-t-gray-900" />
          </div>
        </div>

      </div>

      {/* Top 3 */}
      {top3.length > 0 && (
        <div className={card}>
          <p className={title}>🔴 Топ 3 крупнейших инцидента по ущербу</p>
          <div className="space-y-3">
            {top3.map((inc, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold ${i === 0 ? 'bg-red-600' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500'}`}>{i+1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inc.business_process || '—'}</p>
                    <p className="text-xs text-gray-500">{inc.department} · {inc.discovery_date ? new Date(inc.discovery_date).toLocaleDateString('ru-RU') : '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{fmt(inc.loss_amount_tjs || 0)} TJS</p>
                  <p className="text-xs text-green-600">возврат: {fmt(inc.recovery_amount || 0)} TJS</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ущерб по месяцам */}
      <div className={card}>
        <p className={title}>Ущерб, возврат и количество инцидентов по месяцам</p>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={filterMonth ? monthData.filter((_,i) => i === parseInt(filterMonth) - 1) : monthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number, name: string) => name === 'Кол-во' ? [v, name] : [fmt(v), name]} />
            <Legend />
            <Bar yAxisId="left" dataKey="loss" name="Ущерб (TJS)" fill="#EF4444" radius={[4,4,0,0]} />
            <Bar yAxisId="left" dataKey="recovery" name="Возврат (TJS)" fill="#1B8A4C" radius={[4,4,0,0]} />
            <Line yAxisId="right" type="monotone" dataKey="count" name="Кол-во" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* По бизнес-процессам и системам */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <p className={title}>Ущерб и возврат по бизнес-процессам (TJS)</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bpData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={150} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="loss" name="Ущерб" fill="#EF4444" radius={[0,4,4,0]} />
              <Bar dataKey="recovery" name="Возврат" fill="#1B8A4C" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={card}>
          <p className={title}>Ущерб и возврат по системам (TJS)</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={systemData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={130} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="loss" name="Ущерб" fill="#EF4444" radius={[0,4,4,0]} />
              <Bar dataKey="recovery" name="Возврат" fill="#1B8A4C" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* По факторам */}
      <div className={card}>
        <p className={title}>Ущерб и возврат по факторам риска (TJS)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={factorData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey="loss" name="Ущерб" fill="#EF4444" radius={[0,4,4,0]} />
            <Bar dataKey="recovery" name="Возврат" fill="#1B8A4C" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* По степени риска + Статус */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <p className={title}>По степени риска</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" radius={[4,4,0,0]}>
                {riskData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.name] || '#6B7280'} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={card}>
          <p className={title}>По статусу инцидентов</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={75}>
                {statusData.map((_, i) => <Cell key={i} fill={['#3B82F6','#F59E0B','#1B8A4C'][i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Частота + Клиент */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <p className={title}>По частоте повторений</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={frequencyData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={75}>
                {frequencyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={card}>
          <p className={title}>По статусу работы с клиентами</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clientStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={150} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" fill="#F59E0B" radius={[0,4,4,0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Подразделения */}
      <div className={card}>
        <p className={title}>Топ подразделений по количеству инцидентов</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={deptData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={180} />
            <Tooltip />
            <Bar dataKey="count" name="Количество" fill="#8B5CF6" radius={[0,4,4,0]}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет данных за {year} год</p>
        </div>
      )}
    </div>
  )
}

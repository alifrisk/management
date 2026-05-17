'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, LabelList
} from 'recharts'
import { TrendingDown, TrendingUp, Shield, AlertTriangle, Download, Filter } from 'lucide-react'

const COLORS = ['#1B8A4C', '#2EAD62', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899']
const RISK_COLORS: Record<string, string> = {
  'Низкий': '#16a34a',
  'Средний': '#ca8a04',
  'Высокий': '#ea580c',
  'Экстремальные': '#dc2626',
}

interface Incident {
  factor: string
  business_process: string
  risk_level: string
  incident_status: string
  client_work_status: string
  frequency: string
  department: string
  system: string
  loss_amount_tjs: number
  recovery_amount: number
  discovery_date: string
  incident_date: string
}

const MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [filterDept, setFilterDept] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('operational_incidents')
      .select('factor, business_process, risk_level, incident_status, client_work_status, frequency, department, system, loss_amount_tjs, recovery_amount, discovery_date, incident_date')
      .gte('discovery_date', `${year}-01-01`)
      .lte('discovery_date', `${year}-12-31`)

    if (filterDept) query = query.eq('department', filterDept)

    const { data } = await query
    setIncidents(data || [])
    setLoading(false)
  }, [year, filterDept])

  useEffect(() => { fetchData() }, [fetchData])

  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

  // Stats
  const total = incidents.length
  const totalLoss = incidents.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0)
  const totalRecovery = incidents.reduce((s, i) => s + (i.recovery_amount || 0), 0)
  const recoveryRate = totalLoss > 0 ? (totalRecovery / totalLoss * 100).toFixed(1) : '0'
  const extreme = incidents.filter(i => i.risk_level === 'Экстремальные').length
  const open = incidents.filter(i => i.incident_status === 'Открыт').length

  // By factor
  const factorData = ['Риск систем', 'Риск человеческого фактора', 'Риск внутренний процесс', 'Юридический риск', 'Внешний риск'].map(f => ({
    name: f.replace('Риск ', '').replace(' фактора', ''),
    count: incidents.filter(i => i.factor === f).length,
    loss: incidents.filter(i => i.factor === f).reduce((s, i) => s + (i.loss_amount_tjs || 0), 0),
  })).filter(d => d.count > 0)

  // By risk level
  const riskData = ['Низкий', 'Средний', 'Высокий', 'Экстремальные'].map(r => ({
    name: r,
    count: incidents.filter(i => i.risk_level === r).length,
    loss: incidents.filter(i => i.risk_level === r).reduce((s, i) => s + (i.loss_amount_tjs || 0), 0),
  })).filter(d => d.count > 0)

  // By month
  const monthData = MONTHS.map((month, idx) => {
    const monthIncidents = incidents.filter(i => {
      if (!i.discovery_date) return false
      const m = new Date(i.discovery_date).getMonth()
      return m === idx
    })
    return {
      name: month.slice(0, 3),
      count: monthIncidents.length,
      loss: monthIncidents.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0),
      recovery: monthIncidents.reduce((s, i) => s + (i.recovery_amount || 0), 0),
    }
  })

  // By status
  const statusData = ['Открыт', 'В процессе', 'Закрыт'].map(s => ({
    name: s,
    value: incidents.filter(i => i.incident_status === s).length,
  })).filter(d => d.value > 0)

  // By client work status
  const clientStatusData = ['В процессе обзвона', 'В ожидании возмещения', 'Возмещенно', 'Невозмещаемый', 'Нефинансовый инцидент', 'Процесс возмещения не начался', 'Процесс возмещения не идет'].map(s => ({
    name: s.length > 20 ? s.slice(0, 20) + '...' : s,
    fullName: s,
    count: incidents.filter(i => i.client_work_status === s).length,
  })).filter(d => d.count > 0)

  // By frequency
  const frequencyData = ['Часто повторяющиеся', 'Редко повторяющиеся', 'Единичный случай'].map(f => ({
    name: f,
    value: incidents.filter(i => i.frequency === f).length,
  })).filter(d => d.value > 0)

  // By system
  const systemData = Object.entries(
    incidents.reduce((acc, i) => {
      if (i.system) acc[i.system] = (acc[i.system] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  // By top business processes
  const bpData = Object.entries(
    incidents.reduce((acc, i) => {
      if (i.business_process) acc[i.business_process] = (acc[i.business_process] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({
    name: name.length > 20 ? name.slice(0, 20) + '...' : name,
    count
  }))

  // By top departments
  const deptData = Object.entries(
    incidents.reduce((acc, i) => {
      if (i.department) acc[i.department] = (acc[i.department] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({
    name: name.length > 25 ? name.slice(0, 25) + '...' : name,
    count
  }))

  const cardCls = "bg-white rounded-xl border border-gray-100 shadow-sm p-5"
  const titleCls = "text-sm font-semibold text-gray-700 mb-4"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Загрузка данных...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд — Операционный риск</h1>
          <p className="text-sm text-gray-500 mt-0.5">Аналитика инцидентов за {year} год</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
          >
            {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Всего инцидентов</p>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Открытые</p>
          <p className="text-3xl font-bold text-blue-600">{open}</p>
        </div>
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Экстремальные</p>
          <p className="text-3xl font-bold text-red-600">{extreme}</p>
        </div>
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Ущерб (TJS)</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalLoss)}</p>
        </div>
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Возврат (TJS)</p>
          <p className="text-2xl font-bold text-[#1B8A4C]">{fmt(totalRecovery)}</p>
        </div>
        <div className={cardCls + ' lg:col-span-1'}>
          <p className="text-xs text-gray-500 mb-1">Возвратность</p>
          <p className="text-2xl font-bold text-[#1B8A4C]">{recoveryRate}%</p>
        </div>
      </div>

      {/* Row 1: Monthly trend + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cardCls + ' lg:col-span-2'}>
          <p className={titleCls}>Динамика инцидентов по месяцам</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name="Кол-во" stroke="#1B8A4C" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={cardCls}>
          <p className={titleCls}>По статусу инцидентов</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={['#3B82F6', '#F59E0B', '#1B8A4C'][i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: By factor + By risk level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <p className={titleCls}>Количество инцидентов по факторам</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={factorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" fill="#1B8A4C" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={cardCls}>
          <p className={titleCls}>По степени риска</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" radius={[4, 4, 0, 0]}>
                {riskData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.name] || '#6B7280'} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Monthly loss + recovery */}
      <div className={cardCls}>
        <p className={titleCls}>Ущерб и возврат по месяцам (TJS)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey="loss" name="Ущерб" fill="#EF4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recovery" name="Возврат" fill="#1B8A4C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4: By system + By frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <p className={titleCls}>По системам</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={systemData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" fill="#2EAD62" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={cardCls}>
          <p className={titleCls}>По частоте повторений</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={frequencyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}`}>
                {frequencyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5: By business process */}
      <div className={cardCls}>
        <p className={titleCls}>Топ бизнес-процессов по количеству инцидентов</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={bpData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={180} />
            <Tooltip />
            <Bar dataKey="count" name="Количество" fill="#1B8A4C" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 6: By department + client status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardCls}>
          <p className={titleCls}>Топ подразделений по инцидентам</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={170} />
              <Tooltip />
              <Bar dataKey="count" name="Количество" fill="#8B5CF6" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={cardCls}>
          <p className={titleCls}>По статусу работы с клиентами</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={clientStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={150} />
              <Tooltip formatter={(v, n, p) => [v, p.payload.fullName]} />
              <Bar dataKey="count" name="Количество" fill="#F59E0B" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет данных за {year} год</p>
          <p className="text-sm mt-1">Добавьте инциденты в реестр</p>
        </div>
      )}
    </div>
  )
}

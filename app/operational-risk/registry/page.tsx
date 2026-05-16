'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Search, Filter, Download, Eye, Edit2, Trash2, Bell, ChevronDown, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { formatDate, formatCurrency, getRiskLevelColor, getStatusColor, cn } from '@/lib/utils'
import { BUSINESS_PROCESSES, RISK_FACTORS, SYSTEMS, DEPARTMENTS, INCIDENT_STATUSES, EVENT_CATEGORIES_L1, EVENT_CATEGORIES_L2, CURRENCIES, PROBABILITY_SCORES, IMPACT_SCORES, CONTROL_SCORES, INCIDENT_FREQUENCIES, CLIENT_WORK_STATUSES, MONTHS } from '@/lib/constants'

interface Incident {
  id: string
  incident_number: number
  event_category_l1: string
  event_category_l2: string
  event_category_l3: string
  business_process: string
  case_description: string
  repeat_count: number
  system: string
  cause: string
  factor: string
  frequency: string
  employee_involved: string
  incident_location: string
  department: string
  discovered_by: string
  disclosure: string
  discovery_date: string
  incident_date: string
  loss_amount: number
  currency: string
  loss_amount_tjs: number
  recovery_amount: number
  remainder: number
  recovery_rate: number
  incident_status: string
  client_work_status: string
  system_link: string
  transaction_count: number
  probability: number
  impact: number
  control_quality: number
  probability_score: number
  impact_score: number
  risk_level: string
  plans: string
  actual_execution: string
  control_status: string
  responsible: string
  source: string
  created_at: string
}

interface IncidentForm {
  id: string
  discovered_by: string
  business_process: string
  factor: string
  cause: string
  system: string
  discovery_date: string
  incident_date: string
  loss_amount: number
  recovery_amount: number
  disclosure: string
  department: string
  submitted_by: string
  status: string
  created_at: string
}

const EMPTY_FORM = {
  event_category_l1: '',
  event_category_l2: '',
  event_category_l3: '',
  business_process: '',
  case_description: '',
  repeat_count: 1,
  system: '',
  cause: '',
  factor: '',
  frequency: '',
  employee_involved: '',
  incident_location: '',
  department: '',
  discovered_by: '',
  disclosure: '',
  discovery_date: '',
  incident_date: '',
  loss_amount: '',
  currency: 'TJS',
  loss_amount_tjs: '',
  recovery_amount: '',
  incident_status: 'Открыт',
  client_work_status: '',
  system_link: '',
  transaction_count: '',
  probability: '',
  impact: '',
  control_quality: '',
  probability_score: '',
  impact_score: '',
  risk_level: '',
  plans: '',
  actual_execution: '',
  control_status: '',
  responsible: '',
}

export default function RegistryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pendingForms, setPendingForms] = useState<IncidentForm[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(1)
  const [formData, setFormData] = useState<Record<string, unknown>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', factor: '', system: '', department: '', risk_level: '', year: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null)

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('operational_incidents').select('*').order('incident_number', { ascending: false })
    if (filters.status) query = query.eq('incident_status', filters.status)
    if (filters.factor) query = query.eq('factor', filters.factor)
    if (filters.system) query = query.eq('system', filters.system)
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.risk_level) query = query.eq('risk_level', filters.risk_level)
    if (filters.year) query = query.gte('incident_date', `${filters.year}-01-01`).lte('incident_date', `${filters.year}-12-31`)
    const { data } = await query
    setIncidents(data || [])
    setLoading(false)
  }, [filters])

  const fetchPendingForms = useCallback(async () => {
    const { data } = await supabase.from('incident_forms').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setPendingForms(data || [])
  }, [])

  useEffect(() => { fetchIncidents(); fetchPendingForms() }, [fetchIncidents, fetchPendingForms])

  function handleChange(field: string, value: unknown) {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'probability' || field === 'impact') {
        const p = Number(field === 'probability' ? value : prev.probability) || 0
        const i = Number(field === 'impact' ? value : prev.impact) || 0
        const score = p * i
        updated.risk_level = score <= 4 ? 'Низкий' : score <= 9 ? 'Средний' : score <= 16 ? 'Высокий' : 'Экстремальные'
      }
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      event_category_l1: formData.event_category_l1,
      event_category_l2: formData.event_category_l2,
      event_category_l3: formData.event_category_l3,
      business_process: formData.business_process,
      case_description: formData.case_description,
      repeat_count: Number(formData.repeat_count) || 1,
      system: formData.system,
      cause: formData.cause,
      factor: formData.factor,
      frequency: formData.frequency,
      employee_involved: formData.employee_involved || null,
      incident_location: formData.incident_location || null,
      department: formData.department,
      discovered_by: formData.discovered_by,
      disclosure: formData.disclosure,
      discovery_date: formData.discovery_date || null,
      incident_date: formData.incident_date || null,
      loss_amount: formData.loss_amount ? Number(formData.loss_amount) : null,
      currency: formData.currency,
      loss_amount_tjs: formData.loss_amount_tjs ? Number(formData.loss_amount_tjs) : null,
      recovery_amount: formData.recovery_amount ? Number(formData.recovery_amount) : null,
      incident_status: formData.incident_status,
      client_work_status: formData.client_work_status || null,
      system_link: formData.system_link || null,
      transaction_count: formData.transaction_count ? Number(formData.transaction_count) : null,
      probability: formData.probability ? Number(formData.probability) : null,
      impact: formData.impact ? Number(formData.impact) : null,
      control_quality: formData.control_quality ? Number(formData.control_quality) : null,
      probability_score: formData.probability_score ? Number(formData.probability_score) : null,
      impact_score: formData.impact_score ? Number(formData.impact_score) : null,
      risk_level: formData.risk_level || null,
      plans: formData.plans || null,
      actual_execution: formData.actual_execution || null,
      control_status: formData.control_status || null,
      responsible: formData.responsible || null,
      source: 'admin',
    }

    let err
    if (editingId) {
      const { error: e } = await supabase.from('operational_incidents').update(payload).eq('id', editingId)
      err = e
    } else {
      const { error: e } = await supabase.from('operational_incidents').insert(payload)
      err = e
    }

    if (err) { setError('Ошибка сохранения: ' + err.message); setSaving(false); return }
    setShowModal(false)
    setFormData(EMPTY_FORM)
    setEditingId(null)
    setActiveTab(1)
    fetchIncidents()
    setSaving(false)
  }

  function openEdit(incident: Incident) {
    setFormData({
      ...incident,
      loss_amount: incident.loss_amount || '',
      loss_amount_tjs: incident.loss_amount_tjs || '',
      recovery_amount: incident.recovery_amount || '',
      transaction_count: incident.transaction_count || '',
      probability: incident.probability || '',
      impact: incident.impact || '',
      control_quality: incident.control_quality || '',
      probability_score: incident.probability_score || '',
      impact_score: incident.impact_score || '',
    })
    setEditingId(incident.id)
    setActiveTab(1)
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить инцидент?')) return
    await supabase.from('operational_incidents').delete().eq('id', id)
    fetchIncidents()
  }

  async function processForm(form: IncidentForm) {
    setFormData({
      ...EMPTY_FORM,
      discovered_by: form.discovered_by,
      business_process: form.business_process,
      factor: form.factor,
      cause: form.cause,
      system: form.system,
      discovery_date: form.discovery_date,
      incident_date: form.incident_date,
      loss_amount: form.loss_amount || '',
      recovery_amount: form.recovery_amount || '',
      disclosure: form.disclosure,
      department: form.department,
    })
    await supabase.from('incident_forms').update({ status: 'processed' }).eq('id', form.id)
    fetchPendingForms()
    setShowFormsModal(false)
    setActiveTab(1)
    setShowModal(true)
  }

  const filtered = incidents.filter(i =>
    !search ||
    i.case_description?.toLowerCase().includes(search.toLowerCase()) ||
    i.business_process?.toLowerCase().includes(search.toLowerCase()) ||
    i.discovered_by?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.incident_number).includes(search)
  )

  const getRiskBg = (level: string) => {
    if (level === 'Экстремальные') return 'bg-red-100 text-red-800'
    if (level === 'Высокий') return 'bg-orange-100 text-orange-800'
    if (level === 'Средний') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusBg = (status: string) => {
    if (status === 'Открыт') return 'bg-blue-100 text-blue-800'
    if (status === 'В процессе') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent bg-white"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Реестр операционных инцидентов</h1>
          <p className="text-sm text-gray-500 mt-0.5">Учёт и управление операционными инцидентами</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingForms.length > 0 && (
            <button onClick={() => setShowFormsModal(true)} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
              <Bell className="w-4 h-4" />
              {pendingForms.length} новых анкет
            </button>
          )}
          <button
            onClick={() => { setFormData(EMPTY_FORM); setEditingId(null); setActiveTab(1); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить инцидент
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего', value: incidents.length, color: 'text-gray-900' },
          { label: 'Открытые', value: incidents.filter(i => i.incident_status === 'Открыт').length, color: 'text-blue-600' },
          { label: 'В процессе', value: incidents.filter(i => i.incident_status === 'В процессе').length, color: 'text-yellow-600' },
          { label: 'Закрытые', value: incidents.filter(i => i.incident_status === 'Закрыт').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по номеру, описанию, координатору..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn('flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors', showFilters ? 'bg-[#1B8A4C] text-white border-[#1B8A4C]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
            <Filter className="w-4 h-4" /> Фильтры
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-gray-100">
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className={inputCls}>
              <option value="">Все статусы</option>
              {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.factor} onChange={e => setFilters(p => ({ ...p, factor: e.target.value }))} className={inputCls}>
              <option value="">Все факторы</option>
              {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filters.system} onChange={e => setFilters(p => ({ ...p, system: e.target.value }))} className={inputCls}>
              <option value="">Все системы</option>
              {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.risk_level} onChange={e => setFilters(p => ({ ...p, risk_level: e.target.value }))} className={inputCls}>
              <option value="">Все риски</option>
              {['Низкий', 'Средний', 'Высокий', 'Экстремальные'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))} className={inputCls}>
              <option value="">Все годы</option>
              {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setFilters({ status: '', factor: '', system: '', department: '', risk_level: '', year: '' })} className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">№</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Дата</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Категория</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Бизнес-процесс</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Фактор</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Система</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Ущерб (TJS)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Риск</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">Инцидентов не найдено</td></tr>
              ) : (
                filtered.map(incident => (
                  <tr key={incident.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">#{incident.incident_number}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(incident.incident_date)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={incident.event_category_l1}>{incident.event_category_l1?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={incident.business_process}>{incident.business_process}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{incident.factor}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{incident.system}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap font-medium">
                      {incident.loss_amount_tjs ? new Intl.NumberFormat('ru-RU').format(incident.loss_amount_tjs) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {incident.risk_level ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRiskBg(incident.risk_level)}`}>
                          {incident.risk_level}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBg(incident.incident_status)}`}>
                        {incident.incident_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewingIncident(incident)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEdit(incident)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(incident.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            Показано {filtered.length} из {incidents.length} инцидентов
          </div>
        )}
      </div>

      {/* Pending Forms Modal */}
      {showFormsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Новые анкеты от координаторов ({pendingForms.length})</h2>
              <button onClick={() => setShowFormsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {pendingForms.map(form => (
                <div key={form.id} className="border border-gray-100 rounded-xl p-4 hover:border-[#1B8A4C]/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900 text-sm">{form.discovered_by}</p>
                      <p className="text-xs text-gray-500">{form.department} · {form.business_process}</p>
                      <p className="text-xs text-gray-600 mt-1">{form.disclosure}</p>
                      <p className="text-xs text-gray-400">{formatDate(form.created_at)}</p>
                    </div>
                    <button onClick={() => processForm(form)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040] transition-colors whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Обработать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Инцидент #{viewingIncident.incident_number}</h2>
              <button onClick={() => setViewingIncident(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Категория (Ур. 1)', viewingIncident.event_category_l1?.replace(/_/g, ' ')],
                  ['Категория (Ур. 2)', viewingIncident.event_category_l2],
                  ['Бизнес-процесс', viewingIncident.business_process],
                  ['Фактор', viewingIncident.factor],
                  ['Система', viewingIncident.system],
                  ['Причина', viewingIncident.cause],
                  ['Обнаружил', viewingIncident.discovered_by],
                  ['Подразделение', viewingIncident.department],
                  ['Дата обнаружения', formatDate(viewingIncident.discovery_date)],
                  ['Дата инцидента', formatDate(viewingIncident.incident_date)],
                  ['Сумма ущерба', viewingIncident.loss_amount_tjs ? `${new Intl.NumberFormat('ru-RU').format(viewingIncident.loss_amount_tjs)} TJS` : '—'],
                  ['Возврат', viewingIncident.recovery_amount ? `${new Intl.NumberFormat('ru-RU').format(viewingIncident.recovery_amount)} TJS` : '—'],
                  ['Вероятность', viewingIncident.probability || '—'],
                  ['Влияние', viewingIncident.impact || '—'],
                  ['Уровень риска', viewingIncident.risk_level || '—'],
                  ['Статус', viewingIncident.incident_status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>
              {viewingIncident.disclosure && (
                <div>
                  <p className="text-xs text-gray-500">Раскрытие</p>
                  <p className="text-sm text-gray-900 mt-0.5 bg-gray-50 rounded-lg p-3">{viewingIncident.disclosure}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setViewingIncident(null); openEdit(viewingIncident) }} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                <Edit2 className="w-4 h-4" /> Редактировать
              </button>
              <button onClick={() => setViewingIncident(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Редактировать инцидент' : 'Новый инцидент'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Реестр операционных инцидентов</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {[
                { n: 1, label: 'Классификация' },
                { n: 2, label: 'Идентификация' },
                { n: 3, label: 'Анализ' },
                { n: 4, label: 'Воздействие' },
                { n: 5, label: 'Оценка' },
              ].map(tab => (
                <button
                  key={tab.n}
                  onClick={() => setActiveTab(tab.n)}
                  className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap', activeTab === tab.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700')}
                >
                  {tab.n}. {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* ЭТАП 1: Классификация */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Категория типа событий (Уровень 1) *</label>
                      <select value={String(formData.event_category_l1)} onChange={e => handleChange('event_category_l1', e.target.value)} className={inputCls}>
                        <option value="">Выберите категорию</option>
                        {EVENT_CATEGORIES_L1.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Категория инцидентов (Уровень 2) *</label>
                      <select value={String(formData.event_category_l2)} onChange={e => handleChange('event_category_l2', e.target.value)} className={inputCls}>
                        <option value="">Выберите категорию</option>
                        {formData.event_category_l1 && EVENT_CATEGORIES_L2[String(formData.event_category_l1)]?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Пример действий (Уровень 3)</label>
                      <input type="text" value={String(formData.event_category_l3)} onChange={e => handleChange('event_category_l3', e.target.value)} placeholder="Описание действия" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Бизнес-процесс *</label>
                      <select value={String(formData.business_process)} onChange={e => handleChange('business_process', e.target.value)} className={inputCls}>
                        <option value="">Выберите процесс</option>
                        {BUSINESS_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Фактор риска *</label>
                      <select value={String(formData.factor)} onChange={e => handleChange('factor', e.target.value)} className={inputCls}>
                        <option value="">Выберите фактор</option>
                        {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Система *</label>
                      <select value={String(formData.system)} onChange={e => handleChange('system', e.target.value)} className={inputCls}>
                        <option value="">Выберите систему</option>
                        {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Частота повторений</label>
                      <select value={String(formData.frequency)} onChange={e => handleChange('frequency', e.target.value)} className={inputCls}>
                        <option value="">Выберите частоту</option>
                        {INCIDENT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Количество повторений</label>
                      <input type="number" min="1" value={String(formData.repeat_count)} onChange={e => handleChange('repeat_count', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Подразделение *</label>
                      <select value={String(formData.department)} onChange={e => handleChange('department', e.target.value)} className={inputCls}>
                        <option value="">Выберите подразделение</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Сотрудник допустивший инцидент (чел. фактор)</label>
                      <input type="text" value={String(formData.employee_involved)} onChange={e => handleChange('employee_involved', e.target.value)} placeholder="ФИО сотрудника" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Место происшествия</label>
                      <input type="text" value={String(formData.incident_location)} onChange={e => handleChange('incident_location', e.target.value)} placeholder="Место" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Причины *</label>
                      <input type="text" value={String(formData.cause)} onChange={e => handleChange('cause', e.target.value)} placeholder="Причина инцидента" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Описание кейса</label>
                    <textarea value={String(formData.case_description)} onChange={e => handleChange('case_description', e.target.value)} rows={3} placeholder="Подробное описание инцидента" className={inputCls + ' resize-none'} />
                  </div>
                </div>
              )}

              {/* ЭТАП 2: Идентификация */}
              {activeTab === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Риск-координатор обнаруживший инцидент *</label>
                    <input type="text" value={String(formData.discovered_by)} onChange={e => handleChange('discovered_by', e.target.value)} placeholder="ФИО" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Дата обнаружения *</label>
                    <input type="date" value={String(formData.discovery_date)} onChange={e => handleChange('discovery_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Фактическая дата инцидента *</label>
                    <input type="date" value={String(formData.incident_date)} onChange={e => handleChange('incident_date', e.target.value)} className={inputCls} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={labelCls}>Раскрытие *</label>
                    <textarea value={String(formData.disclosure)} onChange={e => handleChange('disclosure', e.target.value)} rows={4} placeholder="Подробное описание инцидента..." className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className={labelCls}>Ссылка в Mobi или ID транзакции</label>
                    <input type="text" value={String(formData.system_link)} onChange={e => handleChange('system_link', e.target.value)} placeholder="ID или ссылка" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Количество транзакций</label>
                    <input type="number" min="0" value={String(formData.transaction_count)} onChange={e => handleChange('transaction_count', e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* ЭТАП 3: Анализ (Финансовое воздействие) */}
              {activeTab === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Сумма ущерба</label>
                    <input type="number" min="0" step="0.01" value={String(formData.loss_amount)} onChange={e => handleChange('loss_amount', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Валюта</label>
                    <select value={String(formData.currency)} onChange={e => handleChange('currency', e.target.value)} className={inputCls}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Сумма в сомони (TJS)</label>
                    <input type="number" min="0" step="0.01" value={String(formData.loss_amount_tjs)} onChange={e => handleChange('loss_amount_tjs', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Сумма возврата</label>
                    <input type="number" min="0" step="0.01" value={String(formData.recovery_amount)} onChange={e => handleChange('recovery_amount', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  {formData.loss_amount_tjs && formData.recovery_amount && (
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Остаток</p>
                        <p className="text-lg font-bold text-red-600 mt-0.5">
                          {new Intl.NumberFormat('ru-RU').format(Number(formData.loss_amount_tjs) - Number(formData.recovery_amount))} TJS
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Уровень возврата</p>
                        <p className="text-lg font-bold text-green-600 mt-0.5">
                          {Number(formData.loss_amount_tjs) > 0 ? ((Number(formData.recovery_amount) / Number(formData.loss_amount_tjs)) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ЭТАП 4: Воздействие (Статусы) */}
              {activeTab === 4 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Статус работы с инцидентом *</label>
                    <select value={String(formData.incident_status)} onChange={e => handleChange('incident_status', e.target.value)} className={inputCls}>
                      {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Статус работы с клиентом</label>
                    <select value={String(formData.client_work_status)} onChange={e => handleChange('client_work_status', e.target.value)} className={inputCls}>
                      <option value="">Выберите статус</option>
                      {CLIENT_WORK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Планы мероприятий</label>
                    <textarea value={String(formData.plans)} onChange={e => handleChange('plans', e.target.value)} rows={3} placeholder="Планируемые мероприятия..." className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className={labelCls}>Фактическое исполнение</label>
                    <textarea value={String(formData.actual_execution)} onChange={e => handleChange('actual_execution', e.target.value)} rows={3} placeholder="Фактически выполненные действия..." className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className={labelCls}>Ответственный</label>
                    <input type="text" value={String(formData.responsible)} onChange={e => handleChange('responsible', e.target.value)} placeholder="ФИО ответственного" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Статус контроля</label>
                    <input type="text" value={String(formData.control_status)} onChange={e => handleChange('control_status', e.target.value)} placeholder="Статус" className={inputCls} />
                  </div>
                </div>
              )}

              {/* ЭТАП 5: Оценка */}
              {activeTab === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Вероятность *</label>
                      <select value={String(formData.probability)} onChange={e => handleChange('probability', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {PROBABILITY_SCORES.map(p => <option key={p.value} value={p.value}>{p.value} — {p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Влияние *</label>
                      <select value={String(formData.impact)} onChange={e => handleChange('impact', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {IMPACT_SCORES.map(i => <option key={i.value} value={i.value}>{i.value} — {i.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Контроль и регулирование</label>
                      <select value={String(formData.control_quality)} onChange={e => handleChange('control_quality', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {CONTROL_SCORES.map(c => <option key={c.value} value={c.value}>{c.value} — {c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Оценка вероятности</label>
                      <input type="number" step="0.1" value={String(formData.probability_score)} onChange={e => handleChange('probability_score', e.target.value)} placeholder="0.0" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Оценка влияния</label>
                      <input type="number" step="0.1" value={String(formData.impact_score)} onChange={e => handleChange('impact_score', e.target.value)} placeholder="0.0" className={inputCls} />
                    </div>
                  </div>

                  {formData.risk_level && (
                    <div className={`p-4 rounded-xl border-2 ${formData.risk_level === 'Экстремальные' ? 'bg-red-50 border-red-200' : formData.risk_level === 'Высокий' ? 'bg-orange-50 border-orange-200' : formData.risk_level === 'Средний' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-gray-500 mb-1">Степень риска (автоматически)</p>
                      <p className={`text-xl font-bold ${formData.risk_level === 'Экстремальные' ? 'text-red-700' : formData.risk_level === 'Высокий' ? 'text-orange-700' : formData.risk_level === 'Средний' ? 'text-yellow-700' : 'text-green-700'}`}>
                        {String(formData.risk_level)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Вероятность × Влияние = {Number(formData.probability) * Number(formData.impact)} баллов
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-between">
              <div className="flex gap-2">
                {activeTab > 1 && (
                  <button onClick={() => setActiveTab(activeTab - 1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ← Назад
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Отмена
                </button>
                {activeTab < 5 ? (
                  <button onClick={() => setActiveTab(activeTab + 1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                    Далее →
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                    {saving ? <><Clock className="w-4 h-4 animate-spin" /> Сохранение...</> : <><CheckCircle2 className="w-4 h-4" /> Сохранить</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

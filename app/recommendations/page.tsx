'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/supabase/client'
import { Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, Clock, Filter, Search, Eye, Download, Upload, FileText } from 'lucide-react'

interface Recommendation {
  id: string
  rec_number: number
  title: string
  description: string
  source_type: string
  report_name: string
  report_date: string
  acceptance_status: string
  acceptance_notes: string
  acceptance_date: string
  priority: string
  responsible: string
  department: string
  due_date: string
  status: string
  completion_date: string
  completion_notes: string
  created_by: string
  created_at: string
  attachment_url: string
  attachment_name: string
}

const SOURCE_TYPES = [
  { value: 'report', label: 'Гузориш (рапорт)' },
  { value: 'conclusion', label: 'Заключение' },
  { value: 'initiative', label: 'Собственная инициатива' },
]

const ACCEPTANCE_STATUSES = ['На рассмотрении', 'Принята', 'Не принята']
const EXEC_STATUSES = ['Открыта', 'В процессе', 'Выполнена', 'Просрочена']
const PRIORITIES = ['Высокий', 'Средний', 'Низкий']
const PAGE_SIZE = 20

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const EMPTY_FORM = {
  title: '', description: '',
  source_type: 'report', report_name: '', report_date: '',
  acceptance_status: 'На рассмотрении', acceptance_notes: '', acceptance_date: '',
  priority: 'Средний', responsible: '', department: '',
  due_date: '', status: 'Открыта', completion_date: '',
  completion_notes: '', created_by: '',
}

const getStatusStyle = (s: string) => {
  if (s === 'Выполнена') return 'bg-green-100 text-green-800'
  if (s === 'В процессе') return 'bg-blue-100 text-blue-800'
  if (s === 'Просрочена') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-800'
}

const getAcceptStyle = (s: string) => {
  if (s === 'Принята') return 'bg-green-100 text-green-700'
  if (s === 'Не принята') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

const getPriorityStyle = (p: string) => {
  if (p === 'Высокий') return 'bg-red-100 text-red-700'
  if (p === 'Средний') return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

const getDaysLeft = (d: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

export default function RecommendationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAccept, setFilterAccept] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('recommendations').select('*').order('created_at', { ascending: false })
    if (filterYear) q = q.gte('created_at', `${filterYear}-01-01`).lte('created_at', `${filterYear}-12-31`)
    if (filterYear && filterMonth) q = q.gte('created_at', `${filterYear}-${filterMonth}-01`).lte('created_at', `${filterYear}-${filterMonth}-31`)
    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }, [filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  // Pre-fill from risk map if navigated from there
  useEffect(() => {
    const prefill = sessionStorage.getItem('new_rec_prefill')
    if (prefill) {
      try {
        const data = JSON.parse(prefill)
        setForm(p => ({ ...p, ...data }))
        setShowModal(true)
        sessionStorage.removeItem('new_rec_prefill')
      } catch { /* ignore */ }
    }
  }, [])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const resetPage = () => setCurrentPage(1)
  const [attachment, setAttachment] = useState<File | null>(null)

  function exportToExcel() {
    const headers = ['№','Название','Источник','Рапорт/Заключение','Дата рапорта','Приоритет','Принятие','Ответственный','Подразделение','Срок исполнения','Статус','Дата исполнения','Примечание','Создал','Дата создания']
    const sourceLabels: Record<string,string> = { report: 'Гузориш (рапорт)', conclusion: 'Заключение', initiative: 'Собственная инициатива' }
    const rows = items.map((r, idx) => [
      idx + 1, r.title, sourceLabels[r.source_type] || r.source_type,
      r.report_name || '', r.report_date || '', r.priority,
      r.acceptance_status, r.responsible || '', r.department || '',
      r.due_date || '', r.status, r.completion_date || '',
      r.completion_notes || '', r.created_by || '',
      new Date(r.created_at).toLocaleDateString('ru-RU')
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Реестр_рекомендаций_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Введите название'); return }
    if (form.report_date && form.due_date && form.report_date > form.due_date) {
      setError('Дата рапорта/заключения не может быть позже срока исполнения'); return
    }
    if (form.due_date && form.completion_date && form.completion_date < form.due_date) {
      // allowed - completed early
    }
    setSaving(true); setError(null)
    try {
      // Upload attachment if selected
      let attachment_url = (form as Record<string,string>).attachment_url || null
      let attachment_name = (form as Record<string,string>).attachment_name || null
      if (attachment) {
        const ext = attachment.name.split('.').pop() || 'pdf'
        const path = `rec_${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('vnd-documents').upload(path, attachment)
        if (!uploadErr) {
          attachment_url = path
          attachment_name = attachment.name
        }
      }

      // Convert empty date strings to null
      const payload = {
        ...form,
        report_date: form.report_date || null,
        acceptance_date: form.acceptance_date || null,
        due_date: form.due_date || null,
        completion_date: form.completion_date || null,
        attachment_url,
        attachment_name,
        updated_at: new Date().toISOString(),
      }
      if (editingId) {
        const { error: e } = await supabase.from('recommendations').update(payload).eq('id', editingId)
        if (e) throw new Error(e.message)
      } else {
        const { error: e } = await supabase.from('recommendations').insert(payload)
        if (e) throw new Error(e.message)
      }
      setShowModal(false); setForm(EMPTY_FORM); setAttachment(null); setEditingId(null); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('recommendations').delete().eq('id', id)
    fetch_()
  }

  function openEdit(item: Recommendation) {
    setForm({
      title: item.title, description: item.description || '',
      source_type: item.source_type, report_name: item.report_name || '',
      report_date: item.report_date || '',
      acceptance_status: item.acceptance_status, acceptance_notes: item.acceptance_notes || '',
      acceptance_date: item.acceptance_date || '',
      priority: item.priority, responsible: item.responsible || '',
      department: item.department || '', due_date: item.due_date || '',
      status: item.status, completion_date: item.completion_date || '',
      completion_notes: item.completion_notes || '', created_by: item.created_by || '',
    })
    setEditingId(item.id); setError(null); setShowModal(true)
  }

  const filtered = items.filter(r => {
    if (filterSource && r.source_type !== filterSource) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterAccept && r.acceptance_status !== filterAccept) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.report_name?.toLowerCase().includes(search.toLowerCase()) &&
        !r.responsible?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: items.length,
    accepted: items.filter(r => r.acceptance_status === 'Принята').length,
    notAccepted: items.filter(r => r.acceptance_status === 'Не принята').length,
    done: items.filter(r => r.status === 'Выполнена').length,
    overdue: items.filter(r => r.status === 'Просрочена').length,
  }
  // Только выполненные из принятых
  const doneAndAccepted = items.filter(r => r.acceptance_status === 'Принята' && r.status === 'Выполнена').length
  const completionRate = stats.accepted > 0 ? Math.round((doneAndAccepted / stats.accepted) * 100) : 0

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Реестр рекомендаций СУР</h1>
            <p className="text-sm text-gray-500 mt-0.5">Мониторинг исполнения рекомендаций по рапортам и заключениям</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportToExcel}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setError(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
              <Plus className="w-4 h-4" /> Добавить рекомендацию
            </button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {[
            { label: 'Всего', value: stats.total, c: 'text-gray-900' },
            { label: 'Принята', value: stats.accepted, c: 'text-green-600' },
            { label: 'Не принята', value: stats.notAccepted, c: 'text-red-600' },
            { label: 'Выполнена', value: stats.done, c: 'text-blue-600' },
            { label: 'Просрочена', value: stats.overdue, c: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {stats.accepted > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Исполнение принятых рекомендаций</p>
              <p className="text-sm font-bold text-[#1B8A4C]">{completionRate}%</p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1B8A4C] rounded-full transition-all" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        )}

        {stats.overdue > 0 && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mt-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">{stats.overdue} рекомендаций просрочено!</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] w-48" />
          </div>
          <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
            <option value="">Все годы</option>
            {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
            <option value="">Все месяцы</option>
            {MONTHS.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
            <option value="">Все источники</option>
            {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterAccept} onChange={e => setFilterAccept(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
            <option value="">Все статусы принятия</option>
            {ACCEPTANCE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
            <option value="">Все статусы исполнения</option>
            {EXEC_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(filterSource || filterStatus || filterAccept || filterYear || search) && (
            <button onClick={() => { setFilterSource(''); setFilterStatus(''); setFilterAccept(''); setFilterYear(''); setFilterMonth(''); setSearch('') }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 mt-5">
      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['№','Рекомендация','Источник','Приоритет','Принятие','Ответственный','Срок','Исполнение',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">Рекомендаций нет</td></tr>
                : paginated.map((item, idx) => {
                  const days = getDaysLeft(item.due_date)
                  const source = SOURCE_TYPES.find(s => s.value === item.source_type)
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 cursor-pointer ${item.status === 'Просрочена' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                        {item.report_name && <p className="text-xs text-gray-400 truncate">{item.report_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{source?.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getAcceptStyle(item.acceptance_status)}`}>
                          {item.acceptance_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{item.responsible || '—'}</td>
                      <td className="px-4 py-3">
                        {item.due_date ? (
                          <div>
                            <p className={`text-xs font-medium ${days !== null && days < 0 ? 'text-red-600' : days !== null && days <= 7 ? 'text-orange-600' : 'text-gray-600'}`}>
                              {new Date(item.due_date).toLocaleDateString('ru-RU')}
                            </p>
                            {days !== null && item.status !== 'Выполнена' && (
                              <p className={`text-xs ${days < 0 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-gray-400'}`}>
                                {days < 0 ? `${Math.abs(days)} дн. просрочено` : `${days} дн.`}
                              </p>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => router.push(`/recommendations/${item.id}`)} title="Просмотр"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {item.attachment_name && (
                            <button onClick={async () => {
                              const { data } = await supabase.storage.from('vnd-documents').download(item.attachment_url)
                              if (data) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href=url; a.download=item.attachment_name; a.click(); URL.revokeObjectURL(url) }
                            }}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg" title={`Скачать: ${item.attachment_name}`}>
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openEdit(item)} title="Редактировать"
                            className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} title="Удалить"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Показано {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} из {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">←</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`px-2.5 py-1 text-xs rounded border ${currentPage === p ? 'bg-[#1B8A4C] text-white border-[#1B8A4C]' : 'border-gray-200 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">→</button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editingId ? 'Редактировать' : 'Добавить рекомендацию'}</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

              <div><label className={lbl}>Название рекомендации *</label>
                <input type="text" value={form.title} onChange={e => setF('title', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Описание</label>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3} className={inp + ' resize-none'} /></div>

              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Источник рекомендации</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Тип источника</label>
                    <select value={form.source_type} onChange={e => setF('source_type', e.target.value)} className={inp}>
                      {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select></div>
                  <div><label className={lbl}>Название рапорта/заключения</label>
                    <input type="text" value={form.report_name} onChange={e => setF('report_name', e.target.value)} placeholder="№ или название" className={inp} /></div>
                  <div><label className={lbl}>Дата рапорта/заключения</label>
                    <input type="date" value={form.report_date} onChange={e => setF('report_date', e.target.value)} className={inp} /></div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус принятия</p>
                <div className="grid grid-cols-3 gap-2">
                  {ACCEPTANCE_STATUSES.map(s => (
                    <button key={s} onClick={() => setF('acceptance_status', s)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all ${form.acceptance_status === s
                        ? s === 'Принята' ? 'bg-green-50 border-green-400 text-green-800'
                          : s === 'Не принята' ? 'bg-red-50 border-red-400 text-red-800'
                          : 'bg-gray-100 border-gray-400 text-gray-800'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                {form.acceptance_status === 'Не принята' && (
                  <div><label className={lbl}>Причина непринятия</label>
                    <textarea value={form.acceptance_notes} onChange={e => setF('acceptance_notes', e.target.value)} rows={2} className={inp + ' resize-none'} /></div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Приоритет</label>
                  <select value={form.priority} onChange={e => setF('priority', e.target.value)} className={inp}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select></div>
                <div><label className={lbl}>Статус исполнения</label>
                  <select value={form.status} onChange={e => setF('status', e.target.value)} className={inp}>
                    {EXEC_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div><label className={lbl}>Ответственный</label>
                  <input type="text" value={form.responsible} onChange={e => setF('responsible', e.target.value)} placeholder="ФИО" className={inp} /></div>
                <div><label className={lbl}>Подразделение</label>
                  <input type="text" value={form.department} onChange={e => setF('department', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Срок исполнения</label>
                  <input type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Создал</label>
                  <input type="text" value={form.created_by} onChange={e => setF('created_by', e.target.value)} placeholder="ФИО" className={inp} /></div>
              </div>

              {(form.status === 'Выполнена') && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Дата исполнения</label>
                    <input type="date" value={form.completion_date} onChange={e => setF('completion_date', e.target.value)} className={inp} /></div>
                  <div className="col-span-2"><label className={lbl}>Примечание к исполнению</label>
                    <textarea value={form.completion_notes} onChange={e => setF('completion_notes', e.target.value)} rows={2} className={inp + ' resize-none'} /></div>
                </div>
              )}

              {/* Прикрепить документ */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Прикрепить документ (Гузориш, Заключение, PDF)</p>
                <input type="file" accept=".pdf,.doc,.docx"
                  onChange={e => setAttachment(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#1B8A4C] file:text-white file:text-xs file:cursor-pointer" />
                {attachment && <p className="text-xs text-green-600">✅ {attachment.name}</p>}
                {form.attachment_name && !attachment && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <FileText className="w-3.5 h-3.5" /> {form.attachment_name}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {saving ? 'Сохранение...' : <><CheckCircle2 className="w-4 h-4" /> Сохранить</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

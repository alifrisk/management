'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, Clock, Filter, Search, TrendingUp, FileText, Shield, Droplets, MoreHorizontal } from 'lucide-react'

interface Recommendation {
  id: string
  title: string
  description: string
  source_type: string
  source_reference: string
  priority: string
  responsible: string
  department: string
  due_date: string
  completion_date: string
  status: string
  completion_notes: string
  created_by: string
  created_at: string
  updated_at: string
}

const SOURCE_TYPES = [
  { value: 'operational', label: 'Операционный риск', icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700' },
  { value: 'credit', label: 'Кредитный риск', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-green-100 text-green-700' },
  { value: 'market', label: 'Рыночный риск', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700' },
  { value: 'liquidity', label: 'Ликвидность', icon: <Droplets className="w-3.5 h-3.5" />, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'other', label: 'Прочее', icon: <MoreHorizontal className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-700' },
]

const PRIORITIES = ['Высокий', 'Средний', 'Низкий']
const STATUSES = ['Открыта', 'В процессе', 'Выполнена', 'Просрочена', 'Отменена']

const EMPTY_FORM = {
  title: '', description: '', source_type: 'operational', source_reference: '',
  priority: 'Средний', responsible: '', department: '', due_date: '',
  completion_date: '', status: 'Открыта', completion_notes: '', created_by: '',
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'Выполнена': return { bg: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
    case 'В процессе': return { bg: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3.5 h-3.5" /> }
    case 'Просрочена': return { bg: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3.5 h-3.5" /> }
    case 'Отменена': return { bg: 'bg-gray-100 text-gray-600', icon: <X className="w-3.5 h-3.5" /> }
    default: return { bg: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3.5 h-3.5" /> }
  }
}

function getPriorityStyle(priority: string) {
  if (priority === 'Высокий') return 'bg-red-100 text-red-700'
  if (priority === 'Средний') return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function getDaysLeft(dueDate: string): number | null {
  if (!dueDate) return null
  return Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

export default function RecommendationsPage() {
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
  const [filterPriority, setFilterPriority] = useState('')
  const [showComplete, setShowComplete] = useState<Recommendation | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('recommendations').select('*').order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // Auto-update overdue statuses
  useEffect(() => {
    items.forEach(async (item) => {
      if (item.status === 'Открыта' || item.status === 'В процессе') {
        const days = getDaysLeft(item.due_date)
        if (days !== null && days < 0) {
          await supabase.from('recommendations').update({ status: 'Просрочена' }).eq('id', item.id)
        }
      }
    })
  }, [items])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) { setError('Введите название рекомендации'); return }
    setSaving(true); setError(null)
    try {
      const payload = { ...form, updated_at: new Date().toISOString() }
      if (editingId) {
        const { error: e } = await supabase.from('recommendations').update(payload).eq('id', editingId)
        if (e) throw new Error(e.message)
      } else {
        const { error: e } = await supabase.from('recommendations').insert(payload)
        if (e) throw new Error(e.message)
      }
      setShowModal(false); setForm(EMPTY_FORM); setEditingId(null); fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleComplete() {
    if (!showComplete) return
    await supabase.from('recommendations').update({
      status: 'Выполнена',
      completion_date: new Date().toISOString().split('T')[0],
      completion_notes: completeNotes,
      updated_at: new Date().toISOString(),
    }).eq('id', showComplete.id)
    setShowComplete(null); setCompleteNotes(''); fetch_()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить рекомендацию?')) return
    await supabase.from('recommendations').delete().eq('id', id)
    fetch_()
  }

  function openEdit(item: Recommendation) {
    setForm({
      title: item.title, description: item.description || '',
      source_type: item.source_type, source_reference: item.source_reference || '',
      priority: item.priority, responsible: item.responsible || '',
      department: item.department || '', due_date: item.due_date || '',
      completion_date: item.completion_date || '', status: item.status,
      completion_notes: item.completion_notes || '', created_by: item.created_by || '',
    })
    setEditingId(item.id); setError(null); setShowModal(true)
  }

  const filtered = items.filter(r => {
    if (filterSource && r.source_type !== filterSource) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterPriority && r.priority !== filterPriority) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.responsible?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: items.length,
    open: items.filter(r => r.status === 'Открыта').length,
    inProgress: items.filter(r => r.status === 'В процессе').length,
    done: items.filter(r => r.status === 'Выполнена').length,
    overdue: items.filter(r => r.status === 'Просрочена').length,
  }

  const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Реестр рекомендаций СУР</h1>
          <p className="text-sm text-gray-500 mt-0.5">Контроль исполнения рекомендаций по всем модулям</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Добавить рекомендацию
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Всего', value: stats.total, c: 'text-gray-900' },
          { label: 'Открыта', value: stats.open, c: 'text-yellow-600' },
          { label: 'В процессе', value: stats.inProgress, c: 'text-blue-600' },
          { label: 'Выполнена', value: stats.done, c: 'text-green-600' },
          { label: 'Просрочена', value: stats.overdue, c: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Процент исполнения</p>
            <p className="text-sm font-bold text-[#1B8A4C]">{completionRate}%</p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1B8A4C] rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
          <div className="flex gap-4 mt-2">
            {[
              { color: 'bg-yellow-400', label: `Открыта: ${stats.open}` },
              { color: 'bg-blue-400', label: `В процессе: ${stats.inProgress}` },
              { color: 'bg-green-500', label: `Выполнена: ${stats.done}` },
              { color: 'bg-red-400', label: `Просрочена: ${stats.overdue}` },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{stats.overdue} рекомендаций просрочено — требуется немедленное внимание!</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Поиск по названию или ответственному..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все источники</option>
          {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все статусы</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все приоритеты</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        {(filterSource || filterStatus || filterPriority || search) && (
          <button onClick={() => { setFilterSource(''); setFilterStatus(''); setFilterPriority(''); setSearch('') }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Рекомендация', 'Источник', 'Приоритет', 'Ответственный', 'Срок', 'Статус', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Рекомендаций нет</p>
                </td></tr>
                : filtered.map(item => {
                  const statusStyle = getStatusStyle(item.status)
                  const source = SOURCE_TYPES.find(s => s.value === item.source_type)
                  const days = getDaysLeft(item.due_date)
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.status === 'Просрочена' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                        {item.source_reference && <p className="text-xs text-gray-400 mt-0.5">{item.source_reference}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${source?.color}`}>
                          {source?.icon} {source?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
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
                                {days < 0 ? `просрочено ${Math.abs(days)} дн.` : `${days} дн. осталось`}
                              </p>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg}`}>
                          {statusStyle.icon} {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(item.status === 'Открыта' || item.status === 'В процессе') && (
                            <button onClick={() => setShowComplete(item)} title="Отметить выполненной"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openEdit(item)} title="Редактировать"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
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
      </div>

      {/* Complete Modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold">Отметить как выполненную</h2>
              <button onClick={() => setShowComplete(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{showComplete.title}</p>
              <div>
                <label className={lbl}>Примечание к исполнению</label>
                <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={3}
                  placeholder="Опишите что было сделано..." className={inp + ' resize-none'} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowComplete(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleComplete} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4" /> Выполнено
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editingId ? 'Редактировать' : 'Добавить рекомендацию'}</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}
              <div className="lg:col-span-2">
                <label className={lbl}>Название рекомендации *</label>
                <input type="text" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Усилить контроль над..." className={inp} />
              </div>
              <div><label className={lbl}>Описание</label>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3}
                  placeholder="Подробное описание рекомендации..." className={inp + ' resize-none'} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Источник</label>
                  <select value={form.source_type} onChange={e => setF('source_type', e.target.value)} className={inp}>
                    {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select></div>
                <div><label className={lbl}>Ссылка (№ инцидента / заёмщик)</label>
                  <input type="text" value={form.source_reference} onChange={e => setF('source_reference', e.target.value)} placeholder="Инцидент №123 / ООО 'Компания'" className={inp} /></div>
                <div><label className={lbl}>Приоритет</label>
                  <select value={form.priority} onChange={e => setF('priority', e.target.value)} className={inp}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select></div>
                <div><label className={lbl}>Статус</label>
                  <select value={form.status} onChange={e => setF('status', e.target.value)} className={inp}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div><label className={lbl}>Ответственный</label>
                  <input type="text" value={form.responsible} onChange={e => setF('responsible', e.target.value)} placeholder="ФИО" className={inp} /></div>
                <div><label className={lbl}>Подразделение</label>
                  <input type="text" value={form.department} onChange={e => setF('department', e.target.value)} placeholder="Отдел/Департамент" className={inp} /></div>
                <div><label className={lbl}>Срок исполнения</label>
                  <input type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Дата исполнения</label>
                  <input type="date" value={form.completion_date} onChange={e => setF('completion_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Создал</label>
                  <input type="text" value={form.created_by} onChange={e => setF('created_by', e.target.value)} placeholder="ФИО" className={inp} /></div>
              </div>
              {(form.status === 'Выполнена' || form.status === 'Отменена') && (
                <div><label className={lbl}>Примечание к исполнению</label>
                  <textarea value={form.completion_notes} onChange={e => setF('completion_notes', e.target.value)} rows={2}
                    placeholder="Что было сделано..." className={inp + ' resize-none'} /></div>
              )}
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

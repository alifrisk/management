'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/supabase/client'
import {
  Plus, X, ChevronRight, ChevronDown,
  Circle, Clock, AlertCircle, CheckCircle2, Loader2,
  Trash2, Flag, User, Calendar, LayoutGrid, List,
  GripVertical, Link2
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────
const STRATEGIC_CATS = [
  { id: 'Корпоративная культура', icon: '🏢', color: '#7C3AED' },
  { id: 'Соответствие',           icon: '✅', color: '#2563EB' },
  { id: 'Автоматизация',          icon: '⚙️', color: '#16A34A' },
  { id: 'ERM',                    icon: '🛡️', color: '#EA580C' },
  { id: 'Обучение',               icon: '📚', color: '#DB2777' },
]
const STATUSES   = ['Новая','В работе','На проверке','Готово'] as const
const PRIORITIES = ['Низкий','Средний','Высокий','Срочный'] as const
const ASSIGNEES  = ['Muhammat Obidov','Kamila Marodmamadova','Orifjon Kadyrov','Sokhibdzhon Kabilov','Farzona Sanginova']

type Status   = typeof STATUSES[number]
type Priority = typeof PRIORITIES[number]

interface Task {
  id: string; title: string; description: string | null
  category: string; status: Status; priority: Priority
  assignee: string | null; deadline: string | null
  parent_id: string | null; sort_order: number
  week_number: number | null; task_year: number | null
  strategic_task_id: string | null; created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusIcon = (s: Status) => {
  if (s === 'Новая')       return <Circle      className="w-4 h-4 text-gray-400" />
  if (s === 'В работе')    return <Loader2     className="w-4 h-4 text-blue-500" />
  if (s === 'На проверке') return <Clock       className="w-4 h-4 text-yellow-500" />
  return                          <CheckCircle2 className="w-4 h-4 text-green-500" />
}
const statusBg = (s: Status) => {
  if (s === 'Новая')       return 'bg-gray-100 text-gray-600'
  if (s === 'В работе')    return 'bg-blue-100 text-blue-700'
  if (s === 'На проверке') return 'bg-yellow-100 text-yellow-700'
  return                          'bg-green-100 text-green-700'
}
const priorityColor = (p: Priority) => {
  if (p === 'Срочный') return 'text-red-500'
  if (p === 'Высокий') return 'text-orange-500'
  if (p === 'Средний') return 'text-blue-400'
  return 'text-gray-300'
}

function getCurrentWeek() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks,          setTasks]          = useState<Task[]>([])
  const [loading,        setLoading]        = useState(true)
  const [section,        setSection]        = useState<'Стратегические'|'Еженедельные'|'Бэклог'>('Стратегические')
  const [stratCat,       setStratCat]       = useState<string|null>(null)
  const [viewMode,       setViewMode]       = useState<'kanban'|'list'>('kanban')
  const [selectedTask,   setSelectedTask]   = useState<Task|null>(null)
  const [dragId,         setDragId]         = useState<string|null>(null)
  const [filterWeek,     setFilterWeek]     = useState(getCurrentWeek())
  const [filterYear,     setFilterYear]     = useState(new Date().getFullYear())
  const [filterStratYear,setFilterStratYear]= useState(new Date().getFullYear())
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set())
  // Inline add state per column
  const [addingIn,    setAddingIn]    = useState<string|null>(null)
  const addRef        = useRef<HTMLInputElement>(null)
  const addingTitleRef = useRef('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').order('sort_order').order('created_at')
    setTasks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    if (addingIn) setTimeout(() => addRef.current?.focus(), 50)
  }, [addingIn])

  // Keep selected task in sync
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function quickAdd(status: Status, category: string) {
    const title = addRef.current?.value?.trim() || addingTitleRef.current.trim()
    if (!title) { setAddingIn(null); return }
    const { data: newTask } = await supabase.from('tasks').insert({
      title: title,
      category,
      status,
      priority: 'Средний',
      task_year: new Date().getFullYear(),
      week_number: section === 'Еженедельные' ? filterWeek : null,
    }).select().single()
    setAddingIn(null); addingTitleRef.current = ''; if(addRef.current) addRef.current.value = ''
    await fetch_()
    // Сразу открываем задачу в боковой панели для заполнения деталей
    if (newTask) setSelectedTask(newTask as Task)
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() } as Record<string,unknown>).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    if (selectedTask?.id === id) setSelectedTask(prev => prev ? { ...prev, ...patch } : prev)
  }

  async function deleteTask(id: string) {
    if (!confirm('Удалить задачу?')) return
    await supabase.from('tasks').delete().eq('id', id)
    if (selectedTask?.id === id) setSelectedTask(null)
    fetch_()
  }

  async function addSubtask(parentId: string, title: string) {
    if (!title.trim()) return
    const parent = tasks.find(t => t.id === parentId)
    if (!parent) return
    await supabase.from('tasks').insert({
      title: title.trim(), category: parent.category,
      status: 'Новая', priority: 'Средний', parent_id: parentId,
      task_year: new Date().getFullYear(),
    })
    fetch_()
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const currentCategory = section === 'Стратегические' ? stratCat
    : section === 'Еженедельные' ? 'Еженедельные' : 'Бэклог'

  const rootTasks = (cat: string) => tasks.filter(t => {
    if (t.parent_id) return false
    if (t.category !== cat) return false
    if (cat === 'Еженедельные')
      return (!t.week_number || t.week_number === filterWeek) && (!t.task_year || t.task_year === filterYear)
    if (STRATEGIC_CATS.some(c => c.id === cat))
      return !t.task_year || t.task_year === filterStratYear
    return true
  })

  const subTasks = (pid: string) => tasks.filter(t => t.parent_id === pid)

  const progress = (cat: string) => {
    const stratTasks = rootTasks(cat)
    // Also count weekly/backlog tasks linked to strategic tasks in this category
    const linkedTasks = tasks.filter(t =>
      !t.parent_id &&
      t.strategic_task_id &&
      stratTasks.some(s => s.id === t.strategic_task_id)
    )
    const allTasks = [...stratTasks, ...linkedTasks]
    if (!allTasks.length) return 0
    const done = allTasks.filter(t => t.status === 'Готово').length
    return Math.round(done / allTasks.length * 100)
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  async function onDrop(status: Status) {
    if (!dragId) return
    await updateTask(dragId, { status })
    setDragId(null)
  }

  // ─── Kanban Card ──────────────────────────────────────────────────────────
  const KanbanCard = ({ task }: { task: Task }) => {
    const subs     = subTasks(task.id)
    const subsDone = subs.filter(s => s.status === 'Готово').length
    const isSelected = selectedTask?.id === task.id
    return (
      <div
        draggable
        onDragStart={() => setDragId(task.id)}
        onClick={() => setSelectedTask(task)}
        className={`group bg-white rounded-lg border cursor-pointer p-3 transition-all hover:shadow-sm
          ${isSelected ? 'border-[#1B8A4C] shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${task.status === 'Готово' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Flag className={`w-3 h-3 ${priorityColor(task.priority)}`} />
              {task.assignee && (
                <div className="w-5 h-5 rounded-full bg-[#1B8A4C] flex items-center justify-center text-white text-[9px] font-bold">
                  {task.assignee.split('.')[0][0].toUpperCase()}
                </div>
              )}
              {task.deadline && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  {new Date(task.deadline).toLocaleDateString('ru-RU', { day:'2-digit', month:'short' })}
                </span>
              )}
              {subs.length > 0 && (
                <span className="text-[10px] text-gray-400">{subsDone}/{subs.length}</span>
              )}
              {task.strategic_task_id && (() => {
                const st = tasks.find(t => t.id === task.strategic_task_id)
                const cat = STRATEGIC_CATS.find(c => c.id === st?.category)
                return st ? <span className="text-[10px] text-blue-400">{cat?.icon} {st.title.slice(0,20)}</span> : null
              })()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Kanban Column ────────────────────────────────────────────────────────
  const KanbanCol = ({ status, category }: { status: Status; category: string }) => {
    const colTasks = rootTasks(category).filter(t => t.status === status)
    const isAdding = addingIn === status
    return (
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={() => onDrop(status)}
        className="flex-1 min-w-56 flex flex-col"
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          {statusIcon(status)}
          <span className="text-xs font-semibold text-gray-600">{status}</span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{colTasks.length}</span>
        </div>

        <div className="space-y-2 flex-1">
          {colTasks.map(t => <KanbanCard key={t.id} task={t} />)}
        </div>

        {/* Inline add */}
        {isAdding ? (
          <div className="mt-2 bg-white rounded-lg border border-[#1B8A4C] p-2 shadow-sm">
            <input
              ref={addRef}
              defaultValue=""
              onChange={e => { addingTitleRef.current = e.target.value }}
              onKeyDown={e => { if (e.key === 'Enter') quickAdd(status, category); if (e.key === 'Escape') { setAddingIn(null); addingTitleRef.current = '' } }}
              placeholder="Название задачи..."
              className="w-full text-sm outline-none text-gray-900 placeholder-gray-400"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => quickAdd(status, category)}
                className="px-2.5 py-1 bg-[#1B8A4C] text-white rounded text-xs font-medium hover:bg-[#177040]">
                Добавить
              </button>
              <button onClick={() => { setAddingIn(null); addingTitleRef.current = '' }}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingIn(status); addingTitleRef.current = '' }}
            className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-1 py-1.5 rounded hover:bg-gray-100 transition-colors w-full"
          >
            <Plus className="w-3.5 h-3.5" /> Новая задача
          </button>
        )}
      </div>
    )
  }

  // ─── List Row ─────────────────────────────────────────────────────────────
  const ListRow = ({ task }: { task: Task }) => {
    const subs = subTasks(task.id)
    const isExp = expanded.has(task.id)
    const isSelected = selectedTask?.id === task.id
    return (
      <>
        <tr
          onClick={() => setSelectedTask(task)}
          className={`cursor-pointer group hover:bg-gray-50 ${isSelected ? 'bg-green-50' : ''}`}
        >
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2">
              {subs.length > 0 && (
                <button onClick={e => { e.stopPropagation(); setExpanded(prev => { const s = new Set(prev); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s }) }}
                  className="text-gray-400 hover:text-gray-600">
                  {isExp ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>}
                </button>
              )}
              <span className={`text-sm ${task.status==='Готово'?'line-through text-gray-400':'text-gray-900'}`}>{task.title}</span>
            </div>
          </td>
          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
            <select value={task.status}
              onChange={e => updateTask(task.id, { status: e.target.value as Status })}
              className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer focus:outline-none ${statusBg(task.status)}`}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </td>
          <td className="px-3 py-2.5">
            <Flag className={`w-3.5 h-3.5 ${priorityColor(task.priority)}`} />
          </td>
          <td className="px-3 py-2.5 text-xs text-gray-500">{task.assignee?.split('.')[0] || '—'}</td>
          <td className="px-3 py-2.5 text-xs text-gray-500">
            {task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU', {day:'2-digit',month:'short'}) : '—'}
          </td>
          <td className="px-3 py-2.5">
            <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          </td>
        </tr>
        {isExp && subs.map(s => (
          <tr key={s.id} onClick={() => setSelectedTask(s)} className="cursor-pointer hover:bg-gray-50 bg-gray-50/50">
            <td className="pl-12 pr-4 py-2">
              <span className={`text-xs ${s.status==='Готово'?'line-through text-gray-400':'text-gray-700'}`}>↳ {s.title}</span>
            </td>
            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
              <select value={s.status} onChange={e => updateTask(s.id, { status: e.target.value as Status })}
                className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer focus:outline-none ${statusBg(s.status)}`}>
                {STATUSES.map(st => <option key={st}>{st}</option>)}
              </select>
            </td>
            <td colSpan={4} />
          </tr>
        ))}
      </>
    )
  }

  // ─── Side Panel ───────────────────────────────────────────────────────────
  const SidePanel = ({ task }: { task: Task }) => {
    const [newSubtitle, setNewSubtitle] = useState('')
    const [addingSub,   setAddingSub]   = useState(false)
    const [localTitle,  setLocalTitle]  = useState(task.title)
    const [localDesc,   setLocalDesc]   = useState(task.description || '')
    const subs = subTasks(task.id)
    const cat  = STRATEGIC_CATS.find(c => c.id === task.category)

    return (
      <div className="w-96 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {cat && <span className="text-lg">{cat.icon}</span>}
            <span className="text-xs text-gray-400 font-medium">{task.category}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => deleteTask(task.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setSelectedTask(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Title */}
          <div className="px-5 pt-4 pb-2">
            <textarea
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={() => { if (localTitle.trim() && localTitle !== task.title) updateTask(task.id, { title: localTitle.trim() }) }}
              className="w-full text-xl font-semibold text-gray-900 resize-none outline-none leading-snug"
              rows={2}
              placeholder="Название задачи"
            />
          </div>

          {/* Properties */}
          <div className="px-5 space-y-1 pb-4">
            {/* Status */}
            <div className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0">Статус</span>
              <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value as Status })}
                className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer border-0 focus:outline-none ${statusBg(task.status)}`}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Priority */}
            <div className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0">Приоритет</span>
              <select value={task.priority} onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
                className="text-xs text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer font-medium">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {/* Assignee */}
            <div className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0">Исполнитель</span>
              <select value={task.assignee || ''} onChange={e => updateTask(task.id, { assignee: e.target.value || null })}
                className="text-xs text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer">
                <option value="">— Не назначен —</option>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a.split('.')[0]}</option>)}
              </select>
            </div>
            {/* Deadline */}
            <div className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0">Дедлайн</span>
              <input type="date" value={task.deadline || ''}
                onChange={e => updateTask(task.id, { deadline: e.target.value || null })}
                className="text-xs text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer" />
            </div>
            {/* Strategic link for weekly */}
            {(task.category === 'Еженедельные' || task.category === 'Бэклог') && !task.parent_id && (
              <div className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 flex items-center gap-1"><Link2 className="w-3 h-3"/>Стратегия</span>
                <select value={task.strategic_task_id || ''}
                  onChange={e => updateTask(task.id, { strategic_task_id: e.target.value || null })}
                  className="text-xs text-gray-700 bg-transparent border-0 focus:outline-none cursor-pointer flex-1 min-w-0">
                  <option value="">— Не привязана —</option>
                  {tasks.filter(t => STRATEGIC_CATS.some(c => c.id === t.category) && !t.parent_id).map(t => {
                    const c = STRATEGIC_CATS.find(c => c.id === t.category)
                    return <option key={t.id} value={t.id}>{c?.icon} {t.title.slice(0,30)}</option>
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 mx-5" />

          {/* Description */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Описание</p>
            <textarea
              value={localDesc}
              onChange={e => setLocalDesc(e.target.value)}
              onBlur={() => { const d = localDesc || null; if (d !== task.description) updateTask(task.id, { description: d }) }}
              placeholder="Добавьте описание..."
              rows={4}
              className="w-full text-sm text-gray-700 resize-none outline-none placeholder-gray-300 leading-relaxed"
            />
          </div>

          <div className="border-t border-gray-100 mx-5" />

          {/* Subtasks */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Подзадачи {subs.length > 0 && `(${subs.filter(s=>s.status==='Готово').length}/${subs.length})`}
            </p>
            <div className="space-y-1.5">
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-2 group/sub">
                  <button onClick={() => updateTask(s.id, { status: s.status === 'Готово' ? 'Новая' : 'Готово' })}>
                    {s.status === 'Готово'
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <Circle       className="w-4 h-4 text-gray-300 flex-shrink-0 hover:text-gray-500" />}
                  </button>
                  <span className={`text-sm flex-1 ${s.status==='Готово'?'line-through text-gray-400':'text-gray-700'}`}>
                    {s.title}
                  </span>
                  <button onClick={() => deleteTask(s.id)}
                    className="opacity-0 group-hover/sub:opacity-100 text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
            {addingSub ? (
              <div className="flex items-center gap-2 mt-2">
                <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <input autoFocus value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { addSubtask(task.id, newSubtitle); setNewSubtitle(''); setAddingSub(false) }
                    if (e.key === 'Escape') { setAddingSub(false); setNewSubtitle('') }
                  }}
                  placeholder="Подзадача..."
                  className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-300" />
              </div>
            ) : (
              <button onClick={() => setAddingSub(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-2">
                <Plus className="w-3.5 h-3.5"/> Добавить подзадачу
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 gap-0 -m-6 lg:-m-8">

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6 lg:p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Задачи СУР</h1>
            <p className="text-sm text-gray-500 mt-0.5">Стратегические · Еженедельные · Бэклог</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${viewMode==='kanban'?'bg-[#1B8A4C] text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <LayoutGrid className="w-3.5 h-3.5"/> Доска
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${viewMode==='list'?'bg-[#1B8A4C] text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <List className="w-3.5 h-3.5"/> Список
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 flex-shrink-0">
          {(['Стратегические','Еженедельные','Бэклог'] as const).map(s => (
            <button key={s} onClick={() => { setSection(s); if(s==='Стратегические') setStratCat(null) }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${section===s?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
              {s==='Стратегические'?'🎯':s==='Еженедельные'?'📅':'📦'} {s}
            </button>
          ))}
        </div>

        {/* Strategic category cards */}
        {section === 'Стратегические' && !stratCat && (
          <div className="grid grid-cols-5 gap-3 mb-5 flex-shrink-0">
            {STRATEGIC_CATS.map(cat => {
              const pct  = progress(cat.id)
              const ts   = rootTasks(cat.id)
              const done = ts.filter(t => t.status==='Готово').length
              return (
                <button key={cat.id} onClick={() => setStratCat(cat.id)}
                  className="text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                  <div className="text-2xl mb-2">{cat.icon}</div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{cat.id}</p>
                  {(() => {
                    const linked = tasks.filter(t => !t.parent_id && t.strategic_task_id && ts.some(s => s.id === t.strategic_task_id))
                    const linkedDone = linked.filter(t => t.status === 'Готово').length
                    return (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400">{done}/{ts.length} стратегических</p>
                        {linked.length > 0 && <p className="text-xs text-gray-400 opacity-70">{linkedDone}/{linked.length} связанных</p>}
                      </div>
                    )
                  })()}
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="rounded-full h-1.5 transition-all" style={{ width:`${pct}%`, backgroundColor: cat.color }} />
                  </div>
                  <p className="text-xs mt-1 font-medium" style={{ color: cat.color }}>{pct}%</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Week filter */}
        {section === 'Еженедельные' && (
          <div className="flex items-center gap-3 mb-4 flex-shrink-0">
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
              {[new Date().getFullYear(), new Date().getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterWeek} onChange={e => setFilterWeek(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]">
              {Array.from({length:52},(_,i)=>i+1).map(w => <option key={w} value={w}>Неделя {w}</option>)}
            </select>
          </div>
        )}

        {/* Breadcrumb */}
        {section === 'Стратегические' && stratCat && (
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <button onClick={() => setStratCat(null)} className="text-sm text-gray-400 hover:text-gray-600">🎯 Стратегические</button>
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <span className="text-sm font-medium text-gray-900">
              {STRATEGIC_CATS.find(c=>c.id===stratCat)?.icon} {stratCat}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <select value={filterStratYear} onChange={e => setFilterStratYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                {[new Date().getFullYear(), new Date().getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-xs text-gray-500">{progress(stratCat)}%</span>
            </div>
          </div>
        )}

        {/* Content */}
        {currentCategory && (
          <div className="flex-1 min-h-0 overflow-auto">
            {viewMode === 'kanban' ? (
              <div className="flex gap-4 h-full">
                {STATUSES.map(s => <KanbanCol key={s} status={s} category={currentCategory!} />)}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Задача','Статус','Приоритет','Исполнитель','Дедлайн',''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading
                      ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Загрузка...</td></tr>
                      : rootTasks(currentCategory).length === 0
                      ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Нет задач</td></tr>
                      : rootTasks(currentCategory).map(t => <ListRow key={t.id} task={t} />)}
                    <tr>
                      <td colSpan={6} className="px-4 py-2">
                        <button
                          onClick={() => { setAddingIn('Новая'); addingTitleRef.current = '' }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                          <Plus className="w-3.5 h-3.5"/> Новая задача
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side panel */}
      {selectedTask && <SidePanel task={selectedTask} />}
    </div>
  )
}

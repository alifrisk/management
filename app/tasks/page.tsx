'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import {
  Plus, X, ChevronDown, ChevronRight, Circle,
  Clock, AlertCircle, CheckCircle2, Loader2,
  Trash2, Edit2, Flag, User, Calendar, LayoutGrid, List
} from 'lucide-react'

const STRATEGIC_CATEGORIES = [
  { id: 'Корпоративная культура', icon: '🏢', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'Соответствие',           icon: '✅', color: 'bg-blue-50   border-blue-200   text-blue-700'   },
  { id: 'Автоматизация',          icon: '⚙️', color: 'bg-green-50  border-green-200  text-green-700'  },
  { id: 'ERM',                    icon: '🛡️', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { id: 'Обучение',               icon: '📚', color: 'bg-pink-50   border-pink-200   text-pink-700'   },
]

const STATUSES = ['Новая','В работе','На проверке','Готово'] as const
const PRIORITIES = ['Низкий','Средний','Высокий','Срочный'] as const
const SECTIONS  = ['Стратегические','Еженедельные','Бэклог'] as const

const ASSIGNEES = [
  'muhammat.obidov','kamila.marodmamadova','orifjon.kadyrov',
  'sokhibdzhon.kabilov','sunatullo.hikmatov'
]

type Status   = typeof STATUSES[number]
type Priority = typeof PRIORITIES[number]
type Section  = typeof SECTIONS[number]

interface Task {
  id: string
  title: string
  description: string | null
  category: string
  status: Status
  priority: Priority
  assignee: string | null
  deadline: string | null
  parent_id: string | null
  sort_order: number
  week_number: number | null
  task_year: number | null
  created_at: string
}

const statusIcon  = (s: Status) => s==='Новая'?<Circle className="w-3.5 h-3.5 text-gray-400"/>:s==='В работе'?<Loader2 className="w-3.5 h-3.5 text-blue-500"/>:s==='На проверке'?<Clock className="w-3.5 h-3.5 text-yellow-500"/>:<CheckCircle2 className="w-3.5 h-3.5 text-green-500"/>
const statusColor = (s: Status) => s==='Новая'?'bg-gray-50 border-gray-200':s==='В работе'?'bg-blue-50 border-blue-200':s==='На проверке'?'bg-yellow-50 border-yellow-200':'bg-green-50 border-green-200'
const priorityColor=(p: Priority)=>p==='Срочный'?'text-red-600 bg-red-50':p==='Высокий'?'text-orange-600 bg-orange-50':p==='Средний'?'text-blue-600 bg-blue-50':'text-gray-500 bg-gray-50'
const priorityIcon =(p: Priority)=>p==='Срочный'?<AlertCircle className="w-3 h-3"/>:<Flag className="w-3 h-3"/>

const EMPTY_FORM = { title:'', description:'', category:'Бэклог', status:'Новая' as Status, priority:'Средний' as Priority, assignee:'', deadline:'', week_number:'', task_year: String(new Date().getFullYear()) }


// Get week date range label
function getWeekLabel(week: number, year: number) {
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1)
  const weekStart = new Date(startOfWeek1)
  weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${weekStart.toLocaleDateString('ru-RU', opts)} – ${weekEnd.toLocaleDateString('ru-RU', opts)}`
}

function getCurrentWeek() {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1)
  return Math.ceil((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}

export default function TasksPage() {
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [loading,   setLoading]   = useState(true)
  const [section,   setSection]   = useState<Section>('Стратегические')
  const [stratCat,  setStratCat]  = useState<string|null>(null)
  const [viewMode,  setViewMode]  = useState<'kanban'|'list'>('kanban')
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [editId,    setEditId]    = useState<string|null>(null)
  const [saving,    setSaving]    = useState(false)
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())
  const [dragId,    setDragId]    = useState<string|null>(null)
  const [parentFor, setParentFor] = useState<string|null>(null)
  const [filterWeek, setFilterWeek] = useState<number>(getCurrentWeek())
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear())

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').order('sort_order').order('created_at')
    setTasks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title:       form.title.trim(),
      description: form.description || null,
      category:    form.category,
      status:      form.status,
      priority:    form.priority,
      assignee:    form.assignee || null,
      deadline:    form.deadline || null,
      parent_id:   parentFor || null,
      week_number: form.category === 'Еженедельные' && form.week_number ? parseInt(form.week_number) : null,
      task_year:   form.task_year ? parseInt(form.task_year) : new Date().getFullYear(),
      updated_at:  new Date().toISOString(),
    }
    if (editId) {
      await supabase.from('tasks').update(payload).eq('id', editId)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    setShowForm(false); setForm({ ...EMPTY_FORM }); setEditId(null); setParentFor(null)
    setSaving(false); fetch_()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить задачу?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetch_()
  }

  async function updateStatus(id: string, status: Status) {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  function openEdit(t: Task) {
    setForm({ title: t.title, description: t.description||'', category: t.category, status: t.status, priority: t.priority, assignee: t.assignee||'', deadline: t.deadline||'' })
    setEditId(t.id); setParentFor(null); setShowForm(true)
  }

  function openAdd(category: string, parentId?: string) {
    setForm({ ...EMPTY_FORM, category })
    setEditId(null); setParentFor(parentId||null); setShowForm(true)
  }

  // Drag and drop
  function onDragStart(id: string) { setDragId(id) }
  async function onDrop(status: Status) {
    if (!dragId) return
    await updateStatus(dragId, status)
    setDragId(null)
  }

  const toggleExpanded = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // Filter tasks
  const rootTasks = (category: string) => tasks.filter(t => {
    if (t.parent_id) return false
    if (t.category !== category) return false
    if (category === 'Еженедельные') {
      return (t.week_number === filterWeek || !t.week_number) && (t.task_year === filterYear || !t.task_year)
    }
    return true
  })
  const subTasks  = (parentId: string) => tasks.filter(t => t.parent_id === parentId)

  // Progress
  const progress = (category: string) => {
    const ts = rootTasks(category)
    if (!ts.length) return 0
    return Math.round(ts.filter(t => t.status === 'Готово').length / ts.length * 100)
  }

  const inp  = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl  = "block text-xs font-medium text-gray-600 mb-1"

  // ── Task Card ────────────────────────────────────
  const TaskCard = ({ task, isSubtask = false }: { task: Task; isSubtask?: boolean }) => {
    const subs = subTasks(task.id)
    const isExp = expanded.has(task.id)
    const subsDone = subs.filter(s => s.status === 'Готово').length
    return (
      <div
        draggable={!isSubtask}
        onDragStart={() => !isSubtask && onDragStart(task.id)}
        className={`bg-white rounded-xl border ${isSubtask ? 'border-gray-100 ml-4' : 'border-gray-200'} shadow-sm p-3 cursor-grab active:cursor-grabbing group hover:border-[#1B8A4C]/30 transition-colors`}
      >
        <div className="flex items-start gap-2">
          {subs.length > 0 && (
            <button onClick={() => toggleExpanded(task.id)} className="mt-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
              {isExp ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium text-gray-900 ${task.status === 'Готово' ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => openEdit(task)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-3 h-3"/></button>
                <button onClick={() => handleDelete(task.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
            {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityColor(task.priority)}`}>
                {priorityIcon(task.priority)} {task.priority}
              </span>
              {task.assignee && <span className="inline-flex items-center gap-1 text-[10px] text-gray-500"><User className="w-2.5 h-2.5"/>{task.assignee.split('.')[0]}</span>}
              {task.deadline && <span className="inline-flex items-center gap-1 text-[10px] text-gray-500"><Calendar className="w-2.5 h-2.5"/>{new Date(task.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}</span>}
              {subs.length > 0 && <span className="text-[10px] text-gray-400">{subsDone}/{subs.length} подзадач</span>}
              {task.category === 'Еженедельные' && task.week_number && <span className="text-[10px] text-purple-500 font-medium">Нед. {task.week_number} · {getWeekLabel(task.week_number, task.task_year || new Date().getFullYear())}</span>}
            </div>
          </div>
        </div>
        {/* Subtasks */}
        {isExp && subs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {subs.map(s => <TaskCard key={s.id} task={s} isSubtask />)}
          </div>
        )}
        {/* Add subtask */}
        {!isSubtask && (
          <button onClick={() => openAdd(task.category, task.id)}
            className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#1B8A4C] transition-colors">
            <Plus className="w-3 h-3"/> Подзадача
          </button>
        )}
      </div>
    )
  }

  // ── Kanban Column ────────────────────────────────
  const KanbanCol = ({ status, tasks: colTasks }: { status: Status; tasks: Task[] }) => (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDrop(status)}
      className="flex-1 min-w-48">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${statusColor(status)}`}>
        {statusIcon(status)}
        <span className="text-xs font-semibold">{status}</span>
        <span className="ml-auto text-xs text-gray-400 bg-white rounded-full px-1.5">{colTasks.length}</span>
      </div>
      <div className="space-y-2 min-h-16">
        {colTasks.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  )

  // ── List Row ─────────────────────────────────────
  const ListRow = ({ task }: { task: Task }) => {
    const subs = subTasks(task.id)
    const isExp = expanded.has(task.id)
    return (
      <>
        <tr className="hover:bg-gray-50 group">
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2">
              {subs.length > 0 && (
                <button onClick={() => toggleExpanded(task.id)} className="text-gray-400 hover:text-gray-600">
                  {isExp ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>}
                </button>
              )}
              <span className={`text-sm ${task.status==='Готово'?'line-through text-gray-400':'text-gray-900'}`}>{task.title}</span>
            </div>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1">
              {statusIcon(task.status)}
              <select value={task.status} onChange={e => updateStatus(task.id, e.target.value as Status)}
                className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </td>
          <td className="px-3 py-2.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityColor(task.priority)}`}>
              {priorityIcon(task.priority)} {task.priority}
            </span>
          </td>
          <td className="px-3 py-2.5 text-xs text-gray-500">{task.assignee?.split('.')[0] || '—'}</td>
          <td className="px-3 py-2.5 text-xs text-gray-500">{task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}) : '—'}</td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button onClick={() => openEdit(task)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
              <button onClick={() => openAdd(task.category, task.id)} className="p-1 text-gray-400 hover:text-[#1B8A4C] rounded"><Plus className="w-3.5 h-3.5"/></button>
              <button onClick={() => handleDelete(task.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          </td>
        </tr>
        {isExp && subs.map(s => (
          <tr key={s.id} className="hover:bg-gray-50 bg-gray-50/50 group">
            <td className="pl-10 pr-4 py-2">
              <span className={`text-xs ${s.status==='Готово'?'line-through text-gray-400':'text-gray-700'}`}>↳ {s.title}</span>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                {statusIcon(s.status)}
                <select value={s.status} onChange={e => updateStatus(s.id, e.target.value as Status)}
                  className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer">
                  {STATUSES.map(st => <option key={st}>{st}</option>)}
                </select>
              </div>
            </td>
            <td className="px-3 py-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityColor(s.priority)}`}>
                {priorityIcon(s.priority)} {s.priority}
              </span>
            </td>
            <td className="px-3 py-2 text-xs text-gray-500">{s.assignee?.split('.')[0] || '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500">{s.deadline ? new Date(s.deadline).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}) : '—'}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </td>
          </tr>
        ))}
      </>
    )
  }

  const currentCategory = section === 'Стратегические' ? stratCat : section === 'Еженедельные' ? 'Еженедельные' : 'Бэклог'

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Управление задачами СУР</h1>
          <p className="text-sm text-gray-500 mt-0.5">Стратегические задачи · Еженедельные · Бэклог</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${viewMode==='kanban'?'bg-[#1B8A4C] text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <LayoutGrid className="w-3.5 h-3.5"/> Kanban
            </button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${viewMode==='list'?'bg-[#1B8A4C] text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <List className="w-3.5 h-3.5"/> Список
            </button>
          </div>
          {currentCategory && (
            <button onClick={() => openAdd(currentCategory)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
              <Plus className="w-4 h-4"/> Задача
            </button>
          )}
        </div>
      </div>

      {/* Секции */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {SECTIONS.map(s => (
          <button key={s} onClick={() => { setSection(s); if(s==='Стратегические') setStratCat(null); }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${section===s?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {s==='Стратегические'?'🎯':s==='Еженедельные'?'📅':'📦'} {s}
          </button>
        ))}
      </div>

      {/* ═══ СТРАТЕГИЧЕСКИЕ ═══ */}
      {section === 'Стратегические' && !stratCat && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {STRATEGIC_CATEGORIES.map(cat => {
            const pct = progress(cat.id)
            const total = rootTasks(cat.id).length
            const done  = rootTasks(cat.id).filter(t => t.status==='Готово').length
            return (
              <button key={cat.id} onClick={() => setStratCat(cat.id)}
                className={`text-left p-4 rounded-xl border-2 ${cat.color} hover:shadow-md transition-all`}>
                <div className="text-2xl mb-2">{cat.icon}</div>
                <p className="text-sm font-semibold mb-1">{cat.id}</p>
                <p className="text-xs opacity-70 mb-3">{done}/{total} задач</p>
                <div className="w-full bg-white/50 rounded-full h-1.5">
                  <div className="bg-current rounded-full h-1.5 transition-all" style={{ width: `${pct}%`, opacity: 0.7 }}/>
                </div>
                <p className="text-xs mt-1 font-medium">{pct}%</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Фильтр недели для Еженедельных */}
      {section === 'Еженедельные' && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Неделя:</span>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
            {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <select value={filterWeek} onChange={e => setFilterWeek(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
            {Array.from({length: 52}, (_, i) => i+1).map(w => (
              <option key={w} value={w}>Неделя {w} · {getWeekLabel(w, filterYear)}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{getWeekLabel(filterWeek, filterYear)} {filterYear}</span>
        </div>
      )}

      {/* Breadcrumb для стратегической категории */}
      {section === 'Стратегические' && stratCat && (
        <div className="flex items-center gap-2">
          <button onClick={() => setStratCat(null)} className="text-sm text-gray-500 hover:text-gray-700">🎯 Стратегические</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">
            {STRATEGIC_CATEGORIES.find(c=>c.id===stratCat)?.icon} {stratCat}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{progress(stratCat)}% выполнено</span>
            <div className="w-24 bg-gray-200 rounded-full h-1.5">
              <div className="bg-[#1B8A4C] rounded-full h-1.5 transition-all" style={{ width: `${progress(stratCat)}%` }}/>
            </div>
          </div>
        </div>
      )}

      {/* Контент задач */}
      {currentCategory && (
        <>
          {viewMode === 'kanban' ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STATUSES.map(status => (
                <KanbanCol key={status} status={status}
                  tasks={rootTasks(currentCategory).filter(t => t.status === status)} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Задача','Статус','Приоритет','Исполнитель','Дедлайн',''].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading
                    ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Загрузка...</td></tr>
                    : rootTasks(currentCategory).length === 0
                    ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Нет задач</td></tr>
                    : rootTasks(currentCategory).map(t => <ListRow key={t.id} task={t} />)}
                </tbody>
              </table>
            </div>
          )}
          {/* Empty state */}
          {!loading && rootTasks(currentCategory).length === 0 && viewMode==='kanban' && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Нет задач</p>
              <button onClick={() => openAdd(currentCategory)}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] mx-auto">
                <Plus className="w-4 h-4"/> Добавить первую задачу
              </button>
            </div>
          )}
        </>
      )}

      {/* ══ Форма ══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">
                {editId ? 'Редактировать задачу' : parentFor ? 'Новая подзадача' : 'Новая задача'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); setParentFor(null) }}
                className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={lbl}>Название *</label>
                <input type="text" value={form.title} onChange={e => setF('title',e.target.value)}
                  placeholder="Название задачи..." autoFocus
                  className={inp} onKeyDown={e => e.key==='Enter' && handleSave()} />
              </div>
              <div>
                <label className={lbl}>Описание</label>
                <textarea value={form.description} onChange={e => setF('description',e.target.value)}
                  rows={2} placeholder="Описание..." className={`${inp} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!parentFor && (
                  <div>
                    <label className={lbl}>Категория</label>
                    <select value={form.category} onChange={e => setF('category',e.target.value)} className={inp}>
                      {STRATEGIC_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
                      <option value="Еженедельные">📅 Еженедельные</option>
                      <option value="Бэклог">📦 Бэклог</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={lbl}>Статус</label>
                  <select value={form.status} onChange={e => setF('status',e.target.value)} className={inp}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Приоритет</label>
                  <select value={form.priority} onChange={e => setF('priority',e.target.value)} className={inp}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Исполнитель</label>
                  <select value={form.assignee} onChange={e => setF('assignee',e.target.value)} className={inp}>
                    <option value="">— Не назначен —</option>
                    {ASSIGNEES.map(a => <option key={a} value={a}>{a.split('.')[0]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Дедлайн</label>
                  <input type="date" value={form.deadline} onChange={e => setF('deadline',e.target.value)} className={inp} />
                </div>
                {form.category === 'Еженедельные' && (
                  <>
                    <div>
                      <label className={lbl}>Год</label>
                      <select value={form.task_year} onChange={e => setF('task_year', e.target.value)} className={inp}>
                        {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y =>
                          <option key={y} value={y}>{y}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Неделя</label>
                      <select value={form.week_number} onChange={e => setF('week_number', e.target.value)} className={inp}>
                        <option value="">— Выберите неделю —</option>
                        {Array.from({length: 52}, (_, i) => i+1).map(w => (
                          <option key={w} value={w}>Неделя {w} · {getWeekLabel(w, parseInt(form.task_year) || new Date().getFullYear())}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => { setShowForm(false); setEditId(null); setParentFor(null) }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

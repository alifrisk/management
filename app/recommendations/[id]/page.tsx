'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/client'
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Edit2, Trash2, X } from 'lucide-react'

interface Recommendation {
  id: string; rec_number: number; title: string; description: string
  source_type: string; report_name: string; report_date: string
  acceptance_status: string; acceptance_notes: string; acceptance_date: string
  priority: string; responsible: string; department: string
  due_date: string; status: string; completion_date: string
  completion_notes: string; created_by: string; created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  report: 'Гузориш (рапорт)', conclusion: 'Заключение', initiative: 'Собственная инициатива'
}

export default function RecommendationDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [item, setItem] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [showComplete, setShowComplete] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    async function fetch_() {
      const { data } = await supabase.from('recommendations').select('*').eq('id', id).single()
      setItem(data)
      setLoading(false)
    }
    fetch_()
  }, [id])

  async function handleComplete() {
    setCompleting(true)
    await supabase.from('recommendations').update({
      status: 'Выполнена',
      completion_date: new Date().toISOString().split('T')[0],
      completion_notes: completeNotes,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    const { data } = await supabase.from('recommendations').select('*').eq('id', id).single()
    setItem(data); setShowComplete(false); setCompleting(false)
  }

  async function handleDelete() {
    if (!confirm('Удалить рекомендацию?')) return
    await supabase.from('recommendations').delete().eq('id', id)
    router.push('/recommendations')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!item) return <div className="flex items-center justify-center h-64 text-gray-400">Рекомендация не найдена</div>

  const getStatusStyle = (s: string) => {
    if (s === 'Выполнена') return { bg: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="w-5 h-5" /> }
    if (s === 'В процессе') return { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock className="w-5 h-5" /> }
    if (s === 'Просрочена') return { bg: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-5 h-5" /> }
    return { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-5 h-5" /> }
  }

  const getAcceptStyle = (s: string) => {
    if (s === 'Принята') return 'bg-green-100 text-green-700 border-green-200'
    if (s === 'Не принята') return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }

  const days = item.due_date ? Math.ceil((new Date(item.due_date).getTime() - Date.now()) / 86400000) : null
  const statusStyle = getStatusStyle(item.status)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/recommendations')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{item.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Рекомендация · {SOURCE_LABELS[item.source_type]}</p>
        </div>
        <div className="flex items-center gap-2">
          {(item.status === 'Открыта' || item.status === 'В процессе') && (
            <button onClick={() => setShowComplete(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4" /> Выполнено
            </button>
          )}
          <button onClick={() => router.push(`/recommendations?edit=${id}`)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${statusStyle.bg}`}>
          {statusStyle.icon}
          <div>
            <p className="text-xs opacity-70">Статус исполнения</p>
            <p className="font-bold text-lg">{item.status}</p>
          </div>
        </div>
        <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${getAcceptStyle(item.acceptance_status)}`}>
          {item.acceptance_status === 'Принята' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          <div>
            <p className="text-xs opacity-70">Статус принятия</p>
            <p className="font-bold text-lg">{item.acceptance_status}</p>
          </div>
        </div>
      </div>

      {/* Main info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        {item.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание</p>
            <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['Источник', SOURCE_LABELS[item.source_type]],
            ['Рапорт/Заключение', item.report_name || '—'],
            ['Дата рапорта', item.report_date ? new Date(item.report_date).toLocaleDateString('ru-RU') : '—'],
            ['Приоритет', item.priority],
            ['Ответственный', item.responsible || '—'],
            ['Подразделение', item.department || '—'],
            ['Создал', item.created_by || '—'],
            ['Дата создания', new Date(item.created_at).toLocaleDateString('ru-RU')],
            ['Срок исполнения', item.due_date ? new Date(item.due_date).toLocaleDateString('ru-RU') : '—'],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-xs text-gray-500">{l}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {item.due_date && item.status !== 'Выполнена' && days !== null && (
          <div className={`p-3 rounded-lg border text-sm font-medium ${days < 0 ? 'bg-red-50 border-red-200 text-red-700' : days <= 7 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            {days < 0 ? `⚠️ Просрочено на ${Math.abs(days)} дней` : days === 0 ? '⚠️ Срок истекает сегодня' : `📅 До срока осталось ${days} дней`}
          </div>
        )}

        {item.acceptance_status === 'Не принята' && item.acceptance_notes && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs font-semibold text-red-600 mb-1">Причина непринятия</p>
            <p className="text-sm text-red-700">{item.acceptance_notes}</p>
          </div>
        )}

        {item.status === 'Выполнена' && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
            <p className="text-xs font-semibold text-green-600 mb-1">
              Выполнено {item.completion_date ? new Date(item.completion_date).toLocaleDateString('ru-RU') : ''}
            </p>
            {item.completion_notes && <p className="text-sm text-green-700">{item.completion_notes}</p>}
          </div>
        )}
      </div>

      {/* Complete Modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold">Отметить как выполненную</h2>
              <button onClick={() => setShowComplete(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{item.title}</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Примечание к исполнению</label>
                <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={3}
                  placeholder="Что было сделано..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowComplete(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleComplete} disabled={completing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Выполнено
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

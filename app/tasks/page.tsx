'use client'
import { ListTodo } from 'lucide-react'

export default function TasksWIP() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ListTodo className="w-8 h-8 text-yellow-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Управление задачами СУР</h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full mb-4">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-yellow-700">Доработка в процессе</span>
        </div>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Модуль управления задачами СУР находится в разработке.
          Он заменит Notion и будет включать стратегические задачи, еженедельные задачи и бэклог.
        </p>
      </div>
    </div>
  )
}

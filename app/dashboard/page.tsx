import { Shield, FileText, TrendingUp, Droplets, ArrowRight, FolderOpen, ClipboardCheck, BookUser, Building2, BarChart3, ListTodo } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Добрый день 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Risk Management System · ОАО «Алиф Банк»</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Операционный риск */}
        <Link href="/operational-risk/registry" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Операционный риск</h3>
          <p className="text-xs text-gray-400 mb-3">Реестр инцидентов, дашборд, картирование</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Реестр инцидентов</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Внешние инциденты</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Дашборд</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Стресс-тест</span>
          </div>
        </Link>

        {/* Кредитный риск */}
        <Link href="/credit-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#1B8A4C]" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Кредитный риск</h3>
          <p className="text-xs text-gray-400 mb-3">AI-заключения по SME заёмщикам</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Заключения SME</span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><BookUser className="w-3 h-3" /> Реестр заёмщиков</span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Стресс-тест</span>
          </div>
        </Link>

        {/* Рыночный риск */}
        <Link href="/market-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Рыночный риск</h3>
          <p className="text-xs text-gray-400 mb-3">Финансовый анализ и оценка контрагентов</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Фин. анализ</span>
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Оценка матрица</span>
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Building2 className="w-3 h-3" /> Реестр контрагентов</span>
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Стресс-тест</span>
          </div>
        </Link>

        {/* Ликвидность */}
        <Link href="/liquidity" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-cyan-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Риск ликвидности</h3>
          <p className="text-xs text-gray-400 mb-3">Стресс-тест T+1, T+7, T+30</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">3 сценария</span>
            <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">Стресс-тест</span>
          </div>
        </Link>

        {/* ВНД */}
        <Link href="/vnd" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">ВНД СУР</h3>
          <p className="text-xs text-gray-400 mb-3">Внутренние нормативные документы, версионность</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Документы</span>
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Версионность</span>
          </div>
        </Link>

        {/* Реестр рекомендаций */}
        <Link href="/recommendations" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-rose-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Реестр рекомендаций</h3>
          <p className="text-xs text-gray-400 mb-3">Контроль исполнения рекомендаций СУР</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">Мониторинг</span>
            <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">Исполнение</span>
          </div>
        </Link>

        {/* ✅ Задачи СУР — активная карточка */}
        <Link href="/tasks" className="group block bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-xl p-6 shadow-sm hover:shadow-lg transition-all col-span-1 sm:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ListTodo className="w-5 h-5 text-white" />
            </div>
            <ArrowRight className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-semibold text-white mb-1">Управление задачами СУР</h3>
          <p className="text-xs text-green-100/70 mb-4">Стратегические задачи по 5 направлениям · Еженедельные · Бэклог</p>
          <div className="flex flex-wrap gap-2">
            {['🏢 Корпоративная культура','✅ Соответствие','⚙️ Автоматизация','🛡️ ERM','📚 Обучение'].map(t => (
              <span key={t} className="text-xs bg-white/15 text-white px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

      </div>
    </div>
  )
}

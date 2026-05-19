import { Shield, FileText, TrendingUp, Droplets, ArrowRight, FolderOpen, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Добрый день 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Risk Management Platform · ОАО «Алиф Банк»</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/operational-risk/registry" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Операционный риск</h3>
          <p className="text-sm text-gray-500">Реестр инцидентов, дашборд, картирование</p>
        </Link>

        <Link href="/credit-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#1B8A4C]" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Кредитный риск</h3>
          <p className="text-sm text-gray-500">AI-заключения по SME заёмщикам</p>
        </Link>

        <Link href="/market-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Рыночный риск</h3>
          <p className="text-sm text-gray-500">Оценка контрагентов, лимиты</p>
        </Link>

        <Link href="/liquidity" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-cyan-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Риск ликвидности</h3>
          <p className="text-sm text-gray-500">Стресс-тест T+1, T+7, T+30</p>
        </Link>

        <Link href="/vnd" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">ВНД СУР</h3>
          <p className="text-sm text-gray-500">Внутренние нормативные документы, версионность</p>
        </Link>

        <Link href="/recommendations" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-rose-600" />
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Реестр рекомендаций</h3>
          <p className="text-sm text-gray-500">Контроль исполнения рекомендаций СУР</p>
        </Link>
      </div>
    </div>
  )
}

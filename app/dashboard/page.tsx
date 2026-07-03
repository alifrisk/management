import { Shield, FileText, TrendingUp, Droplets, ArrowRight, FolderOpen, ClipboardCheck, ListTodo, LineChart, Bot, FlaskConical } from 'lucide-react'
import Link from 'next/link'
import CfpDashboardCard from '@/components/dashboard/CfpDashboardCard'
import GapDashboardCard from '@/components/dashboard/GapDashboardCard'
import NewsBlock from '@/components/dashboard/NewsBlock'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Добрый день 👋</h1>
        <p className="text-gray-500 text-xs mt-0.5">Risk Management System · ОАО «Алиф Банк»</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Операционный риск */}
        <Link href="/operational-risk/registry" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Операционный риск</h3>
          <p className="text-[11px] text-gray-400 mb-2">Реестр, дашборд, картирование</p>
          <div className="flex flex-wrap gap-1">
            {['Реестр','Внешние','Дашборд','Стресс-тест'].map(t => (
              <span key={t} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Кредитный риск */}
        <Link href="/credit-risk" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#1B8A4C]" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Кредитный риск</h3>
          <p className="text-[11px] text-gray-400 mb-2">AI-заключения по МСБ заёмщикам</p>
          <div className="flex flex-wrap gap-1">
            {['Заключения МСБ','Заёмщики','Стресс-тест'].map(t => (
              <span key={t} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Рыночный риск */}
        <Link href="/market-risk" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Рыночный риск</h3>
          <p className="text-[11px] text-gray-400 mb-2">Анализ контрагентов, стресс-тест</p>
          <div className="flex flex-wrap gap-1">
            {['Фин. анализ','Контрагенты','Стресс-тест','Индикаторы'].map(t => (
              <span key={t} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Ликвидность — Стресс-тест */}
        <Link href="/liquidity" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
              <Droplets className="w-4 h-4 text-cyan-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Риск ликвидности</h3>
          <p className="text-[11px] text-gray-400 mb-2">Стресс-тест T+1, T+7, T+30</p>
          <div className="flex flex-wrap gap-1">
            {['3 сценария','Стресс-тест'].map(t => (
              <span key={t} className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Ликвидность — CFP (live widget) */}
        <CfpDashboardCard />

        {/* Ликвидность — ГЭП (live widget) */}
        <GapDashboardCard />

        {/* Индикаторы рынка */}
        <Link href="/market-risk/indicators" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <LineChart className="w-4 h-4 text-indigo-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Индикаторы рынка</h3>
          <p className="text-[11px] text-gray-400 mb-2">Золото, нефть, валюты, крипто</p>
          <div className="flex flex-wrap gap-1">
            {['Золото','Нефть','Bitcoin','Валюты'].map(t => (
              <span key={t} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* ВНД */}
        <Link href="/vnd" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-amber-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">ВНД СУР</h3>
          <p className="text-[11px] text-gray-400 mb-2">Внутренние нормативные документы</p>
          <div className="flex flex-wrap gap-1">
            {['Документы','Версионность'].map(t => (
              <span key={t} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Реестр рекомендаций */}
        <Link href="/recommendations" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-rose-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Реестр рекомендаций</h3>
          <p className="text-[11px] text-gray-400 mb-2">Контроль исполнения рекомендаций</p>
          <div className="flex flex-wrap gap-1">
            {['Мониторинг','Исполнение'].map(t => (
              <span key={t} className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Рисковик AI */}
        <Link href="/ai-agent" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Рисковик AI</h3>
          <p className="text-[11px] text-gray-400 mb-2">AI-ассистент по управлению рисками</p>
          <div className="flex flex-wrap gap-1">
            {['Базель II/III','НБТ','ISO 31000','История чатов'].map(t => (
              <span key={t} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Реестр стресс-тестов */}
        <Link href="/stress-test-registry" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-[#1B8A4C]" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Реестр стресс-тестов</h3>
          <p className="text-[11px] text-gray-400 mb-2">История стресс-тестов по всем рискам</p>
          <div className="flex flex-wrap gap-1">
            {['Опер.','Кред.','Рыночный','Ликвидность'].map(t => (
              <span key={t} className="text-[10px] bg-green-50 text-[#1B8A4C] px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

        {/* Задачи СУР */}
        <Link href="/tasks" className="group block bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-xl p-4 shadow-sm hover:shadow-lg transition-all col-span-2">
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <ListTodo className="w-4 h-4 text-white" />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-semibold text-white text-sm mb-0.5">Задачи СУР</h3>
          <p className="text-[11px] text-green-100/70 mb-2">Стратегические · Еженедельные · Бэклог</p>
          <div className="flex flex-wrap gap-1.5">
            {['🏢 Корпоративная культура','✅ Соответствие','⚙️ Автоматизация','🛡️ ERM','📚 Обучение'].map(t => (
              <span key={t} className="text-[10px] bg-white/15 text-white px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </Link>

      </div>

      <NewsBlock />
    </div>
  )
}

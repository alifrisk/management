import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import {
  Shield,
  FileText,
  TrendingUp,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const isAdmin = profile.role === 'admin'

  // Статистика инцидентов (только для админа)
  let stats = {
    total: 0, open: 0, in_progress: 0, closed: 0,
    total_loss: 0, recovery: 0, extreme: 0, high: 0,
    pending_forms: 0,
  }

  if (isAdmin) {
    const [incidentsRes, formsRes] = await Promise.all([
      supabase.from('operational_incidents').select('incident_status, risk_level, loss_amount_tjs, recovery_amount'),
      supabase.from('incident_forms').select('id', { count: 'exact' }).eq('status', 'pending'),
    ])

    const incidents = incidentsRes.data || []
    stats = {
      total: incidents.length,
      open: incidents.filter(i => i.incident_status === 'Открыт').length,
      in_progress: incidents.filter(i => i.incident_status === 'В процессе').length,
      closed: incidents.filter(i => i.incident_status === 'Закрыт').length,
      total_loss: incidents.reduce((s, i) => s + (i.loss_amount_tjs || 0), 0),
      recovery: incidents.reduce((s, i) => s + (i.recovery_amount || 0), 0),
      extreme: incidents.filter(i => i.risk_level === 'Экстремальные').length,
      high: incidents.filter(i => i.risk_level === 'Высокий').length,
      pending_forms: formsRes.count || 0,
    }
  }

  const formatNum = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Доброе утро' : hour < 17 ? 'Добрый день' : 'Добрый вечер'
  const firstName = profile.full_name?.split(' ')[0] || 'Сотрудник'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
          {' · '}
          {isAdmin ? 'Администратор СУР' : 'Риск-координатор'}
          {profile.department && ` · ${profile.department}`}
        </p>
      </div>

      {/* Admin Stats */}
      {isAdmin && (
        <>
          {/* Alert: pending forms */}
          {stats.pending_forms > 0 && (
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 text-sm">
                    {stats.pending_forms} новых анкет ожидают обработки
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5">
                    Риск-координаторы подали анкеты об инцидентах
                  </p>
                </div>
              </div>
              <Link
                href="/operational-risk/registry?filter=pending"
                className="text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center gap-1"
              >
                Обработать <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Всего инцидентов"
              value={stats.total}
              icon={<Shield className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              label="Открытые"
              value={stats.open}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="yellow"
            />
            <StatCard
              label="В процессе"
              value={stats.in_progress}
              icon={<Clock className="w-5 h-5" />}
              color="orange"
            />
            <StatCard
              label="Закрытые"
              value={stats.closed}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="green"
            />
          </div>

          {/* Financial stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Общий ущерб</p>
              <p className="text-2xl font-bold text-red-600">{formatNum(stats.total_loss)}</p>
              <p className="text-xs text-gray-400 mt-0.5">сомони</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Возвращено</p>
              <p className="text-2xl font-bold text-[#1B8A4C]">{formatNum(stats.recovery)}</p>
              <p className="text-xs text-gray-400 mt-0.5">сомони</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Критические риски</p>
              <p className="text-2xl font-bold text-red-600">{stats.extreme}</p>
              <p className="text-xs text-gray-400 mt-0.5">экстремальный · {stats.high} высокий</p>
            </div>
          </div>
        </>
      )}

      {/* Modules grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Модули системы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Operational Risk */}
          <Link href="/operational-risk/registry" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[#1B8A4C]/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Операционный риск</h3>
            <p className="text-sm text-gray-500 mb-3">
              Реестр инцидентов, дашборд аналитика, картирование рисков
            </p>
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                  {stats.total} инцидентов
                </span>
                {stats.open > 0 && (
                  <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                    {stats.open} открытых
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Credit Risk */}
          {isAdmin ? (
            <Link href="/credit-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[#1B8A4C]/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1B8A4C]" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Кредитный риск</h3>
              <p className="text-sm text-gray-500">
                AI-заключения по SME заёмщикам, скоринг, рекомендации
              </p>
            </Link>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-[#1B8A4C]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Кредитный риск</h3>
              <p className="text-sm text-gray-400">Доступно только для СУР</p>
            </div>
          )}

          {/* Market Risk */}
          {isAdmin ? (
            <Link href="/market-risk" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[#1B8A4C]/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Рыночный риск</h3>
              <p className="text-sm text-gray-500">
                Оценка контрагентов, лимиты на корреспондентские счета
              </p>
            </Link>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Рыночный риск</h3>
              <p className="text-sm text-gray-400">Доступно только для СУР</p>
            </div>
          )}

          {/* Liquidity */}
          {isAdmin ? (
            <Link href="/liquidity" className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[#1B8A4C]/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-cyan-600" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Риск ликвидности</h3>
              <p className="text-sm text-gray-500">
                Стресс-тест ликвидности: T+1, T+7, T+30
              </p>
            </Link>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mb-4">
                <Droplets className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Риск ликвидности</h3>
              <p className="text-sm text-gray-400">Доступно только для СУР</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick action for user role */}
      {!isAdmin && (
        <div className="bg-[#1B8A4C] rounded-xl p-6 text-white">
          <h3 className="font-semibold mb-1">Обнаружили инцидент?</h3>
          <p className="text-green-100 text-sm mb-4">
            Заполните анкету — она автоматически поступит в Службу управления рисками.
          </p>
          <Link
            href="/incident-form"
            className="inline-flex items-center gap-2 bg-white text-[#1B8A4C] px-4 py-2 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors"
          >
            Заполнить анкету <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'yellow' | 'orange' | 'green' | 'red'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    green:  'bg-green-50 text-[#1B8A4C]',
    red:    'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

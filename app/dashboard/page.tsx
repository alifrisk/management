import { createServerClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import { Shield, FileText, TrendingUp, Droplets, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const isAdmin = profile.role === 'admin'

  let stats = { total: 0, open: 0, in_progress: 0, closed: 0, total_loss: 0, recovery: 0, extreme: 0, high: 0, pending_forms: 0 }

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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{greeting}, {firstName} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{isAdmin ? 'Администратор СУР' : 'Риск-координатор'}
          {profile.department && ` · ${profile.department}`}
        </p>
      </div>

      {isAdmin && (
        <>
          {stats.pending_forms > 0 && (
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 text-sm">{stats.pending_forms} новых анкет ожидают обработки</p>
                  <p className="text-amber-600 text-xs mt-0.5">Риск-координаторы подали анкеты об инцидентах</p>
                </div>
              </div>
              <Link href="/operational-risk/registry" className="text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center gap-1">
                Обработать <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Всего инцидентов', value: stats.total, icon: <Shield className="w-5 h-5" />, color: 'blue' },
              { label: 'Открытые', value: stats.open, icon: <AlertTriangle className="w-5 h-5" />, color: 'yellow' },
              { label: 'В процессе', value: stats.in_progress, icon: <Clock className="w-5 h-5" />, color: 'orange' },
              { label: 'Закрытые', value: stats.closed, icon: <CheckCircle2 className="w-5 h-5" />, color: 'green' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className={`inline-flex p-2 rounded-lg mb-3 ${s.color === 'blue' ? 'bg-blue-50 text-blue-600' : s.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' : s.color === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-[#1B8A4C]'}`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

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

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Модули системы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Операционный риск', desc: 'Реестр инцидентов, дашборд, картирование', href: '/operational-risk/registry', icon: <Shield className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', show: true },
            { title: 'Кредитный риск', desc: 'AI-заключения по SME заёмщикам', href: '/credit-risk', icon: <FileText className="w-5 h-5 text-[#1B8A4C]" />, bg: 'bg-green-50', show: isAdmin },
            { title: 'Рыночный риск', desc: 'Оценка контрагентов, лимиты', href: '/market-risk', icon: <TrendingUp className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50', show: isAdmin },
            { title: 'Риск ликвидности', desc: 'Стресс-тест T+1, T+7, T+30', href: '/liquidity', icon: <Droplets className="w-5 h-5 text-cyan-600" />, bg: 'bg-cyan-50', show: isAdmin },
          ].map((m) => m.show ? (
            <Link key={m.title} href={m.href} className="group block bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-[#1B8A4C]/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center`}>{m.icon}</div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{m.title}</h3>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </Link>
          ) : (
            <div key={m.title} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm opacity-40">
              <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mb-4`}>{m.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{m.title}</h3>
              <p className="text-sm text-gray-400">Доступно только для СУР</p>
            </div>
          ))}
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-[#1B8A4C] rounded-xl p-6 text-white">
          <h3 className="font-semibold mb-1">Обнаружили инцидент?</h3>
          <p className="text-green-100 text-sm mb-4">Заполните анкету — она поступит в Службу управления рисками.</p>
          <Link href="/incident-form" className="inline-flex items-center gap-2 bg-white text-[#1B8A4C] px-4 py-2 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors">
            Заполнить анкету <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

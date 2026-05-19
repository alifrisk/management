'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/supabase/client'
import { UserProfile } from '@/types'
import { cn } from '@/lib/utils'
import { Shield, FileText, TrendingUp, Droplets, LayoutDashboard, ChevronDown, ChevronRight, LogOut, Settings, Users, Menu, X, ClipboardList, BarChart3, Map, FolderOpen, ClipboardCheck } from 'lucide-react'

interface SidebarProps { user: UserProfile }

const NAV_ITEMS = [
  { title: 'Главная', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, adminOnly: false },
  {
    title: 'Операционный риск', href: '/operational-risk', icon: <Shield className="w-4 h-4" />, adminOnly: false,
    children: [
      { title: 'Реестр инцидентов', href: '/operational-risk/registry', icon: <ClipboardList className="w-3.5 h-3.5" /> },
      { title: 'Дашборд аналитика', href: '/operational-risk/dashboard', icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { title: 'Картирование рисков', href: '/operational-risk/mapping', icon: <Map className="w-3.5 h-3.5" /> },
    ],
  },
  { title: 'Кредитный риск', href: '/credit-risk', icon: <FileText className="w-4 h-4" />, adminOnly: true, children: [{ title: 'Заключения SME', href: '/credit-risk', icon: <FileText className="w-3.5 h-3.5" /> }] },
  { title: 'Рыночный риск', href: '/market-risk', icon: <TrendingUp className="w-4 h-4" />, adminOnly: true, children: [{ title: 'Оценка контрагентов', href: '/market-risk', icon: <TrendingUp className="w-3.5 h-3.5" /> }] },
  { title: 'Ликвидность', href: '/liquidity', icon: <Droplets className="w-4 h-4" />, adminOnly: true, children: [{ title: 'Стресс-тест', href: '/liquidity', icon: <BarChart3 className="w-3.5 h-3.5" /> }] },
  { title: 'ВНД СУР', href: '/vnd', icon: <FolderOpen className="w-4 h-4" />, adminOnly: false, children: [{ title: 'Документы', href: '/vnd', icon: <FolderOpen className="w-3.5 h-3.5" /> }] },
  { title: 'Реестр рекомендаций', href: '/recommendations', icon: <ClipboardCheck className="w-4 h-4" />, adminOnly: false, children: [{ title: 'Рекомендации', href: '/recommendations', icon: <ClipboardList className="w-3.5 h-3.5" /> }] },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = user.role === 'admin'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Auto-open active menu, close others — одновременно только один открыт
  const getActiveMenu = () => {
    for (const item of NAV_ITEMS) {
      if (item.children?.some(c => pathname.startsWith(c.href))) return item.href
    }
    return null
  }
  const [openMenu, setOpenMenu] = useState<string | null>(getActiveMenu)

  // При смене pathname — авто открыть нужный и закрыть остальные
  useEffect(() => {
    setOpenMenu(getActiveMenu())
  }, [pathname])

  function toggleMenu(href: string) {
    setOpenMenu(prev => prev === href ? null : href)
  }

  async function confirmLogout() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    : user.email[0].toUpperCase()

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-sm leading-tight">Risk Management</div>
          <div className="text-green-200/70 text-xs">Алиф Банк · СУР</div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter(item => isAdmin || !item.adminOnly).map((item) => (
          <div key={item.href}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleMenu(item.href)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    item.children.some(c => pathname.startsWith(c.href)) ? 'bg-white/20 text-white' : 'text-green-100 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="flex-shrink-0 text-green-200">{item.icon}</span>
                  <span className="flex-1 text-left font-medium">{item.title}</span>
                  {openMenu === item.href ? <ChevronDown className="w-3.5 h-3.5 text-green-200" /> : <ChevronRight className="w-3.5 h-3.5 text-green-200" />}
                </button>
                {openMenu === item.href && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {item.children.map((child) => (
                      <Link key={child.href} href={child.href} onClick={() => setMobileOpen(false)}
                        className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                          pathname === child.href ? 'bg-white/20 text-white font-medium' : 'text-green-100/80 hover:bg-white/10 hover:text-white'
                        )}>
                        <span className="text-green-200 flex-shrink-0">{child.icon}</span>
                        {child.title}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link href={item.href} onClick={() => setMobileOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  pathname === item.href ? 'bg-white/20 text-white font-medium' : 'text-green-100 hover:bg-white/10 hover:text-white'
                )}>
                <span className="flex-shrink-0 text-green-200">{item.icon}</span>
                {item.title}
              </Link>
            )}
          </div>
        ))}

        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-green-300/50 text-xs font-medium px-3 mb-2 uppercase tracking-wider">Администрирование</p>
            <Link href="/admin/users" onClick={() => setMobileOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                pathname.startsWith('/admin/users') ? 'bg-white/20 text-white font-medium' : 'text-green-100 hover:bg-white/10 hover:text-white'
              )}>
              <Users className="w-4 h-4 text-green-200" /> Пользователи
            </Link>
            <Link href="/admin/settings" onClick={() => setMobileOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                pathname.startsWith('/admin/settings') ? 'bg-white/20 text-white font-medium' : 'text-green-100 hover:bg-white/10 hover:text-white'
              )}>
              <Settings className="w-4 h-4 text-green-200" /> Настройки
            </Link>
          </div>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.full_name || user.email}</p>
            <p className="text-green-200/60 text-xs">{user.role === 'admin' ? 'Администратор' : 'Риск-координатор'}</p>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} title="Выйти" className="flex-shrink-0 text-green-200/60 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logout confirmation — по центру экрана через fixed */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-72 shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-1 text-sm text-center">Выйти из системы?</h3>
            <p className="text-xs text-gray-500 mb-5 text-center">Вы уверены что хотите выйти?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-medium text-white"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1B8A4C] text-white rounded-lg shadow-lg">
        <Menu className="w-5 h-5" />
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('lg:hidden fixed left-0 top-0 h-full z-50 w-64 shadow-2xl transition-transform duration-300', mobileOpen ? 'translate-x-0' : '-translate-x-full')} style={{ background: "linear-gradient(135deg, #0d3320 0%, #145c32 100%)" }}>
        {sidebarContent}
      </aside>
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen overflow-y-auto" style={{ background: "linear-gradient(135deg, #0d3320 0%, #145c32 100%)" }}>
        {sidebarContent}
      </aside>
    </>
  )
}

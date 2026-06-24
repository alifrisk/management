'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/supabase/client'
import { UserProfile } from '@/types'
import { cn } from '@/lib/utils'
import { useI18n, type TranslationKey, type Lang } from '@/lib/i18n'
import { Shield, FileText, TrendingUp, Droplets, LayoutDashboard, ChevronDown, ChevronRight, LogOut, Settings, Users, Menu, X, ClipboardList, BarChart3, Map, FolderOpen, ClipboardCheck, BookUser, Activity, Building2, ListTodo, Newspaper, Bot, LineChart, Sun, Moon, ShieldAlert, GitMerge } from 'lucide-react'

interface SidebarProps { user: UserProfile }

const NAV_ITEMS = [
  { titleKey: 'nav.home' as TranslationKey, href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, adminOnly: false },
  {
    titleKey: 'nav.operationalRisk' as TranslationKey, href: '/operational-risk', icon: <Shield className="w-4 h-4" />, adminOnly: false,
    children: [
      { titleKey: 'nav.incidentRegistry' as TranslationKey,   href: '/operational-risk/registry',   icon: <ClipboardList className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.externalIncidents' as TranslationKey,  href: '/operational-risk/external',   icon: <Newspaper className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.analyticsDashboard' as TranslationKey, href: '/operational-risk/dashboard',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.riskMapping' as TranslationKey,        href: '/operational-risk/mapping',    icon: <Map className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.stressTest' as TranslationKey,         href: '/operational-risk/stress-test',icon: <Activity className="w-3.5 h-3.5" /> },
    ],
  },
  {
    titleKey: 'nav.creditRisk' as TranslationKey, href: '/credit-risk', icon: <FileText className="w-4 h-4" />, adminOnly: true,
    children: [
      { titleKey: 'nav.smeConclusions' as TranslationKey,   href: '/credit-risk',            icon: <FileText className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.borrowerRegistry' as TranslationKey, href: '/borrowers',              icon: <BookUser className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.stressTest' as TranslationKey,       href: '/credit-risk/stress-test',icon: <Activity className="w-3.5 h-3.5" /> },
    ],
  },
  {
    titleKey: 'nav.marketRisk' as TranslationKey, href: '/market-risk', icon: <TrendingUp className="w-4 h-4" />, adminOnly: true,
    children: [
      { titleKey: 'nav.financialAnalysis' as TranslationKey,      href: '/market-risk/financial-analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.counterpartyAssessment' as TranslationKey, href: '/market-risk',                   icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.counterpartyRegistry' as TranslationKey,   href: '/counterparties',                icon: <Building2 className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.stressTest' as TranslationKey,             href: '/market-risk/stress-test',       icon: <Activity className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.marketIndicators' as TranslationKey,       href: '/market-risk/indicators',        icon: <LineChart className="w-3.5 h-3.5" /> },
    ],
  },
  {
    titleKey: 'nav.liquidity' as TranslationKey, href: '/liquidity', icon: <Droplets className="w-4 h-4" />, adminOnly: true,
    children: [
      { titleKey: 'nav.stressTest'  as TranslationKey, href: '/liquidity',         icon: <BarChart3  className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.cfpPlan'    as TranslationKey, href: '/liquidity/cfp',     icon: <ShieldAlert className="w-3.5 h-3.5" /> },
      { titleKey: 'nav.gapAnalysis' as TranslationKey, href: '/liquidity/gap',    icon: <GitMerge   className="w-3.5 h-3.5" /> },
    ],
  },
  { titleKey: 'nav.vnd' as TranslationKey, href: '/vnd', icon: <FolderOpen className="w-4 h-4" />, adminOnly: false, children: [{ titleKey: 'nav.documents' as TranslationKey, href: '/vnd', icon: <FolderOpen className="w-3.5 h-3.5" /> }] },
  { titleKey: 'nav.recommendations' as TranslationKey, href: '/recommendations', icon: <ClipboardCheck className="w-4 h-4" />, adminOnly: false, children: [{ titleKey: 'nav.recommendationsList' as TranslationKey, href: '/recommendations', icon: <ClipboardList className="w-3.5 h-3.5" /> }] },
  { titleKey: 'nav.tasks' as TranslationKey, href: '/tasks', icon: <ListTodo className="w-4 h-4" />, adminOnly: true },
  { titleKey: 'nav.aiAgent' as TranslationKey, href: '/ai-agent', icon: <Bot className="w-4 h-4" />, adminOnly: false },
]
export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { t, lang, setLang } = useI18n()
  const isAdmin = user.role === 'admin'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const html = document.documentElement
    const next = !html.classList.contains('dark')
    html.classList.toggle('dark', next)
    localStorage.setItem('alif-theme', next ? 'dark' : 'light')
    setIsDark(next)
  }
  const getActiveMenu = () => {
    for (const item of NAV_ITEMS) {
      if (item.children?.some(c => pathname.startsWith(c.href))) return item.href
    }
    return null
  }
  const [openMenu, setOpenMenu] = useState<string | null>(getActiveMenu)
  useEffect(() => { setOpenMenu(getActiveMenu()) }, [pathname])
  function toggleMenu(href: string) {
    setOpenMenu(prev => prev === href ? null : href)
  }
  async function confirmLogout() {
    sessionStorage.removeItem('alif_user')
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }
  const initials = user.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    : user.email[0].toUpperCase()
  const roleMap: Record<string, TranslationKey> = {
    admin: 'roles.admin', observer: 'roles.observer',
    coordinator: 'roles.coordinator', user: 'roles.user',
  }
  const roleLabel = roleMap[user.role] ? t(roleMap[user.role]) : user.role
  const sidebarContent = (
    <div className="flex flex-col h-full">
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
                <button onClick={() => toggleMenu(item.href)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    item.children.some(c => pathname.startsWith(c.href)) ? 'bg-white/20 text-white' : 'text-green-100 hover:bg-white/10 hover:text-white'
                  )}>
                  <span className="flex-shrink-0 text-green-200">{item.icon}</span>
                  <span className="flex-1 text-left font-medium">{t(item.titleKey)}</span>
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
                        <span className="flex-1">{t(child.titleKey)}</span>
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
                {t(item.titleKey)}
              </Link>
            )}
          </div>
        ))}
        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-green-300/50 text-xs font-medium px-3 mb-2 uppercase tracking-wider">{t('nav.admin')}</p>
            <Link href="/admin/users" onClick={() => setMobileOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                pathname.startsWith('/admin/users') ? 'bg-white/20 text-white font-medium' : 'text-green-100 hover:bg-white/10 hover:text-white'
              )}>
              <Users className="w-4 h-4 text-green-200" /> {t('nav.users')}
            </Link>
            <Link href="/admin/settings" onClick={() => setMobileOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                pathname.startsWith('/admin/settings') ? 'bg-white/20 text-white font-medium' : 'text-green-100 hover:bg-white/10 hover:text-white'
              )}>
              <Settings className="w-4 h-4 text-green-200" /> {t('nav.settings')}
            </Link>
          </div>
        )}
      </nav>
      <div className="px-3 py-3 border-t border-white/10 space-y-2">
        {/* Language switcher */}
        <div className="flex items-center gap-1 px-2">
          {(['ru', 'tg', 'en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                lang === l ? 'bg-white/20 text-white' : 'text-green-200/50 hover:text-green-100'
              }`}>
              {l === 'tg' ? 'TJ' : l.toUpperCase()}
            </button>
          ))}
        </div>
        {/* User row */}
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-semibold">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user.full_name || user.email}</p>
            <p className="text-green-200/60 text-xs">{roleLabel}</p>
          </div>
          <button onClick={toggleTheme} title={isDark ? t('theme.light') : t('theme.dark')} className="flex-shrink-0 text-green-200/60 hover:text-white transition-colors">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowLogoutConfirm(true)} title={t('logout.confirm')} className="flex-shrink-0 text-green-200/60 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
  return (
    <>
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl p-6 w-72 shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-1 text-sm text-center">{t('logout.title')}</h3>
            <p className="text-xs text-gray-500 mb-5 text-center">{t('logout.description')}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">{t('logout.cancel')}</button>
              <button onClick={confirmLogout} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-medium text-white">{t('logout.confirm')}</button>
            </div>
          </div>
        </div>
      )}
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

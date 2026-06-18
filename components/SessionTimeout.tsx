'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/supabase/client'
import { LogOut, Clock } from 'lucide-react'

const IDLE_MINUTES = 15
const WARNING_BEFORE_SECONDS = 120 // show warning 2 min before logout
const IDLE_MS = IDLE_MINUTES * 60 * 1000
const WARNING_MS = IDLE_MS - WARNING_BEFORE_SECONDS * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

// Pages that don't need session timeout (auth pages)
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/update-password', '/auth/no-access']

export function SessionTimeout() {
  const router = useRouter()
  const pathname = usePathname()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_BEFORE_SECONDS)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPublic = PUBLIC_PATHS.some(p => pathname?.startsWith(p))

  const clearTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const doLogout = useCallback(async () => {
    clearTimers()
    setShowWarning(false)
    sessionStorage.removeItem('alif_user')
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }, [router])

  const resetTimers = useCallback(() => {
    if (isPublic) return
    clearTimers()
    setShowWarning(false)
    setSecondsLeft(WARNING_BEFORE_SECONDS)

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(WARNING_BEFORE_SECONDS)
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }, WARNING_MS)

    idleTimer.current = setTimeout(() => {
      doLogout()
    }, IDLE_MS)
  }, [isPublic, doLogout])

  // Check if user is logged in before starting timers
  useEffect(() => {
    if (isPublic) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      resetTimers()
    })

    return () => clearTimers()
  }, [isPublic, resetTimers])

  // Attach activity listeners
  useEffect(() => {
    if (isPublic) return

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimers))
    }
  }, [isPublic, resetTimers])

  // Reset timers on route change
  useEffect(() => {
    if (!isPublic) resetTimers()
  }, [pathname, isPublic, resetTimers])

  if (!showWarning) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs} сек`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
          <Clock className="w-6 h-6 text-white flex-shrink-0" />
          <h2 className="text-white font-semibold text-base">Сессия истекает</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-700 text-sm leading-relaxed">
            Вы не активны уже {IDLE_MINUTES - 2} минут. Из соображений безопасности сессия завершится автоматически.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl py-4 text-center">
            <p className="text-xs text-amber-600 font-medium mb-1">Выход через</p>
            <p className="text-3xl font-bold text-amber-600 tabular-nums">{timeStr}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetTimers}
              className="flex-1 px-4 py-2.5 bg-[#1B8A4C] text-white rounded-xl text-sm font-medium hover:bg-[#177040] transition-colors"
            >
              Продолжить работу
            </button>
            <button
              onClick={doLogout}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/supabase/client'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

async function redirectByRole(userId: string) {
  const { data } = await supabase.from('user_profiles').select('role').eq('id', userId).single()
  const role = data?.role

  if (role === 'admin') {
    window.location.href = '/dashboard'
  } else if (role === 'observer') {
    window.location.href = '/dashboard'
  } else if (role === 'coordinator') {
    window.location.href = '/incident-form'
  } else {
    window.location.href = '/auth/no-access'
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole(session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Проверка домена
    if (!email.endsWith('@alif.tj')) {
      setError('Доступ только для сотрудников ОАО «Алиф Банк». Используйте корпоративную почту @alif.tj')
      setLoading(false)
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        setError('Неверный email или пароль.')
      } else {
        setError('Ошибка: ' + signInError.message)
      }
      setLoading(false)
      return
    }

    if (data.session) {
      await redirectByRole(data.session.user.id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 50%, #1B8A4C 100%)'}}>
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 50%, #1B8A4C 100%)'}}>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Risk Management Platform</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Вход в систему</h2>
          <p className="text-sm text-gray-500 mb-6">Используйте корпоративную почту ОАО «Алиф Банк»</p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Корпоративный email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="имя@alif.tj" required autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Введите пароль" required autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link href="/auth/forgot-password" className="text-sm text-[#1B8A4C] hover:text-[#177040] font-medium">
                Забыли пароль?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#1B8A4C] hover:bg-[#177040] disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Входим...</> : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">© 2026 ОАО «Алиф Банк» · Служба управления рисками</p>
      </div>
    </div>
  )
}

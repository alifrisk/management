'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/supabase/client'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        setError('Неверный email или пароль. Проверьте данные и попробуйте снова.')
      } else if (signInError.message.includes('Email not confirmed')) {
        setError('Email не подтверждён. Проверьте корпоративную почту.')
      } else {
        setError('Ошибка входа. Попробуйте позже или обратитесь к администратору.')
      }
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-16 bg-white rounded-2xl shadow-xl mb-4 px-3">
            <Image src="/alif-logo.png" alt="Алиф Банк" width={100} height={40} className="object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Risk Management Platform
          </h1>
          <p className="text-green-200 text-sm mt-1 font-light">
            Служба управления рисками · ОАО «Алиф Банк»
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Вход в систему</h2>
          <p className="text-sm text-gray-500 mb-6">Используйте корпоративную почту Алиф Банк</p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Корпоративный email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="имя@alif.tj"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#1B8A4C] focus:ring-[#1B8A4C]"
                />
                <span className="text-sm text-gray-600">Запомнить меня</span>
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-[#1B8A4C] hover:text-[#177040] font-medium">
                Забыли пароль?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 px-4 bg-[#1B8A4C] hover:bg-[#177040] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Входим...</> : 'Войти'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Нет аккаунта?{' '}
              <Link href="/auth/register" className="text-[#1B8A4C] hover:text-[#177040] font-medium">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-green-200/60 text-xs mt-6">
          © 2026 ОАО «Алиф Банк» · Служба управления рисками
        </p>
      </div>
    </div>
  )
}

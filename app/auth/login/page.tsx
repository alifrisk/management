'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('Ошибка: ' + signInError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Risk Management Platform
          </h1>
          <p className="text-green-200 text-sm mt-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Корпоративный email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="имя@alif.tj"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
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
              <span></span>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[#1B8A4C] hover:text-[#177040] font-medium"
              >
                Забыли пароль?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 bg-[#1B8A4C] hover:bg-[#177040] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Входим...</>
              ) : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-green-200/60 text-xs mt-6">
          © 2026 ОАО «Алиф Банк» · Служба управления рисками
        </p>
      </div>
    </div>
  )
}

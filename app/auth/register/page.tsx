'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/supabase/client'
import { Shield, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { DEPARTMENTS } from '@/lib/constants'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    department: '',
    position: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Валидация пароля
    if (formData.password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают. Проверьте и попробуйте снова.')
      return
    }

    // Проверка корпоративного email
    if (!formData.email.endsWith('@alifbank.tj')) {
      setError('Для регистрации используйте корпоративный email @alifbank.tj')
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          department: formData.department,
          position: formData.position,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('Этот email уже зарегистрирован. Попробуйте войти.')
      } else {
        setError('Ошибка регистрации: ' + signUpError.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#1B8A4C]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Проверьте почту!
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Письмо с подтверждением отправлено на{' '}
            <span className="font-medium text-gray-700">{formData.email}</span>.
            Перейдите по ссылке в письме для активации аккаунта.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            После подтверждения email администратор назначит вам роль доступа.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center w-full py-2.5 bg-[#1B8A4C] text-white rounded-lg font-medium hover:bg-[#177040] transition-colors"
          >
            Перейти к входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-xl mb-4">
            <Shield className="w-7 h-7 text-[#1B8A4C]" />
          </div>
          <h1 className="text-xl font-semibold text-white">Risk Management Platform</h1>
          <p className="text-green-200 text-sm mt-1">ОАО «Алиф Банк» · СУР</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fade-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Регистрация</h2>
          <p className="text-sm text-gray-500 mb-5">
            Только для сотрудников Алиф Банк (@alifbank.tj)
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ФИО <span className="text-red-500">*</span>
              </label>
              <input
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Иванов Иван Иванович"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Корпоративный email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="имя@alifbank.tj"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Структурное подразделение <span className="text-red-500">*</span>
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all bg-white"
              >
                <option value="">Выберите подразделение</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Должность <span className="text-red-500">*</span>
              </label>
              <input
                name="position"
                type="text"
                value={formData.position}
                onChange={handleChange}
                placeholder="Риск-координатор"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Пароль <span className="text-red-500">*</span>
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Минимум 8 символов"
                required
                minLength={8}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Подтвердите пароль <span className="text-red-500">*</span>
              </label>
              <input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Повторите пароль"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1B8A4C] hover:bg-[#177040] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Регистрация...</>
              ) : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Уже есть аккаунт?{' '}
              <Link href="/auth/login" className="text-[#1B8A4C] font-medium hover:text-[#177040]">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

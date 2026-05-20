'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // ✅ Проверка корпоративной почты
    if (!email.endsWith('@alif.tj')) {
      setError('Восстановление пароля доступно только для сотрудников ОАО «Алиф Банк». Используйте корпоративную почту @alif.tj')
      setLoading(false)
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://alif-risk-platform.vercel.app/auth/update-password',
    })
    if (resetError) {
      setError('Ошибка: ' + resetError.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Risk Management Platform</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-[#1B8A4C] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Письмо отправлено!</h2>
              <p className="text-sm text-gray-500 mb-5">Проверьте почту <strong>{email}</strong> и перейдите по ссылке.</p>
              <Link href="/auth/login" className="inline-flex items-center gap-2 text-[#1B8A4C] font-medium text-sm">
                <ArrowLeft className="w-4 h-4" /> Вернуться к входу
              </Link>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-5">
                <ArrowLeft className="w-4 h-4" /> Назад
              </Link>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Восстановление пароля</h2>
              <p className="text-sm text-gray-500 mb-5">Введите корпоративный email @alif.tj — мы отправим ссылку для сброса пароля.</p>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Корпоративный email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="имя@alif.tj" required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
                </div>
                <button type="submit" disabled={loading || !email} className="w-full py-2.5 bg-[#1B8A4C] hover:bg-[#177040] disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем...</> : 'Отправить ссылку'}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-green-200/60 text-xs mt-4">© 2026 ОАО «Алиф Банк» · Служба управления рисками</p>
      </div>
    </div>
  )
}

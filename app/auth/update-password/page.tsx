'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Ошибка: ' + updateError.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f3d24] via-[#1B8A4C] to-[#2EAD62] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-white">Risk Management Platform</h1>
          <p className="text-green-200 text-sm mt-2">ОАО «Алиф Банк» · СУР</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-[#1B8A4C] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Пароль обновлён!</h2>
              <p className="text-gray-500 text-sm">Перенаправляем в систему...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Новый пароль</h2>
              <p className="text-sm text-gray-500 mb-5">Придумайте новый пароль для входа</p>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Новый пароль *</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" required minLength={8} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Подтвердите пароль *</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Повторите пароль" required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
                </div>
                <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#1B8A4C] hover:bg-[#177040] disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...</> : 'Сохранить пароль'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

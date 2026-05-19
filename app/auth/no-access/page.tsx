'use client'

import { supabase } from '@/supabase/client'
import { ShieldX } from 'lucide-react'

export default function NoAccessPage() {
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 50%, #1B8A4C 100%)'}}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Доступ закрыт</h2>
        <p className="text-sm text-gray-500 mb-6">
          Ваша учётная запись не найдена в системе или не имеет доступа.<br />
          Пожалуйста, обратитесь в <strong>Службу управления рисками</strong>.
        </p>
        <button onClick={handleLogout}
          className="px-6 py-2.5 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          Выйти
        </button>
      </div>
    </div>
  )
}

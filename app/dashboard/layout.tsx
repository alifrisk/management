'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'
import { UserProfile } from '@/types'
export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function checkAuth() {
      const cached = sessionStorage.getItem('alif_user')
      if (cached) {
        try { setUser(JSON.parse(cached)); setLoading(false); return }
        catch { sessionStorage.removeItem('alif_user') }
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
      if (!profile) { router.replace('/auth/no-access'); return }
      if (profile.role === 'coordinator') { router.replace('/incident-form'); return }
      if (profile.is_active === false) { await supabase.auth.signOut(); sessionStorage.removeItem('alif_user'); router.replace('/auth/login'); return }
      sessionStorage.setItem('alif_user', JSON.stringify(profile))
      setUser(profile); setLoading(false)
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { sessionStorage.removeItem('alif_user'); router.replace('/auth/login') }
    })
    return () => subscription.unsubscribe()
  }, [router])
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F8F6]"><Loader2 className="w-8 h-8 text-[#1B8A4C] animate-spin" /></div>
  if (!user) return null
  return (
    <div className="flex min-h-screen bg-[#F5F8F6]">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

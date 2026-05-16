import { redirect } from 'next/navigation'
import { createServerClient } from '@/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F5F8F6]">
      <Sidebar user={profile} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  )
}

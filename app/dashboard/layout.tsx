import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#F5F8F6]">
      <Sidebar user={{
        id: '1',
        email: 'muhammat.obidov@alif.tj',
        full_name: 'Мухаммат Обидов',
        role: 'admin',
        department: 'Служба управления рисками',
        position: 'Риск-аналитик',
        is_active: true,
        created_at: '',
        updated_at: '',
        phone: undefined,
        avatar_url: undefined,
      }} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

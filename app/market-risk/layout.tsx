import Sidebar from "@/components/layout/Sidebar"

const TEMP_USER = {
  id: "961928a5-bb2e-4328-b1be-c59211a822cb",
  email: "muhammat.obidov@alif.tj",
  full_name: "Мухаммат Обидов",
  role: "admin" as const,
  department: "Служба управления рисками",
  position: "Риск-аналитик",
  is_active: true,
  created_at: "",
  updated_at: "",
  phone: undefined,
  avatar_url: undefined,
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F8F6]">
      <Sidebar user={TEMP_USER} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

import NewsBlock from '@/components/dashboard/NewsBlock'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Добрый день</h1>
        <p className="text-gray-500 text-xs mt-0.5">Risk Management System · ОАО «Алиф Банк»</p>
      </div>
      <NewsBlock />
    </div>
  )
}

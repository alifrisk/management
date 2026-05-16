// Полная страница реестра инцидентов будет в Sprint 3
// Сейчас это заглушка — убедимся что маршрутизация работает
export default function RegistryPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Реестр операционных инцидентов</h1>
        <p className="text-gray-500 text-sm">
          Этот модуль разрабатывается в Sprint 3. <br/>
          Страница входа и навигация работают корректно ✅
        </p>
      </div>
    </div>
  )
}

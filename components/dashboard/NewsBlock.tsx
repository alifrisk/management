'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, Newspaper } from 'lucide-react'
import type { NewsItem } from '@/app/api/news/route'

export default function NewsBlock() {
  const [news, setNews]       = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [refreshed, setRefreshed] = useState<Date | null>(null)

  async function load() {
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNews(data)
      setRefreshed(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Новости рисков и финансов</p>
            {refreshed && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Обновлено {refreshed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · кэш 1 ч
              </p>
            )}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
          title="Обновить"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-50">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-gray-400">
            Не удалось загрузить новости
            <button onClick={load} className="block mx-auto mt-2 text-xs text-[#1B8A4C] hover:underline">Попробовать снова</button>
          </div>
        ) : news.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Нет новостей по теме</div>
        ) : (
          news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium leading-snug group-hover:text-[#1B8A4C] transition-colors line-clamp-2">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full truncate max-w-[140px]">
                    {item.source}
                  </span>
                  {item.pubDate && (
                    <span className="text-[10px] text-gray-400">{item.pubDate}</span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] flex-shrink-0 mt-0.5 transition-colors" />
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      {news.length > 0 && (
        <div className="px-5 py-2.5 border-t border-gray-50 bg-gray-50/50">
          <p className="text-[10px] text-gray-400">
            Источники: MarketWatch · Investing.com · Google News (EN/RU) · Обновление раз в час
          </p>
        </div>
      )}
    </div>
  )
}

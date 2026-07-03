'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, Newspaper } from 'lucide-react'
import type { NewsItem, NewsCategory } from '@/app/api/news/route'

type FilterTab = 'all' | NewsCategory

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',   label: 'Все' },
  { id: 'tj',    label: 'Таджикистан' },
  { id: 'cis',   label: 'СНГ' },
  { id: 'world', label: 'Мир' },
]

const CAT_BADGE: Record<NewsCategory, string> = {
  tj:    'bg-emerald-100 text-emerald-700',
  cis:   'bg-blue-100 text-blue-700',
  world: 'bg-violet-100 text-violet-700',
}

const CAT_LABEL: Record<NewsCategory, string> = {
  tj:    'Таджикистан',
  cis:   'СНГ',
  world: 'Мир',
}

const SOURCE_COLORS: Record<string, string> = {
  'Sputnik TJ':     'bg-red-50 text-red-600',
  'Asia-Plus':      'bg-orange-50 text-orange-600',
  'Avesta.tj':      'bg-amber-50 text-amber-700',
  'Google TJ':      'bg-emerald-50 text-emerald-700',
  'ТАСС':           'bg-sky-50 text-sky-700',
  'Коммерсантъ':    'bg-blue-50 text-blue-700',
  'Интерфакс':      'bg-indigo-50 text-indigo-700',
  'OilPrice.com':   'bg-yellow-50 text-yellow-700',
  'Mining.com':     'bg-stone-100 text-stone-600',
  'Financial Post': 'bg-teal-50 text-teal-700',
  'MarketWatch':    'bg-green-50 text-green-700',
}

function srcBadge(source: string) {
  return SOURCE_COLORS[source] ?? 'bg-gray-100 text-gray-600'
}

const PAGE_SIZE = 8

export default function NewsBlock() {
  const [all, setAll]           = useState<NewsItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [tab, setTab]           = useState<FilterTab>('all')
  const [visible, setVisible]   = useState(PAGE_SIZE)
  const [refreshed, setRefreshed] = useState<Date | null>(null)

  async function load() {
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error()
      setAll(await res.json())
      setRefreshed(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function switchTab(t: FilterTab) { setTab(t); setVisible(PAGE_SIZE) }

  const filtered = tab === 'all' ? all : all.filter(n => n.category === tab)
  const lead     = filtered[0]
  const rest     = filtered.slice(1, visible)
  const hasMore  = visible < filtered.length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-[#1B8A4C]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Новостной портал</p>
            {refreshed && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Обновлено {refreshed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · кэш 1 ч
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  tab === t.id
                    ? 'bg-[#1B8A4C] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
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
      </div>

      {/* Body */}
      {loading && all.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Не удалось загрузить новости
          <button onClick={load} className="block mx-auto mt-2 text-xs text-[#1B8A4C] hover:underline">
            Попробовать снова
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Нет новостей в этой категории</div>
      ) : (
        <div className="p-5 space-y-4">

          {/* Lead story */}
          {lead && (
            <a
              href={lead.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2.5 p-4 rounded-xl border border-gray-100 hover:border-[#1B8A4C]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_BADGE[lead.category]}`}>
                  {CAT_LABEL[lead.category]}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${srcBadge(lead.source)}`}>
                  {lead.source}
                </span>
                {lead.pubDate && (
                  <span className="text-[10px] text-gray-400">{lead.pubDate}</span>
                )}
              </div>
              <p className="text-base font-semibold text-gray-900 leading-snug group-hover:text-[#1B8A4C] transition-colors">
                {lead.title}
              </p>
              {lead.summary && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{lead.summary}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-[#1B8A4C] font-medium">
                Читать <ExternalLink className="w-3 h-3" />
              </div>
            </a>
          )}

          {/* 2-column grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rest.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-1.5 p-3.5 rounded-xl border border-gray-100 hover:border-[#1B8A4C]/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${CAT_BADGE[item.category]}`}>
                      {CAT_LABEL[item.category]}
                    </span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${srcBadge(item.source)}`}>
                      {item.source}
                    </span>
                    {item.pubDate && (
                      <span className="text-[9px] text-gray-400">{item.pubDate}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 font-medium leading-snug group-hover:text-[#1B8A4C] transition-colors line-clamp-3">
                    {item.title}
                  </p>
                </a>
              ))}
            </div>
          )}

          {/* Show more */}
          {hasMore && (
            <button
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              className="w-full py-2.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:border-[#1B8A4C] hover:text-[#1B8A4C] transition-colors"
            >
              Показать ещё {Math.min(PAGE_SIZE, filtered.length - visible)} новостей
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      {all.length > 0 && (
        <div className="px-5 py-2.5 border-t border-gray-50 bg-gray-50/50">
          <p className="text-[10px] text-gray-400">
            Источники: Sputnik TJ · Asia-Plus · Avesta.tj · ТАСС · Коммерсантъ · Интерфакс · OilPrice.com · Mining.com · Financial Post · MarketWatch
          </p>
        </div>
      )}
    </div>
  )
}

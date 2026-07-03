import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
  isoDate: string
}

const FEEDS = [
  {
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    source: 'MarketWatch',
  },
  {
    url: 'https://www.investing.com/rss/news_14.rss',
    source: 'Investing.com',
  },
  {
    url: 'https://news.google.com/rss/search?q=banking+liquidity+risk+management+finance&hl=en&gl=US&ceid=US:en',
    source: 'Google News',
  },
  {
    url: 'https://news.google.com/rss/search?q=inflation+central+bank+interest+rates+gold+oil&hl=en&gl=US&ceid=US:en',
    source: 'Google News',
  },
  {
    url: 'https://news.google.com/rss/search?q=%D0%B1%D0%B0%D0%BD%D0%BA+%D1%80%D0%B8%D1%81%D0%BA+%D0%BB%D0%B8%D0%BA%D0%B2%D0%B8%D0%B4%D0%BD%D0%BE%D1%81%D1%82%D1%8C+%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0+%D0%B8%D0%BD%D1%84%D0%BB%D1%8F%D1%86%D0%B8%D1%8F&hl=ru&gl=RU&ceid=RU:ru',
    source: 'Google Новости',
  },
]

const KEYWORDS = [
  'банк', 'риск', 'ликвидность', 'ставка', 'инфляция', 'нефть', 'золото',
  'биткоин', 'курс', 'цб', 'нбт', 'капитал', 'кредит', 'валют', 'рубл',
  'bank', 'risk', 'liquidity', 'rate', 'inflation', 'oil', 'gold', 'bitcoin',
  'fed', 'ecb', 'credit', 'market', 'finance', 'debt', 'bond', 'yield',
  'central', 'monetary', 'gdp', 'recession', 'economy', 'financial',
]

function matchesKeyword(title: string): boolean {
  const lower = title.toLowerCase()
  return KEYWORDS.some(kw => lower.includes(kw))
}

// In-memory cache
let cache: { items: NewsItem[]; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.items)
  }

  const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)' } })
  const all: NewsItem[] = []

  await Promise.allSettled(
    FEEDS.map(async ({ url, source }) => {
      try {
        const feed = await parser.parseURL(url)
        for (const item of feed.items || []) {
          const title = item.title?.trim() || ''
          if (!title) continue
          if (!matchesKeyword(title)) continue
          const iso = item.isoDate || item.pubDate || ''
          all.push({
            title,
            link: item.link || url,
            source: feed.title ? `${feed.title}` : source,
            pubDate: iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
            isoDate: iso,
          })
        }
      } catch {
        // skip silently
      }
    })
  )

  // Deduplicate by title similarity, sort by date desc, take top 10
  const seen = new Set<string>()
  const deduped = all.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  deduped.sort((a, b) => {
    const ta = a.isoDate ? new Date(a.isoDate).getTime() : 0
    const tb = b.isoDate ? new Date(b.isoDate).getTime() : 0
    return tb - ta
  })

  const items = deduped.slice(0, 10)
  cache = { items, ts: Date.now() }

  return NextResponse.json(items)
}

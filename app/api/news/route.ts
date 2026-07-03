import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

export type NewsCategory = 'tj' | 'cis' | 'world'

export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
  isoDate: string
  category: NewsCategory
  summary?: string
}

const FEEDS: { url: string; source: string; category: NewsCategory; filtered?: boolean }[] = [
  // Tajikistan — all news
  { url: 'https://tj.sputniknews.ru/export/rss2/archive/index.xml', source: 'Sputnik TJ', category: 'tj' },
  { url: 'https://asiaplustj.info/ru/rss', source: 'Asia-Plus', category: 'tj' },
  { url: 'https://avesta.tj/feed', source: 'Avesta.tj', category: 'tj' },
  {
    url: 'https://news.google.com/rss/search?q=%D0%A2%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA&hl=ru&gl=TJ&ceid=TJ:ru',
    source: 'Google TJ',
    category: 'tj',
  },
  // CIS / Russia — finance-filtered
  { url: 'https://tass.ru/rss/v2.xml', source: 'ТАСС', category: 'cis', filtered: true },
  { url: 'https://www.kommersant.ru/RSS/news.xml', source: 'Коммерсантъ', category: 'cis', filtered: true },
  { url: 'https://www.interfax.ru/rss.asp', source: 'Интерфакс', category: 'cis', filtered: true },
  // World
  { url: 'https://oilprice.com/rss/main', source: 'OilPrice.com', category: 'world' },
  { url: 'https://www.mining.com/feed/', source: 'Mining.com', category: 'world' },
  { url: 'https://financialpost.com/feed', source: 'Financial Post', category: 'world', filtered: true },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch', category: 'world', filtered: true },
]

const FINANCE_KW = [
  'банк', 'риск', 'ликвидность', 'ставка', 'инфляция', 'нефть', 'золото', 'валют', 'рубл',
  'капитал', 'кредит', 'экономик', 'бюджет', 'ввп', 'санкц', 'нбт', 'цб', 'мвф', 'минфин',
  'процент', 'долг', 'доход', 'актив', 'рынок', 'торгов',
  'bank', 'risk', 'rate', 'inflation', 'oil', 'gold', 'credit', 'finance', 'debt', 'bond',
  'yield', 'fed', 'ecb', 'imf', 'market', 'economy', 'monetary', 'gdp', 'recession', 'trade',
  'investment', 'stock', 'mining', 'commodity', 'energy', 'currency', 'exchange', 'capital',
  'interest', 'deposit', 'asset', 'fund', 'profit', 'revenue', 'earnings',
]

function matchesFinance(title: string): boolean {
  const lower = title.toLowerCase()
  return FINANCE_KW.some(kw => lower.includes(kw))
}

let cache: { items: NewsItem[]; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.items)
  }

  const parser = new Parser({
    timeout: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)' },
    customFields: { item: [['description', 'rawDesc']] },
  })
  const all: NewsItem[] = []

  await Promise.allSettled(
    FEEDS.map(async ({ url, source, category, filtered }) => {
      try {
        const feed = await parser.parseURL(url)
        for (const item of feed.items || []) {
          const title = item.title?.trim() || ''
          if (!title) continue
          if (filtered && !matchesFinance(title)) continue
          const iso = item.isoDate || item.pubDate || ''
          const rawDesc: string = (item as unknown as Record<string, unknown>).rawDesc as string || ''
          const summary = rawDesc
            ? rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 220)
            : (item.contentSnippet || '').slice(0, 220)
          all.push({
            title,
            link: item.link || url,
            source,
            pubDate: iso
              ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '',
            isoDate: iso,
            category,
            summary: summary || undefined,
          })
        }
      } catch {
        // skip failed feeds silently
      }
    })
  )

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

  const items = deduped.slice(0, 40)
  cache = { items, ts: Date.now() }

  return NextResponse.json(items)
}

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

const FEEDS: { url: string; source: string; category: NewsCategory }[] = [
  // Tajikistan
  { url: 'https://tj.sputniknews.ru/export/rss2/archive/index.xml', source: 'Sputnik TJ', category: 'tj' },
  { url: 'https://asiaplustj.info/ru/rss', source: 'Asia-Plus', category: 'tj' },
  { url: 'https://avesta.tj/feed', source: 'Avesta.tj', category: 'tj' },
  {
    url: 'https://news.google.com/rss/search?q=%D0%A2%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA&hl=ru&gl=TJ&ceid=TJ:ru',
    source: 'Google TJ',
    category: 'tj',
  },
  // CIS / Russia
  { url: 'https://tass.ru/rss/v2.xml', source: 'ТАСС', category: 'cis' },
  { url: 'https://www.kommersant.ru/RSS/news.xml', source: 'Коммерсантъ', category: 'cis' },
  { url: 'https://www.interfax.ru/rss.asp', source: 'Интерфакс', category: 'cis' },
  // World
  { url: 'https://oilprice.com/rss/main', source: 'OilPrice.com', category: 'world' },
  { url: 'https://www.mining.com/feed/', source: 'Mining.com', category: 'world' },
  { url: 'https://financialpost.com/feed', source: 'Financial Post', category: 'world' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch', category: 'world' },
]

// All sources filtered — only finance / banking / economics topics
const FINANCE_KW = [
  // Russian
  'банк', 'риск', 'ликвидност', 'ставк', 'инфляци', 'нефт', 'золот', 'биткоин', 'курс',
  'цб', 'нбт', 'капитал', 'кредит', 'экономик', 'финанс', 'рынок', 'инвестиц',
  'доллар', 'рубл', 'сомони', 'ввп', 'санкц', 'регулятор', 'бюджет', 'долг',
  'процент', 'актив', 'торгов', 'валют', 'доход', 'прибыл', 'убыт', 'дефицит',
  'профицит', 'монетарн', 'платёж', 'вклад', 'депозит', 'денеж', 'резерв',
  'мвф', 'минфин', 'набиуллин', 'акци', 'облигац', 'фондов', 'биржа',
  // English
  'bank', 'risk', 'liquidity', 'rate', 'inflation', 'oil', 'gold', 'bitcoin', 'crypto',
  'fed', 'ecb', 'imf', 'credit', 'finance', 'market', 'economy', 'monetary', 'gdp',
  'recession', 'trade', 'investment', 'stock', 'mining', 'commodity', 'energy',
  'currency', 'exchange', 'capital', 'interest', 'deposit', 'asset', 'fund',
  'profit', 'revenue', 'debt', 'bond', 'yield', 'dollar', 'ruble', 'somoni',
  'sanction', 'regulator', 'budget', 'deficit', 'surplus', 'payment', 'fiscal',
  'financial', 'economic', 'treasury', 'central bank', 'reserve', 'equity',
]

function matchesFinance(title: string): boolean {
  const lower = title.toLowerCase()
  return FINANCE_KW.some(kw => lower.includes(kw))
}

// TJ and CIS sources are shown first within the same hour bucket
const LANG_PRIORITY: Record<NewsCategory, number> = { tj: 0, cis: 1, world: 2 }

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

  // Fresh array every cache rebuild — no accumulation
  const all: NewsItem[] = []

  await Promise.allSettled(
    FEEDS.map(async ({ url, source, category }) => {
      try {
        const feed = await parser.parseURL(url)
        for (const item of feed.items || []) {
          const title = item.title?.trim() || ''
          if (!title) continue
          // All sources filtered by finance/banking keywords
          if (!matchesFinance(title)) continue
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

  // Deduplicate
  const seen = new Set<string>()
  const deduped = all.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort: newest first; within same hour bucket — TJ then CIS then World
  deduped.sort((a, b) => {
    const ta = a.isoDate ? new Date(a.isoDate).getTime() : 0
    const tb = b.isoDate ? new Date(b.isoDate).getTime() : 0
    const hourA = Math.floor(ta / 3_600_000)
    const hourB = Math.floor(tb / 3_600_000)
    if (hourA === hourB) {
      return LANG_PRIORITY[a.category] - LANG_PRIORITY[b.category]
    }
    return tb - ta
  })

  const items = deduped.slice(0, 40)
  cache = { items, ts: Date.now() }

  return NextResponse.json(items)
}

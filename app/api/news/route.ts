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
  // ── Tajikistan ────────────────────────────────────────────────────────────
  { url: 'https://tj.sputniknews.ru/export/rss2/archive/index.xml', source: 'Sputnik TJ',  category: 'tj' },
  { url: 'https://asiaplustj.info/ru/rss',                          source: 'Asia-Plus',   category: 'tj' },
  { url: 'https://avesta.tj/feed',                                   source: 'Avesta.tj',   category: 'tj' },
  {
    url: 'https://news.google.com/rss/search?q=%D0%A2%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA&hl=ru&gl=TJ&ceid=TJ:ru',
    source: 'Google TJ', category: 'tj',
  },

  // ── CIS / Russia ──────────────────────────────────────────────────────────
  { url: 'https://tass.ru/rss/v2.xml',              source: 'ТАСС',        category: 'cis' },
  { url: 'https://www.kommersant.ru/RSS/news.xml',  source: 'Коммерсантъ', category: 'cis' },
  { url: 'https://www.interfax.ru/rss.asp',         source: 'Интерфакс',   category: 'cis' },
  { url: 'https://www.banki.ru/xml/news.rss',       source: 'Banki.ru',    category: 'cis' },
  { url: 'https://akipress.com/rss/news.rss',       source: 'AKIpress',    category: 'cis' },
  { url: 'http://www.finmarket.ru/rss/',            source: 'Finmarket',   category: 'cis' },
  {
    url: 'https://news.google.com/rss/search?q=%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA+%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D1%8B+%D0%A1%D0%9D%D0%93&hl=ru&gl=RU&ceid=RU:ru',
    source: 'Google CIS', category: 'cis',
  },

  // ── World ─────────────────────────────────────────────────────────────────
  { url: 'https://oilprice.com/rss/main',                           source: 'OilPrice.com',   category: 'world' },
  { url: 'https://www.mining.com/feed/',                            source: 'Mining.com',     category: 'world' },
  { url: 'https://financialpost.com/feed',                          source: 'Financial Post', category: 'world' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',   source: 'MarketWatch',    category: 'world' },
]

// Named entities — shown unconditionally
const NAMED_ENTITIES = [
  'jefferson capital holdings',
  'jefferson trust ltd',
  'jefferson trust',
  'хофиз шахиди',
  'хофиза шахиди',
  'алиф банк',
  'alif bank',
]

// ── Russian stems (substring match — intentional: covers all morphological forms) ──
// e.g. 'банк' matches банк / банка / банков / банковский / банкротство
const FINANCE_STEMS_RU = [
  'банк', 'риск', 'ликвидност', 'ставк', 'инфляци', 'нефт', 'золот', 'биткоин', 'курс',
  'цб рф', 'нбт', 'нбрк', 'нацбанк', 'капитал', 'кредит', 'экономик', 'финанс', 'рынок', 'инвестиц',
  'доллар', 'рубл', 'сомони', 'ввп', 'санкц', 'регулятор', 'бюджет', 'долг',
  'процент', 'актив', 'торгов', 'валют', 'доход', 'прибыл', 'убыт', 'дефицит',
  'профицит', 'монетарн', 'платёж', 'вклад', 'депозит', 'денеж', 'резерв',
  'мвф', 'минфин', 'набиуллин', 'акци', 'облигац', 'фондов', 'биржа',
  'банкрот', 'рефинансирован', 'надзор', 'ипотек', 'микрофинанс',
  'налог', 'пошлин', 'тариф', 'экспорт', 'импорт', 'трансфер', 'ремитт',
  'эмитент', 'листинг', 'дивиденд', 'рентабельн', 'платёжеспособн',
  'эмисси', 'ликвидац', 'реструктуризац', 'нормативы', 'достаточност',
  'процентн', 'межбанк', 'овернайт', 'репо', 'своп', 'форвард', 'деривати',
  'торговый баланс', 'платёжный баланс', 'текущий счёт',
  'мировой банк', 'азиатский банк', 'центральный банк', 'народный банк',
  'ключевая ставка', 'учётная ставка', 'базовая ставка',
  'страхован', 'перестрахован', 'пенсион', 'брокер', 'дилер', 'трейдер',
  'выручк', 'оборот', 'ликвидность', 'капитализац',
]

// ── English whole-word keywords (word-boundary matched — prevents 'oil' matching 'soil') ──
// Multi-word phrases use \s+ to handle varying whitespace
const FINANCE_WORDS_EN = [
  // Institutions & regulators
  'bank', 'banking', 'central bank', 'federal reserve', 'imf', 'world bank',
  'ecb', 'fed', 'opec', 'bis', 'wto', 'treasury',
  // Core finance
  'finance', 'financial', 'fintech', 'economy', 'economic', 'economics',
  'monetary', 'fiscal', 'credit', 'lending', 'loan', 'mortgage',
  // Markets & instruments
  'stock market', 'stock exchange', 'stock price', 'stock index',
  'bond market', 'bond yield', 'bond', 'yield', 'equity',
  'commodity', 'commodities', 'futures', 'options', 'derivatives',
  'forex', 'exchange rate', 'currency', 'devaluation',
  // Macro
  'gdp', 'inflation', 'deflation', 'stagflation', 'recession',
  'interest rate', 'interest rates', 'rate hike', 'rate cut',
  'unemployment rate', 'trade balance', 'current account',
  'fiscal deficit', 'budget deficit', 'debt',
  // Commodities (specific — avoids false positives from single word)
  'crude oil', 'oil price', 'oil prices', 'brent', 'wti', 'natural gas', 'lng',
  'gold price', 'gold reserves', 'silver price', 'copper price',
  // Crypto
  'bitcoin', 'ethereum', 'cryptocurrency', 'crypto market', 'blockchain', 'defi',
  // Companies / activity
  'investment', 'investor', 'investors', 'venture capital', 'private equity',
  'ipo', 'merger', 'acquisition', 'takeover', 'valuation',
  'profit', 'revenue', 'earnings', 'dividend', 'dividends',
  'bankruptcy', 'insolvency', 'default', 'restructuring',
  // Trade
  'tariff', 'trade war', 'trade deal', 'trade deficit', 'export', 'import', 'imports',
  'sanction', 'sanctions', 'embargo',
  // Banking operations
  'deposit', 'asset', 'assets', 'reserve', 'reserves', 'liquidity',
  'capital adequacy', 'stress test', 'audit', 'rating', 'credit rating',
  'hedge fund', 'mutual fund', 'pension fund', 'sovereign fund',
  'remittance', 'payment', 'transaction', 'settlement',
  // Currencies
  'dollar', 'euro', 'ruble', 'yuan', 'yen', 'somoni',
  // Energy (financial angle)
  'energy market', 'energy price', 'energy crisis',
  // Mining (financial angle — source is Mining.com)
  'mining stock', 'mining sector', 'gold mining', 'copper mining',
]

// Pre-compile word-boundary patterns once at module load (not per request)
const FINANCE_EN_PATTERNS: RegExp[] = FINANCE_WORDS_EN.map(kw =>
  new RegExp(
    `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`,
    'i'
  )
)

// Check title AND description (OR logic)
function matchesFinance(title: string, description = ''): boolean {
  const t = title.toLowerCase()
  const d = description.toLowerCase()

  // 1. Russian stems — substring match covers all morphological forms
  if (FINANCE_STEMS_RU.some(kw => t.includes(kw) || d.includes(kw))) return true

  // 2. English — word-boundary match prevents false positives (oil≠soil, stock≠livestock)
  if (FINANCE_EN_PATTERNS.some(re => re.test(t) || re.test(d))) return true

  // 3. Named entities (unconditional pass)
  if (NAMED_ENTITIES.some(e => t.includes(e) || d.includes(e))) return true

  return false
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

  const all: NewsItem[] = []

  await Promise.allSettled(
    FEEDS.map(async ({ url, source, category }) => {
      try {
        const feed = await parser.parseURL(url)
        for (const item of feed.items || []) {
          const title = item.title?.trim() || ''
          if (!title) continue

          // Extract description text before filter check so it can be used in matchesFinance
          const rawDesc: string = (item as unknown as Record<string, unknown>).rawDesc as string || ''
          const descText = rawDesc
            ? rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 400)
            : (item.contentSnippet || '').slice(0, 400)

          if (!matchesFinance(title, descText)) continue

          const iso = item.isoDate || item.pubDate || ''
          all.push({
            title,
            link: item.link || url,
            source,
            pubDate: iso
              ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '',
            isoDate: iso,
            category,
            summary: descText.slice(0, 220) || undefined,
          })
        }
      } catch {
        // skip failed feeds silently — does NOT bypass the filter
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
    if (hourA === hourB) return LANG_PRIORITY[a.category] - LANG_PRIORITY[b.category]
    return tb - ta
  })

  const items = deduped.slice(0, 50)
  cache = { items, ts: Date.now() }

  return NextResponse.json(items)
}

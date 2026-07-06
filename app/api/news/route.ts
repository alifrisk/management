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

// financeOnly: true → источник публикует ТОЛЬКО финансовые/деловые новости,
// фильтрация не нужна — берём все статьи.
// financeOnly: false → общеновостной источник, применяем строгий фильтр по ЗАГОЛОВКУ.
const FEEDS: { url: string; source: string; category: NewsCategory; financeOnly: boolean }[] = [
  // ── Tajikistan (общая пресса — строгий фильтр) ────────────────────────────
  { url: 'https://tj.sputniknews.ru/export/rss2/archive/index.xml', source: 'Sputnik TJ',  category: 'tj',    financeOnly: false },
  { url: 'https://asiaplustj.info/ru/rss',                          source: 'Asia-Plus',   category: 'tj',    financeOnly: false },
  { url: 'https://avesta.tj/feed',                                   source: 'Avesta.tj',   category: 'tj',    financeOnly: false },
  {
    url: 'https://news.google.com/rss/search?q=%D0%A2%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA&hl=ru&gl=TJ&ceid=TJ:ru',
    source: 'Google TJ', category: 'tj', financeOnly: false,
  },

  // ── CIS / Russia ──────────────────────────────────────────────────────────
  { url: 'https://tass.ru/rss/v2.xml',              source: 'ТАСС',        category: 'cis', financeOnly: false },
  { url: 'https://www.kommersant.ru/RSS/news.xml',  source: 'Коммерсантъ', category: 'cis', financeOnly: false },
  { url: 'https://www.interfax.ru/rss.asp',         source: 'Интерфакс',   category: 'cis', financeOnly: false },
  { url: 'https://www.banki.ru/xml/news.rss',       source: 'Banki.ru',    category: 'cis', financeOnly: true  }, // 100% финансовый
  { url: 'https://akipress.com/rss/news.rss',       source: 'AKIpress',    category: 'cis', financeOnly: false },
  { url: 'http://www.finmarket.ru/rss/',            source: 'Finmarket',   category: 'cis', financeOnly: true  }, // 100% финансовый
  {
    url: 'https://news.google.com/rss/search?q=%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA+%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D1%8B+%D0%A1%D0%9D%D0%93&hl=ru&gl=RU&ceid=RU:ru',
    source: 'Google CIS', category: 'cis', financeOnly: false,
  },

  // ── World (все специализированные финансовые/товарные) ────────────────────
  { url: 'https://oilprice.com/rss/main',                           source: 'OilPrice.com',   category: 'world', financeOnly: true },
  { url: 'https://www.mining.com/feed/',                            source: 'Mining.com',     category: 'world', financeOnly: true },
  { url: 'https://financialpost.com/feed',                          source: 'Financial Post', category: 'world', financeOnly: true },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',   source: 'MarketWatch',    category: 'world', financeOnly: true },
]

// Named entities — всегда пропускаем (проверяем только заголовок)
const NAMED_ENTITIES = [
  'jefferson capital holdings',
  'jefferson trust ltd',
  'jefferson trust',
  'хофиз шахиди',
  'хофиза шахиди',
  'алиф банк',
  'alif bank',
]

// ── Русские стемы для поиска в ЗАГОЛОВКЕ ─────────────────────────────────────
// Убраны ловушки: 'ставк' (→ поставка, отставка), 'пенсион' (→ пенсионер),
// 'актив' (→ активисты), 'курс' (→ курс лечения), 'налог' (→ налог на сиделок).
// Составные фразы со 'ставка' уже перечислены явно ниже.
const FINANCE_STEMS_RU = [
  // Институты и регуляторы
  'банк', 'нбт', 'нбрк', 'нацбанк', 'цб рф', 'минфин', 'набиуллин', 'мвф',
  'мировой банк', 'азиатский банк', 'центральный банк', 'народный банк',
  // Ставки — только полные составные фразы ('ставк' убран: 'поставка','отставка')
  'ключевая ставка', 'учётная ставка', 'базовая ставка', 'ставка рефинансирования',
  'инфляци', 'кредит', 'ипотек', 'рефинансирован', 'овернайт',
  // Рынки и инструменты
  'биржа', 'фондов', 'акци', 'облигац', 'дивиденд', 'листинг', 'эмитент',
  'репо', 'своп', 'форвард', 'деривати', 'межбанк',
  // Валюты и курсы (только специфичные)
  'валют', 'доллар', 'рубл', 'сомони', 'курс валют', 'курс доллар', 'курс рубл',
  // Макроэкономика
  'ввп', 'ликвидност', 'ликвидность', 'дефицит бюджет', 'профицит',
  'торговый баланс', 'платёжный баланс', 'текущий счёт',
  // Нефть/газ/золото (финансовый аспект)
  'нефт', 'золот', 'биткоин',
  // Банковские операции
  'депозит', 'вклад', 'резерв', 'капитал', 'достаточност',
  'надзор', 'регулятор', 'нормативы', 'реструктуризац', 'банкрот',
  // 'пенсион' убран: 'пенсионер' — человек, а не пенсионный фонд
  'пенсионный фонд', 'пенсионные накопления', 'пенсионная система',
  'микрофинанс',
  // Внешняя торговля (только специфичные)
  'экспорт', 'импорт', 'пошлин', 'тариф', 'санкц', 'эмбарго',
  'трансфер', 'ремитт',
  // Корпоративные финансы
  'прибыл', 'убыт', 'выручк', 'рентабельн', 'платёжеспособн',
  'ликвидац', 'эмисси', 'капитализац',
  // Смешанные
  'страхован', 'перестрахован', 'брокер', 'финанс',
]

// ── Английские ключевые слова с word-boundary ─────────────────────────────
const FINANCE_WORDS_EN = [
  'bank', 'banking', 'central bank', 'federal reserve', 'imf', 'world bank',
  'ecb', 'fed', 'opec', 'bis', 'wto', 'treasury',
  'finance', 'financial', 'fintech',
  'monetary', 'fiscal', 'credit', 'lending', 'loan', 'mortgage',
  'stock market', 'stock exchange', 'stock price', 'stock index',
  'bond market', 'bond yield', 'bond', 'yield', 'equity',
  'commodity', 'commodities', 'futures', 'derivatives',
  'forex', 'exchange rate', 'currency', 'devaluation',
  'gdp', 'inflation', 'deflation', 'stagflation', 'recession',
  'interest rate', 'interest rates', 'rate hike', 'rate cut',
  'trade balance', 'current account', 'fiscal deficit', 'budget deficit', 'debt',
  'crude oil', 'oil price', 'oil prices', 'brent', 'wti', 'natural gas', 'lng',
  'gold price', 'gold reserves', 'silver price', 'copper price',
  'bitcoin', 'ethereum', 'cryptocurrency', 'crypto market', 'blockchain',
  'investment', 'investor', 'investors', 'venture capital', 'private equity',
  'ipo', 'merger', 'acquisition', 'bankruptcy', 'insolvency', 'default', 'restructuring',
  'tariff', 'trade war', 'trade deal', 'sanction', 'sanctions', 'embargo',
  'deposit', 'reserve', 'reserves', 'liquidity', 'capital adequacy', 'stress test',
  'hedge fund', 'mutual fund', 'pension fund', 'sovereign fund',
  'remittance', 'dollar', 'euro', 'ruble', 'yuan', 'yen', 'somoni',
  'energy market', 'energy price', 'energy crisis',
  'gold mining', 'copper mining',
  'profit', 'revenue', 'earnings', 'dividend', 'dividends',
]

const FINANCE_EN_PATTERNS: RegExp[] = FINANCE_WORDS_EN.map(kw =>
  new RegExp(
    `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`,
    'i'
  )
)

// Проверяет ТОЛЬКО заголовок (для общеновостных источников).
// Намеренно НЕ проверяет описание — там слишком много ложных срабатываний:
// "климатический форум" → описание "инвестиции в зелёную энергетику" → false positive.
function matchesFinanceTitle(title: string): boolean {
  const t = title.toLowerCase()

  if (NAMED_ENTITIES.some(e => t.includes(e))) return true
  if (FINANCE_STEMS_RU.some(kw => t.includes(kw))) return true
  if (FINANCE_EN_PATTERNS.some(re => re.test(t))) return true

  return false
}

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
    FEEDS.map(async ({ url, source, category, financeOnly }) => {
      try {
        const feed = await parser.parseURL(url)
        for (const item of feed.items || []) {
          const title = item.title?.trim() || ''
          if (!title) continue

          // Для общеновостных источников — строгий фильтр по заголовку.
          // Для финансово-специализированных — пропускаем все статьи.
          if (!financeOnly) {
            const passed = matchesFinanceTitle(title)
            console.log(`[NEWS] ${passed ? 'PASS' : 'SKIP'} [${source}] ${title.slice(0, 100)}`)
            if (!passed) continue
          }

          const rawDesc: string = (item as unknown as Record<string, unknown>).rawDesc as string || ''
          const descText = rawDesc
            ? rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 400)
            : (item.contentSnippet || '').slice(0, 400)

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
        // пропускаем недоступные фиды — фильтр при этом НЕ обходится
      }
    })
  )

  // Дедупликация
  const seen = new Set<string>()
  const deduped = all.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Сортировка: сначала свежие; внутри одного часа — TJ → CIS → World
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

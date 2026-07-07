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
  isCounterparty?: boolean
}

// ── Банки-контрагенты Алиф Банка ─────────────────────────────────────────────
const COUNTERPARTY_KEYWORDS = [
  // Российские
  'Сбербанк', 'Сбер', 'Sberbank', 'СберБанк',
  'Tinkoff', 'Тинькофф', 'Т-Банк', 'T-Bank',
  'Транскапиталбанк', 'ТКБ Банк', 'TKB Bank',
  'МТС Банк', 'МТС-Банк', 'MTS Bank',
  'Москоммерцбанк', 'Moskommertsbank',
  'Цифра банк', 'Tsifra Bank',
  'Банк 131', 'Bank 131',
  'Солид Банк', 'Солидбанк', 'Solid Bank',
  // Таджикские
  'Банк Эсхата', 'Эсхата', 'Eskhata',
  'Спитамен Банк', 'Спитаменбанк', 'Spitamen Bank',
  'Азия-Инвест Банк', 'Азия Инвест', 'Asia Invest Bank',
  'Универсал банк', 'АКБ Универсал', 'Universal Bank',
  // Кыргызские
  'Бакай Банк', 'Бакайбанк', 'Bakai Bank',
  // Белорусские
  'Паритетбанк', 'Паритет Банк', 'Paritetbank',
  'МТБанк', 'МТ Банк', 'MTBank',
  'Технобанк', 'Technobank',
  'Белорусский народный банк', 'БНБ-Банк', 'BNB Bank',
  // Казахские
  'Банк ЦентрКредит', 'ЦентрКредит', 'Bank CenterCredit', 'CenterCredit',
  // Международные
  'Bank of Georgia', 'Банк Грузии',
  'Ardshinbank', 'Ардшинбанк',
  'Mashreqbank', 'Машрекбанк', 'Mashreq',
  'Agricultural Bank of China', 'AgriBank', 'Агробанк Китая',
  'Chouzhou Commercial Bank', 'Чжоушан банк',
  'Arab Banking Corporation', 'ABC Bank',
  'Aktif Yatirim', 'Aktif Bank',
  'Asakabank', 'Асакабанк',
]

const COUNTERPARTY_PATTERNS: RegExp[] = COUNTERPARTY_KEYWORDS.map(kw => {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s\-]+/g, '[\\s\\-]+')
  return new RegExp(`(?<![a-zA-Zа-яёА-ЯЁ0-9])${escaped}(?![a-zA-Zа-яёА-ЯЁ0-9])`, 'i')
})

function matchesCounterparty(text: string): boolean {
  return COUNTERPARTY_PATTERNS.some(re => re.test(text))
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
  { url: 'https://www.banki.ru/xml/news.rss',       source: 'Banki.ru',    category: 'cis', financeOnly: true  },
  { url: 'https://akipress.com/rss/news.rss',       source: 'AKIpress',    category: 'cis', financeOnly: false },
  { url: 'http://www.finmarket.ru/rss/',            source: 'Finmarket',   category: 'cis', financeOnly: true  },
  {
    url: 'https://news.google.com/rss/search?q=%D1%8D%D0%BA%D0%BE%D0%BD%D0%BE%D0%BC%D0%B8%D0%BA%D0%B0+%D0%B1%D0%B0%D0%BD%D0%BA+%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D1%8B+%D0%A1%D0%9D%D0%93&hl=ru&gl=RU&ceid=RU:ru',
    source: 'Google CIS', category: 'cis', financeOnly: false,
  },

  // ── CIS / Kazakhstan ──────────────────────────────────────────────────────
  { url: 'https://kz.kursiv.media/feed/', source: 'Kursiv.kz', category: 'cis', financeOnly: true }, // деловое издание

  // ── CIS / Belarus ─────────────────────────────────────────────────────────
  { url: 'https://myfin.by/rss', source: 'Myfin.by', category: 'cis', financeOnly: true }, // финансовый портал

  // ── CIS / Uzbekistan ──────────────────────────────────────────────────────
  { url: 'https://www.gazeta.uz/ru/rss/', source: 'Gazeta.uz', category: 'cis', financeOnly: false },
  { url: 'https://kun.uz/rss/',           source: 'Kun.uz',    category: 'cis', financeOnly: false },

  // ── World (все специализированные финансовые/товарные) ────────────────────
  { url: 'https://oilprice.com/rss/main',                           source: 'OilPrice.com',   category: 'world', financeOnly: true },
  { url: 'https://www.mining.com/feed/',                            source: 'Mining.com',     category: 'world', financeOnly: true },
  { url: 'https://financialpost.com/feed',                          source: 'Financial Post', category: 'world', financeOnly: true },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',   source: 'MarketWatch',    category: 'world', financeOnly: true },

  // ── World / Georgia ───────────────────────────────────────────────────────
  { url: 'https://civil.ge/feed', source: 'Civil.ge', category: 'world', financeOnly: false },

  // ── World / Turkey ────────────────────────────────────────────────────────
  { url: 'https://www.dailysabah.com/rss/economy',   source: 'Daily Sabah',  category: 'world', financeOnly: true  }, // экономический раздел
  { url: 'https://www.hurriyetdailynews.com/rss',    source: 'Hurriyet DN',  category: 'world', financeOnly: false },
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
// Убраны ловушки (доказано тест-скриптом):
//   'ставк'   → 'поставка', 'отставка'
//   'пенсион' → 'пенсионер'
//   'репо'    → 'крепость' ("крепости" содержит "репо")
//   'экспорт' → 'экспорт абрикосов' (слишком широкое, не банковская тема)
//   'импорт'  → аналогично
// Вместо голых стемов используются составные фразы.
const FINANCE_STEMS_RU = [
  // Институты и регуляторы
  'банк', 'нбт', 'нбрк', 'нацбанк', 'цб рф', 'минфин', 'набиуллин', 'мвф',
  'мировой банк', 'азиатский банк', 'центральный банк', 'народный банк',
  // Ставки — только полные фразы ('ставк' убран: 'поставка', 'отставка')
  'ключевая ставка', 'учётная ставка', 'базовая ставка', 'ставка рефинансирования',
  'инфляци', 'кредит', 'ипотек', 'рефинансирован', 'овернайт',
  // Рынки и инструменты
  'биржа', 'фондов', 'акци', 'облигац', 'дивиденд', 'листинг', 'эмитент',
  // 'репо' убран: 'крепость' содержит подстроку 'репо'
  'операции репо', 'сделки репо', 'рынок репо',
  'своп', 'форвард', 'деривати', 'межбанк',
  // Валюты и курсы (только специфичные составные формы)
  'валют', 'доллар', 'рубл', 'сомони', 'курс валют', 'курс доллар', 'курс рубл',
  // Макроэкономика
  'ввп', 'ликвидност', 'ликвидность', 'дефицит бюджет', 'профицит',
  'торговый баланс', 'платёжный баланс', 'текущий счёт',
  // Нефть/газ/золото
  'нефт', 'золот', 'биткоин',
  // Банковские операции
  'депозит', 'вклад', 'резерв', 'капитал', 'достаточност',
  'надзор', 'регулятор', 'нормативы', 'реструктуризац', 'банкрот',
  'пенсионный фонд', 'пенсионные накопления', 'пенсионная система',
  'микрофинанс',
  // Внешняя торговля — только специфичные ('экспорт'/'импорт' убраны: 'экспорт абрикосов')
  'торговый дефицит', 'торговый профицит', 'внешнеторгов',
  'пошлин', 'тариф', 'санкц', 'эмбарго', 'трансфер', 'ремитт',
  // Корпоративные финансы
  'прибыл', 'убыт', 'выручк', 'рентабельн', 'платёжеспособн',
  'ликвидац', 'эмисси', 'капитализац',
  // Общие финансовые
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

const FINANCE_EN_PATTERNS: { kw: string; re: RegExp }[] = FINANCE_WORDS_EN.map(kw => ({
  kw,
  re: new RegExp(
    `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`,
    'i'
  ),
}))

// Проверяет ТОЛЬКО заголовок (для общеновостных источников).
// Намеренно НЕ проверяет описание — там слишком много ложных срабатываний.
// Возвращает { pass, matchedBy } для детального логгинга.
function matchesFinanceTitle(title: string): { pass: boolean; matchedBy: string } {
  const t = title.toLowerCase()

  for (const e of NAMED_ENTITIES) {
    if (t.includes(e)) return { pass: true, matchedBy: `ENTITY:"${e}"` }
  }
  for (const kw of FINANCE_STEMS_RU) {
    if (t.includes(kw)) return { pass: true, matchedBy: `RU:"${kw}"` }
  }
  for (const { kw, re } of FINANCE_EN_PATTERNS) {
    if (re.test(t)) return { pass: true, matchedBy: `EN:"${kw}"` }
  }
  return { pass: false, matchedBy: '' }
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

          const rawDesc: string = (item as unknown as Record<string, unknown>).rawDesc as string || ''
          const descText = rawDesc
            ? rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 400)
            : (item.contentSnippet || '').slice(0, 400)

          const isCounterparty = matchesCounterparty(title) || matchesCounterparty(descText)

          // Для общеновостных источников — строгий фильтр по заголовку.
          // Для финансово-специализированных — пропускаем все статьи.
          // Контрагентные новости всегда проходят независимо от финансового фильтра.
          if (!financeOnly && !isCounterparty) {
            const { pass, matchedBy } = matchesFinanceTitle(title)
            console.log(`[NEWS] ${pass ? `PASS via ${matchedBy}` : 'SKIP            '} [${source}] ${title.slice(0, 90)}`)
            if (!pass) continue
          } else if (!financeOnly && isCounterparty) {
            console.log(`[NEWS] PASS via COUNTERPARTY [${source}] ${title.slice(0, 90)}`)
          }

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
            isCounterparty,
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

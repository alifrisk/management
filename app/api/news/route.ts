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

// ════════════════════════════════════════════════════════════════════════════════
// WHITELIST FILTER — строгий категориальный подход.
// Новость проходит только если явно относится к финансовой теме.
// Три уровня: (1) составные фразы → (2) безопасные стемы → (3) контекстные guards.
// ════════════════════════════════════════════════════════════════════════════════

// Уровень 1: Составные фразы — длинные, специфичные, практически без ложных срабатываний.
// Убраны одиночные стемы вызывавшие ложные совпадения:
//   'прибыл'  → «прибыли делегации», «прибыл в район»
//   'финанс'  → «финансирование армии», «финансирование мечети»
//   'акци'    → «акция протеста», «промоакция», «военная акция»
//   'санкц'   → «санкции в спорте», «санкция прокурора»
//   'золот'   → «золотые медали», «золото культурного наследия»
//   'трансфер'→ «трансфер игрока» (спорт)
//   'вклад'   → «вклад в науку», «личный вклад»
//   'капитал' → «капитальный ремонт»
//   'резерв'  → «природный резерват»
//   'убыт'    → «убыть на учения» (убыть = to depart)
//   'выручк'  → «друг выручил» vs «выручка»
//   'финанс'  → слишком широкое
const FINANCE_PHRASES_RU: string[] = [
  // ── Банковский сектор ──
  'центральный банк', 'народный банк', 'цб рф',
  'ключевая ставка', 'учётная ставка', 'базовая ставка', 'ставка рефинансирования',
  'кредитный рейтинг', 'кредитный портфель', 'кредитная линия', 'кредитный риск',
  'потребительский кредит', 'жилищный кредит', 'кредит банк', 'ипотечный кредит',
  'банковский вклад', 'срочный вклад', 'банковск',
  'лицензия банк', 'финансовый регулятор',
  'пенсионный фонд', 'пенсионные накопления', 'накопительная пенсия',
  // ── Валюта и курсы ──
  'курс доллара', 'курс евро', 'курс рубля', 'курс сомони', 'курс юаня',
  'обменный курс', 'курс валют', 'официальный курс',
  'валютный рынок', 'валютные резервы', 'валютный курс',
  'денежные переводы',
  // ── Макроэкономика ──
  'экономический рост', 'экономический спад', 'экономический кризис',
  'дефицит бюджета', 'профицит бюджета', 'доходы госбюджета', 'расходы госбюджета',
  'дефицит госбюджета', 'профицит госбюджета', 'государственный бюджет',
  'госдолг', 'государственный долг', 'внешний долг',
  'торговый баланс', 'платёжный баланс', 'торговый дефицит', 'торговый профицит',
  'денежно-кредитная', 'денежная масса',
  // ── Сырьевые рынки ──
  'цена золота', 'рынок золота', 'золотые резервы', 'золотодобыч', 'золотой запас',
  'цена нефти', 'нефтяной рынок', 'природный газ', 'газовый рынок',
  // ── Финансовые рынки ──
  'фондовый рынок', 'фондовая биржа',
  'ценные бумаги', 'эмиссия ценных бумаг',
  'первичное размещение',
  'операции репо', 'сделки репо', 'рынок репо',
  'рыночная капитализация', 'акционерный капитал',
  'акции компании', 'акции банка', 'рынок акций', 'стоимость акций',
  'акции выросли', 'акции упали', 'акции подорожали', 'акции снизились',
  'котировки акций', 'покупка акций', 'продажа акций',
  'хедж-фонд', 'паевой фонд', 'суверенный фонд',
  // ── Международные финансы ──
  'всемирный банк', 'азиатский банк развития', 'мировой банк',
  'финансовые санкции', 'экономические санкции', 'санкционный список',
  'торговые санкции', 'санкции против банк',
  'торговая война', 'внешняя торговля', 'внешнеторгов',
  // ── Геополитика и военно-экономические последствия ──
  'военный конфликт', 'вооружённый конфликт', 'вооруженный конфликт',
  'экономические последствия', 'экономический ущерб',
  'энергетическая безопасность', 'энергетический кризис',
  'геополитическ',
  'военные расходы', 'оборонные расходы', 'военный бюджет',
  // ── Корпоративные финансы ──
  'чистая прибыль', 'операционная прибыль', 'прибыль компании', 'прибыль банка',
  'прибыль выросла', 'прибыль снизилась', 'прибыль сократилась',
  'чистый убыток', 'убытки компании', 'убытки банка',
  'финансовые результаты', 'финансовая отчётность', 'годовой отчёт',
  'выручка компании', 'выручка банка', 'чистая выручка',
  'финансовый рынок', 'финансовый сектор', 'финансовые услуги', 'финансовая система',
  'денежный перевод',
  // ── Резервы ──
  'международные резервы', 'золотовалютные резервы',
]

// Уровень 2: Безопасные одиночные стемы — в качестве подстроки практически не дают ложных попаданий.
const FINANCE_SAFE_RU: string[] = [
  // Институты
  'нбт', 'нбрк', 'нацбанк', 'мвф', 'минфин', 'набиуллин', 'межбанк',
  // Банковские операции
  'банкрот', 'ипотек', 'депозит', 'овернайт', 'рефинансирован', 'микрофинанс',
  'ликвидност', 'достаточност', 'реструктуризац', 'капитализац',
  // Макро
  'ввп', 'инфляци', 'дефляц', 'стагфляц', 'рецессия', 'ремитт', 'профицит',
  // Валюта
  'девальвац', 'ревальвац', 'валют', 'доллар', 'рубл', 'сомони',
  // Рынки
  'биржа', 'облигаци', 'дивиденд', 'эмитент', 'листинг', 'деривати',
  'акционер', 'своп', 'форвард',
  // Сырьё
  'нефт', 'биткоин', 'крипто', 'ethereum', 'блокчейн', 'опек',
  // Корпоративные
  'рентабельн', 'платёжеспособн', 'страхован', 'перестрахован', 'брокер', 'ликвидац',
  // Торговля и геополитика
  'пошлин', 'тариф', 'эмбарго', 'инвестиц',
]

// Уровень 3а: Специальный regex для 'банк' с границей слова на кириллице.
// Не срабатывает на 'банкет' и 'банкнот'; срабатывает на банк/банки/банке/банков.
const BANK_RE = /(?<![а-яёА-ЯЁ])банк(?!ет|нот)/i

// Уровень 3б: Контекстные guards — стем проходит только при отсутствии слов-исключений.
const GUARDED_RU: { stem: string; excludeIf: string[] }[] = [
  // 'кредит доверия' — политическое клише, не банковская тема
  { stem: 'кредит', excludeIf: ['доверия', 'доверие'] },
  // 'санкц' — убран из safe-стемов из-за «санкций прокурора»/«спортивных санкций»
  // возвращён как guarded: блокируем нефинансовые контексты
  { stem: 'санкц', excludeIf: ['спорт', 'дисциплинар', 'прокурор', 'суд', 'судья', 'федераци', 'соревнован', 'атлет', 'допинг'] },
  // 'надзор' — пропускаем только финансовый/банковский надзор
  { stem: 'надзор', excludeIf: ['строительств', 'санитарн', 'пожарн', 'технич', 'земельн', 'градостроит'] },
]

// ── Английские ключевые слова с word-boundary ─────────────────────────────────
// Убраны 'bond' и 'yield' как одиночные (слишком широкие); составные формы сохранены.
const FINANCE_WORDS_EN: string[] = [
  'bank', 'banking', 'central bank', 'federal reserve', 'imf', 'world bank',
  'ecb', 'fed', 'opec', 'bis', 'wto', 'treasury',
  'finance', 'financial', 'fintech',
  'monetary', 'fiscal', 'credit', 'lending', 'loan', 'mortgage',
  'stock market', 'stock exchange', 'stock price', 'stock index',
  'bond market', 'bond yield', 'equity',
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
function matchesFinanceTitle(title: string): { pass: boolean; matchedBy: string } {
  const t = title.toLowerCase()

  // 1. Named entities
  for (const e of NAMED_ENTITIES) {
    if (t.includes(e)) return { pass: true, matchedBy: `ENTITY:"${e}"` }
  }
  // 2. Compound phrases (длинные → почти нет ложных срабатываний)
  for (const phrase of FINANCE_PHRASES_RU) {
    if (t.includes(phrase)) return { pass: true, matchedBy: `RU_PHRASE:"${phrase}"` }
  }
  // 3. Safe standalone stems
  for (const stem of FINANCE_SAFE_RU) {
    if (t.includes(stem)) return { pass: true, matchedBy: `RU_STEM:"${stem}"` }
  }
  // 4. 'банк' с кириллийской границей слова (не банкет, не банкнот)
  if (BANK_RE.test(t)) return { pass: true, matchedBy: 'RU_WORD:банк' }
  // 5. Context-guarded stems
  for (const { stem, excludeIf } of GUARDED_RU) {
    if (t.includes(stem) && !excludeIf.some(ex => t.includes(ex))) {
      return { pass: true, matchedBy: `RU_GUARD:"${stem}"` }
    }
  }
  // 6. English patterns
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

  // Балансировка: не более 2 новостей подряд от одного источника.
  // Смотрим на последние 2 уже добавленных — если оба от того же источника, откладываем.
  // Отложенные добавляются в конец (не выбрасываются, просто не в топе).
  const MAX_CONSECUTIVE = 2
  const balanced: NewsItem[] = []
  const deferred: NewsItem[] = []

  for (const item of deduped) {
    const tail = balanced.slice(-MAX_CONSECUTIVE)
    const streak = tail.length === MAX_CONSECUTIVE && tail.every(i => i.source === item.source)
    if (streak) {
      deferred.push(item)
    } else {
      balanced.push(item)
    }
  }
  balanced.push(...deferred)

  const items = balanced.slice(0, 50)
  cache = { items, ts: Date.now() }

  return NextResponse.json(items)
}

import { NextResponse } from 'next/server'

interface Indicator {
  id: string
  label: string
  rate: number | null
  change: number | null
  unit: string
  year?: string
}

async function safeGet(url: string): Promise<unknown> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    const trimmed = text.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

async function fetchCurrencies(): Promise<Indicator[]> {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const d1 = await safeGet(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/usd.json`)
  const d2 = await safeGet(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yesterday}/v1/currencies/usd.json`)

  const cur  = (d1 && typeof d1 === 'object' && 'usd' in d1 ? (d1 as Record<string,Record<string,number>>).usd : {})
  const prev = (d2 && typeof d2 === 'object' && 'usd' in d2 ? (d2 as Record<string,Record<string,number>>).usd : {})

  const pair = (code: string, label: string): Indicator => {
    const rate   = cur[code]  != null ? Math.round(Number(cur[code])  * 10000) / 10000 : null
    const pRate  = prev[code] != null ? Math.round(Number(prev[code]) * 10000) / 10000 : null
    const change = rate && pRate ? Math.round((rate - pRate) / pRate * 10000) / 100 : null
    return { id: `usd_${code}`, label, rate, change, unit: code.toUpperCase() }
  }

  return [
    pair('tjs', 'USD / TJS'),
    pair('rub', 'USD / RUB'),
    pair('eur', 'USD / EUR'),
    pair('kzt', 'USD / KZT'),
    pair('uzs', 'USD / UZS'),
  ]
}

async function fetchCrypto(): Promise<Indicator[]> {
  const data = await safeGet(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  )
  if (!data || typeof data !== 'object') return []

  const d = data as Record<string, Record<string, number>>
  const result: Indicator[] = []

  if (d.bitcoin && d.bitcoin.usd) {
    result.push({
      id: 'btc', label: 'Bitcoin (BTC)',
      rate: d.bitcoin.usd,
      change: d.bitcoin.usd_24h_change != null ? Math.round(d.bitcoin.usd_24h_change * 100) / 100 : null,
      unit: 'USD',
    })
  }
  if (d.ethereum && d.ethereum.usd) {
    result.push({
      id: 'eth', label: 'Ethereum (ETH)',
      rate: d.ethereum.usd,
      change: d.ethereum.usd_24h_change != null ? Math.round(d.ethereum.usd_24h_change * 100) / 100 : null,
      unit: 'USD',
    })
  }
  return result
}

async function fetchCommodities(): Promise<Indicator[]> {
  const tickers = [
    { id: 'gold',   label: 'Золото (XAU)',  symbol: 'GC=F', unit: 'USD/oz'  },
    { id: 'silver', label: 'Серебро (XAG)', symbol: 'SI=F', unit: 'USD/oz'  },
    { id: 'oil',    label: 'Нефть Brent',   symbol: 'BZ=F', unit: 'USD/bbl' },
  ]

  const results: Indicator[] = []

  for (const t of tickers) {
    const data = await safeGet(
      `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=5d`
    )
    try {
      if (!data || typeof data !== 'object') continue
      const d        = data as Record<string, unknown>
      const chart    = d.chart as Record<string, unknown>
      const resArr   = chart.result as Record<string, unknown>[]
      const item     = resArr[0]
      const meta     = item.meta as Record<string, unknown>
      const indic    = item.indicators as Record<string, unknown>
      const quote    = (indic.quote as Record<string, unknown>[])[0]
      const closes   = quote.close as number[]

      const current  = (meta.regularMarketPrice as number) || (closes.length > 0 ? closes[closes.length - 1] : 0)
      const previous = closes.length > 1 ? closes[closes.length - 2] : (meta.previousClose as number)
      const change   = current && previous ? Math.round((current - previous) / previous * 10000) / 100 : null

      if (current) {
        results.push({ id: t.id, label: t.label, rate: Math.round(current * 100) / 100, change, unit: t.unit })
      }
    } catch {
      continue
    }
  }
  return results
}

async function fetchMacro(): Promise<Indicator[]> {
  const wbList = [
    { id: 'inflation',   label: 'Инфляция РТ',               code: 'FP.CPI.TOTL.ZG',       unit: '%'        },
    { id: 'gdp_growth',  label: 'Рост ВВП РТ',               code: 'NY.GDP.MKTP.KD.ZG',     unit: '%'        },
    { id: 'remittances', label: 'Переводы в РТ (% ВВП)',      code: 'BX.TRF.PWKR.DT.GD.ZS', unit: '% ВВП'    },
    { id: 'gdp_usd',     label: 'ВВП Таджикистана',           code: 'NY.GDP.MKTP.CD',        unit: 'млрд USD' },
  ]

  const results: Indicator[] = []

  for (const ind of wbList) {
    const data = await safeGet(
      `https://api.worldbank.org/v2/country/TJ/indicator/${ind.code}?format=json&mrv=2&per_page=2`
    )
    try {
      if (!Array.isArray(data) || data.length < 2) continue
      const entries = data[1] as { value: number | null; date: string }[]
      const latest  = entries.find(e => e.value != null)
      if (!latest || latest.value == null) continue
      const prev    = entries.find(e => e.date < latest.date && e.value != null)
      const change  = prev && prev.value != null ? Math.round((latest.value - prev.value) * 100) / 100 : null
      const rate    = ind.unit === 'млрд USD'
        ? Math.round(latest.value / 1e9 * 10) / 10
        : Math.round(latest.value * 100) / 100
      results.push({ id: ind.id, label: ind.label, rate, change, unit: ind.unit, year: latest.date })
    } catch {
      continue
    }
  }

  results.push({ id: 'nbt_rate',   label: 'Ключевая ставка НБТ',  rate: 9.0, change: null, unit: '%', year: '2025' })
  results.push({ id: 'nbt_target', label: 'Цель по инфляции НБТ', rate: 5.0, change: null, unit: '%', year: '2025' })

  return results
}

export async function GET() {
  try {
    const [r1, r2, r3, r4] = await Promise.allSettled([
      fetchCurrencies(),
      fetchCrypto(),
      fetchCommodities(),
      fetchMacro(),
    ])

    return NextResponse.json({
      updatedAt:   new Date().toISOString(),
      currencies:  r1.status === 'fulfilled' ? r1.value : [],
      crypto:      r2.status === 'fulfilled' ? r2.value : [],
      commodities: r3.status === 'fulfilled' ? r3.value : [],
      macro:       r4.status === 'fulfilled' ? r4.value : [],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

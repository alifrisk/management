import { NextResponse } from 'next/server'

async function safeGet(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function GET() {
  const results = await Promise.allSettled([
    fetchCurrencies(),
    fetchCrypto(),
    fetchCommodities(),
  ])

  const [cur, cry, com] = results.map(r => r.status === 'fulfilled' ? r.value : [])

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    currencies:  cur  || [],
    crypto:      cry  || [],
    commodities: com  || [],
  })
}

async function fetchCurrencies() {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const [today_data, prev_data] = await Promise.all([
    safeGet(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/usd.json`),
    safeGet(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yesterday}/v1/currencies/usd.json`),
  ])

  const cur  = (today_data as Record<string,unknown>)?.usd as Record<string,number> || {}
  const prev = (prev_data  as Record<string,unknown>)?.usd as Record<string,number> || {}

  const pair = (code: string, label: string) => {
    const rate   = cur[code]   ? +Number(cur[code]).toFixed(4)   : null
    const pRate  = prev[code]  ? +Number(prev[code]).toFixed(4)  : null
    const change = rate && pRate ? +((rate - pRate) / pRate * 100).toFixed(2) : null
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

async function fetchCrypto() {
  const data = await safeGet(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  ) as Record<string, { usd: number; usd_24h_change: number }> | null

  if (!data) return []

  const result = []
  if (data.bitcoin?.usd) result.push({
    id: 'btc', label: 'Bitcoin (BTC)',
    rate: data.bitcoin.usd,
    change: data.bitcoin.usd_24h_change ? +data.bitcoin.usd_24h_change.toFixed(2) : null,
    unit: 'USD',
  })
  if (data.ethereum?.usd) result.push({
    id: 'eth', label: 'Ethereum (ETH)',
    rate: data.ethereum.usd,
    change: data.ethereum.usd_24h_change ? +data.ethereum.usd_24h_change.toFixed(2) : null,
    unit: 'USD',
  })
  return result
}

async function fetchCommodities() {
  const tickers = [
    { id: 'gold',   label: 'Золото (XAU)',  symbol: 'GC=F',  unit: 'USD/oz'   },
    { id: 'silver', label: 'Серебро (XAG)', symbol: 'SI=F',  unit: 'USD/oz'   },
    { id: 'oil',    label: 'Нефть Brent',   symbol: 'BZ=F',  unit: 'USD/bbl'  },
  ]

  const results = await Promise.all(tickers.map(async t => {
    const data = await safeGet(
      `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=5d`
    ) as Record<string, unknown> | null

    try {
      const result = (data as Record<string,unknown>)?.chart as Record<string,unknown>
      const item   = (result?.result as unknown[])?.[0] as Record<string,unknown>
      const meta   = item?.meta as Record<string,unknown>
      const closes = ((item?.indicators as Record<string,unknown>)?.quote as Record<string,unknown>[])?.[0]?.close as number[]

      const current  = meta?.regularMarketPrice as number || closes?.[closes.length - 1]
      const previous = closes?.[closes.length - 2] || meta?.previousClose as number
      const change   = current && previous ? +((current - previous) / previous * 100).toFixed(2) : null

      if (!current) return null
      return { id: t.id, label: t.label, rate: +current.toFixed(2), change, unit: t.unit }
    } catch {
      return null
    }
  }))

  return results.filter(Boolean)
}

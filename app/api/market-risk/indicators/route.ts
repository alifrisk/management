import { NextResponse } from 'next/server'
import { createServerClient } from '@/supabase/server'

export const dynamic = 'force-dynamic'

async function get(url: string, ms = 2500): Promise<unknown> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    clearTimeout(t)
    const txt = await res.text()
    if (!txt.startsWith('{') && !txt.startsWith('[')) return null
    return JSON.parse(txt)
  } catch { return null }
}

function dateStr(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0]
}

// Tries Cloudflare Pages mirror + jsdelivr CDN in parallel; returns USD-keyed dict
async function getFWRates(daysAgo: number): Promise<Record<string, number>> {
  type FW = Record<string, Record<string, number>>
  const d = daysAgo === 0 ? 'latest' : dateStr(daysAgo)
  const [cf, js] = await Promise.all([
    get(`https://${d}.currency-api.pages.dev/v1/currencies/usd.json`),
    get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/usd.json`),
  ])
  return (cf as FW)?.usd ?? (js as FW)?.usd ?? {}
}

// Returns the nearest 2 quarterly Urals contract tickers (H=Mar, M=Jun, U=Sep, Z=Dec)
function nearUralsContracts(): string[] {
  const quarters = [
    { month: 2, code: 'H' }, { month: 5, code: 'M' },
    { month: 8, code: 'U' }, { month: 11, code: 'Z' },
  ]
  const now = new Date()
  const result: string[] = []
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1 && result.length < 2; y++) {
    for (const q of quarters) {
      if (result.length >= 2) break
      if (y > now.getFullYear() || q.month >= now.getMonth()) {
        result.push(`UR${q.code}${String(y).slice(-1)}`)
      }
    }
  }
  return result
}

// Urals crude oil from MOEX ISS (free, no key) — USD/bbl
// Hard 3 s cap so a slow/blocked MOEX never stalls the whole route
async function getUralsFromMOEX(): Promise<{ rate: number | null; change: number | null; change7d: number | null }> {
  const NULL_R = { rate: null, change: null, change7d: null }

  const doFetch = async () => {
    const d7 = dateStr(7)
    const candidates = nearUralsContracts()   // max 2 tickers
    type Sec = { columns: string[]; data: (number | null)[][] }

    const results = await Promise.all(candidates.map(async secid => {
      const base = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${secid}`
      const [today, hist] = await Promise.all([
        get(`${base}.json?iss.meta=off&marketdata.columns=LAST,OPEN`, 2000),
        get(`${base}/candles.json?from=${d7}&till=${d7}&interval=24&iss.meta=off&candles.columns=close`, 2000),
      ])
      return { today, hist }
    }))

    for (const { today, hist } of results) {
      if (!today) continue
      const md = (today as Record<string, Sec>)?.marketdata
      if (!md?.data?.[0]) continue
      const last = md.data[0][md.columns.indexOf('LAST')]
      const open = md.data[0][md.columns.indexOf('OPEN')]
      if (!last || last <= 0) continue

      const change = open && open > 0 ? Math.round((last - open) / open * 10000) / 100 : null
      let change7d: number | null = null
      if (hist) {
        const cv = (hist as Record<string, Sec>)?.candles
        const c7 = cv?.data?.[0]?.[cv.columns.indexOf('close')] ?? null
        if (c7 && c7 > 0) change7d = Math.round((last - c7) / c7 * 10000) / 100
      }
      return { rate: Math.round(last * 100) / 100, change, change7d }
    }
    return NULL_R
  }

  // Never wait more than 3 s for MOEX
  return Promise.race([
    doFetch(),
    new Promise<typeof NULL_R>(resolve => setTimeout(() => resolve(NULL_R), 3000)),
  ])
}

export async function GET() {
  try {
    const syms = [
      { id:'gold',   label:'Золото (XAU)',    s:'GC=F', u:'USD/oz'  },
      { id:'silver', label:'Серебро (XAG)',   s:'SI=F', u:'USD/oz'  },
      { id:'brent',  label:'Нефть Brent',     s:'BZ=F', u:'USD/bbl' },
      { id:'wti',    label:'Нефть WTI',       s:'CL=F', u:'USD/bbl' },
    ]

    // All sources run in parallel
    const [[fw0, fw1, fw7], [erApi, cg], uralsData, yahooResults] = await Promise.all([
      Promise.all([getFWRates(0), getFWRates(1), getFWRates(7)]),
      Promise.all([
        get('https://open.er-api.com/v6/latest/USD'),
        get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=7d'),
      ]),
      getUralsFromMOEX(),
      Promise.all(syms.map(t => get(`https://query1.finance.yahoo.com/v8/finance/chart/${t.s}?interval=1d&range=30d`))),
    ])

    // ── Currencies ──────────────────────────────────────────────────────────
    const erRates = ((erApi as Record<string, unknown>)?.rates ?? {}) as Record<string, number>
    const erLower = Object.fromEntries(Object.entries(erRates).map(([k, v]) => [k.toLowerCase(), v]))
    const cur: Record<string, number> = { ...erLower, ...fw0 }
    const p1 = fw1
    const p7 = fw7

    const chg = (a: number, b: number) => b ? Math.round((a-b)/b*10000)/100 : null

    const pair = (code: string, label: string) => ({
      id: `usd_${code}`, label,
      rate:     cur[code] != null ? Math.round(Number(cur[code]) * 10000) / 10000 : null,
      change:   cur[code] && p1[code] ? chg(cur[code], p1[code]) : null,
      change7d: cur[code] && p7[code] ? chg(cur[code], p7[code]) : null,
      unit: code.toUpperCase(),
    })

    const cross = (xCode: string, label: string, decimals = 4) => {
      const rate = cur['tjs'] && cur[xCode] ? Math.round(cur['tjs'] / cur[xCode] * Math.pow(10, decimals)) / Math.pow(10, decimals) : null
      const r1   = p1['tjs'] && p1[xCode] ? p1['tjs'] / p1[xCode] : null
      const r7   = p7['tjs'] && p7[xCode] ? p7['tjs'] / p7[xCode] : null
      return {
        id: `${xCode}_tjs`, label, rate,
        change:   rate && r1 ? chg(rate, r1) : null,
        change7d: rate && r7 ? chg(rate, r7) : null,
        unit: 'TJS',
      }
    }

    const currencies = [
      pair('tjs','USD / TJS'), pair('rub','USD / RUB'), pair('eur','USD / EUR'),
      pair('cny','USD / CNY'), pair('aed','USD / AED'), pair('kzt','USD / KZT'),
      cross('rub','RUB / TJS', 4),
      cross('eur','EUR / TJS', 2),
      cross('cny','CNY / TJS', 4),
    ]

    // ── Crypto ──────────────────────────────────────────────────────────────
    const cgArr = Array.isArray(cg) ? (cg as Record<string, number>[]) : []
    const cgMap = Object.fromEntries(cgArr.map(c => [c.id, c]))
    const crypto = [
      cgMap.bitcoin  && { id:'btc', label:'Bitcoin (BTC)',  rate: cgMap.bitcoin.current_price,  change: cgMap.bitcoin.price_change_percentage_24h   != null ? Math.round(cgMap.bitcoin.price_change_percentage_24h*100)/100   : null, change7d: cgMap.bitcoin.price_change_percentage_7d_in_currency  != null ? Math.round(cgMap.bitcoin.price_change_percentage_7d_in_currency*100)/100  : null, unit:'USD' },
      cgMap.ethereum && { id:'eth', label:'Ethereum (ETH)', rate: cgMap.ethereum.current_price, change: cgMap.ethereum.price_change_percentage_24h  != null ? Math.round(cgMap.ethereum.price_change_percentage_24h*100)/100  : null, change7d: cgMap.ethereum.price_change_percentage_7d_in_currency != null ? Math.round(cgMap.ethereum.price_change_percentage_7d_in_currency*100)/100 : null, unit:'USD' },
    ].filter(Boolean)

    // ── Commodities ─────────────────────────────────────────────────────────
    const yahooMapped = yahooResults.map((d, i) => {
      try {
        const r0         = ((d as Record<string,unknown>)?.chart as Record<string,unknown>)?.result as Record<string,unknown>[]
        const meta       = r0[0].meta as Record<string,number>
        const quote      = (r0[0].indicators as Record<string,unknown[]>)?.quote[0] as Record<string,number[]>
        const cls        = quote?.close ?? []
        const timestamps = (r0[0].timestamp as number[]) ?? []
        const cur2       = meta.regularMarketPrice || (cls.length > 0 ? cls[cls.length-1] : 0)
        const prv        = cls.length > 1 ? cls[cls.length-2] : meta.previousClose
        if (!cur2) return null

        let change7d: number | null = null
        const ts7 = Date.now() / 1000 - 7 * 86400
        if (timestamps.length > 0 && cls.length > 0) {
          let bestIdx = 0, bestDiff = Math.abs(timestamps[0] - ts7)
          for (let j = 1; j < timestamps.length; j++) {
            const diff = Math.abs(timestamps[j] - ts7)
            if (diff < bestDiff) { bestDiff = diff; bestIdx = j }
          }
          const prv7 = cls[bestIdx]
          if (prv7) change7d = Math.round((cur2 - prv7) / prv7 * 10000) / 100
        }

        return { id: syms[i].id, label: syms[i].label, rate: Math.round(cur2*100)/100, change: prv ? Math.round((cur2-prv)/prv*10000)/100 : null, change7d, unit: syms[i].u }
      } catch { return null }
    }).filter(Boolean)

    const uralsItem = uralsData.rate !== null
      ? { id: 'urals', label: 'Нефть Urals', rate: uralsData.rate, change: uralsData.change, change7d: uralsData.change7d, unit: 'USD/bbl' }
      : null
    const commodities = [
      ...yahooMapped.slice(0, 3),
      uralsItem,
      ...yahooMapped.slice(3),
    ].filter(Boolean)

    // ── Macro ────────────────────────────────────────────────────────────────
    const MACRO_FALLBACK = [
      { id:'nbt_key',    label:'Ставка рефинансирования НБТ', rate: 7.0, change: null, unit:'%', year:'с 02.02.2026' },
      { id:'nbt_ann',    label:'Годовая инфляция',            rate: null, change: null, unit:'%', year:'' },
      { id:'nbt_mon',    label:'Инфляция (MoM)',              rate: null, change: null, unit:'%', year:'' },
      { id:'nbt_target', label:'Целевой показатель (±2%)',    rate: 6.0,  change: null, unit:'%', year:'2026' },
    ]
    let macro = MACRO_FALLBACK
    try {
      const sb = createServerClient()
      const { data } = await sb.from('nbt_indicators').select('*').order('sort_order', { ascending: true })
      if (data && data.length > 0) macro = data
    } catch { /* fallback */ }

    return NextResponse.json({ updatedAt: new Date().toISOString(), currencies, crypto, commodities, macro })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

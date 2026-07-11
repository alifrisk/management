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

type UralsResult = {
  rate: number | null
  change: number | null
  change7d: number | null
  changeMtM: number | null
  changeYtY: number | null
}

// Urals crude oil from MOEX ISS (free, no key) — USD/bbl
async function getUralsFromMOEX(): Promise<UralsResult> {
  const NULL_R: UralsResult = { rate: null, change: null, change7d: null, changeMtM: null, changeYtY: null }

  const doFetch = async (): Promise<UralsResult> => {
    const d7   = dateStr(7)
    const d30  = dateStr(30)
    const d365 = dateStr(365)
    const candidates = nearUralsContracts()
    type Sec = { columns: string[]; data: (number | null)[][] }

    const results = await Promise.all(candidates.map(async secid => {
      const base = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${secid}`
      const [today, hist7, hist30, hist365] = await Promise.all([
        get(`${base}.json?iss.meta=off&marketdata.columns=LAST,OPEN`, 2000),
        get(`${base}/candles.json?from=${d7}&till=${d7}&interval=24&iss.meta=off&candles.columns=close`, 2000),
        get(`${base}/candles.json?from=${d30}&till=${d30}&interval=24&iss.meta=off&candles.columns=close`, 2000),
        get(`${base}/candles.json?from=${d365}&till=${d365}&interval=24&iss.meta=off&candles.columns=close`, 2000),
      ])
      return { today, hist7, hist30, hist365 }
    }))

    const candleClose = (hist: unknown): number | null => {
      if (!hist) return null
      const cv = (hist as Record<string, Sec>)?.candles
      const c = cv?.data?.[0]?.[cv.columns.indexOf('close')] ?? null
      return (c && c > 0) ? c as number : null
    }

    for (const { today, hist7, hist30, hist365 } of results) {
      if (!today) continue
      const md = (today as Record<string, Sec>)?.marketdata
      if (!md?.data?.[0]) continue
      const last = md.data[0][md.columns.indexOf('LAST')]
      const open = md.data[0][md.columns.indexOf('OPEN')]
      if (!last || last <= 0) continue

      const change    = open && open > 0 ? Math.round((last - open) / open * 10000) / 100 : null
      const c7        = candleClose(hist7)
      const c30       = candleClose(hist30)
      const c365      = candleClose(hist365)
      const change7d  = c7   ? Math.round((last - c7)   / c7   * 10000) / 100 : null
      const changeMtM = c30  ? Math.round((last - c30)  / c30  * 10000) / 100 : null
      const changeYtY = c365 ? Math.round((last - c365) / c365 * 10000) / 100 : null

      return { rate: Math.round(last * 100) / 100, change, change7d, changeMtM, changeYtY }
    }
    return NULL_R
  }

  return Promise.race([
    doFetch(),
    new Promise<UralsResult>(resolve => setTimeout(() => resolve(NULL_R), 3000)),
  ])
}

export async function GET() {
  try {
    const syms = [
      { id:'gold',   label:'Золото (XAU)',  s:'GC=F', u:'USD/oz'  },
      { id:'silver', label:'Серебро (XAG)', s:'SI=F', u:'USD/oz'  },
      { id:'brent',  label:'Нефть Brent',   s:'BZ=F', u:'USD/bbl' },
      { id:'wti',    label:'Нефть WTI',     s:'CL=F', u:'USD/bbl' },
    ]

    // All sources run in parallel
    const [[fw0, fw1, fw7, fw30, fw365], [erApi, cg], uralsData, yahooResults] = await Promise.all([
      Promise.all([
        getFWRates(0), getFWRates(1), getFWRates(7), getFWRates(30), getFWRates(365),
      ]),
      Promise.all([
        get('https://open.er-api.com/v6/latest/USD'),
        // 30d and 1y natively supported by CoinGecko — no extra request
        get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=7d,30d,1y'),
      ]),
      getUralsFromMOEX(),
      // range=1y gives ~252 trading days — enough for both 30d and 365d lookbacks
      Promise.all(syms.map(t => get(`https://query1.finance.yahoo.com/v8/finance/chart/${t.s}?interval=1d&range=1y`))),
    ])

    // ── Currencies ──────────────────────────────────────────────────────────
    const erRates = ((erApi as Record<string, unknown>)?.rates ?? {}) as Record<string, number>
    const erLower = Object.fromEntries(Object.entries(erRates).map(([k, v]) => [k.toLowerCase(), v]))
    const cur: Record<string, number> = { ...erLower, ...fw0 }

    const chg = (a: number, b: number) => b ? Math.round((a - b) / b * 10000) / 100 : null

    const pair = (code: string, label: string) => ({
      id: `usd_${code}`, label,
      rate:      cur[code] != null ? Math.round(Number(cur[code]) * 10000) / 10000 : null,
      change:    cur[code] && fw1[code]   ? chg(cur[code], fw1[code])   : null,
      change7d:  cur[code] && fw7[code]   ? chg(cur[code], fw7[code])   : null,
      changeMtM: cur[code] && fw30[code]  ? chg(cur[code], fw30[code])  : null,
      changeYtY: cur[code] && fw365[code] ? chg(cur[code], fw365[code]) : null,
      unit: code.toUpperCase(),
    })

    const cross = (xCode: string, label: string, decimals = 4) => {
      const pow  = Math.pow(10, decimals)
      const rate = cur['tjs'] && cur[xCode]   ? Math.round(cur['tjs']   / cur[xCode]   * pow) / pow : null
      const r1   = fw1['tjs'] && fw1[xCode]   ? fw1['tjs']   / fw1[xCode]   : null
      const r7   = fw7['tjs'] && fw7[xCode]   ? fw7['tjs']   / fw7[xCode]   : null
      const r30  = fw30['tjs'] && fw30[xCode] ? fw30['tjs']  / fw30[xCode]  : null
      const r365 = fw365['tjs'] && fw365[xCode] ? fw365['tjs'] / fw365[xCode] : null
      return {
        id: `${xCode}_tjs`, label, rate,
        change:    rate && r1   ? chg(rate, r1)   : null,
        change7d:  rate && r7   ? chg(rate, r7)   : null,
        changeMtM: rate && r30  ? chg(rate, r30)  : null,
        changeYtY: rate && r365 ? chg(rate, r365) : null,
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

    const cgItem = (id: string, label: string, unit: string) => {
      const c = cgMap[id]
      if (!c) return null
      const p = (field: string) => c[field] != null ? Math.round(c[field] * 100) / 100 : null
      return {
        id, label, unit,
        rate:      c.current_price,
        change:    p('price_change_percentage_24h'),
        change7d:  p('price_change_percentage_7d_in_currency'),
        changeMtM: p('price_change_percentage_30d_in_currency'),
        changeYtY: p('price_change_percentage_1y_in_currency'),
      }
    }

    const crypto = [
      cgItem('bitcoin',  'Bitcoin (BTC)',  'USD'),
      cgItem('ethereum', 'Ethereum (ETH)', 'USD'),
    ].filter(Boolean)

    // ── Commodities ─────────────────────────────────────────────────────────
    const findNearest = (timestamps: number[], cls: number[], daysAgo: number): number | null => {
      if (!timestamps.length || !cls.length) return null
      const target = Date.now() / 1000 - daysAgo * 86400
      let bestIdx = 0, bestDiff = Math.abs(timestamps[0] - target)
      for (let j = 1; j < timestamps.length; j++) {
        const diff = Math.abs(timestamps[j] - target)
        if (diff < bestDiff) { bestDiff = diff; bestIdx = j }
      }
      return cls[bestIdx] ?? null
    }

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

        const prv7   = findNearest(timestamps, cls, 7)
        const prv30  = findNearest(timestamps, cls, 30)
        const prv365 = findNearest(timestamps, cls, 365)

        return {
          id:        syms[i].id,
          label:     syms[i].label,
          unit:      syms[i].u,
          rate:      Math.round(cur2 * 100) / 100,
          change:    prv   ? Math.round((cur2 - prv)   / prv   * 10000) / 100 : null,
          change7d:  prv7  ? Math.round((cur2 - prv7)  / prv7  * 10000) / 100 : null,
          changeMtM: prv30 ? Math.round((cur2 - prv30) / prv30 * 10000) / 100 : null,
          changeYtY: prv365 ? Math.round((cur2 - prv365) / prv365 * 10000) / 100 : null,
        }
      } catch { return null }
    }).filter(Boolean)

    // Urals discount to Brent — historically $1-3 pre-2022, $10-20 post-sanctions.
    const URALS_DISCOUNT = 15
    const brentYahoo = yahooMapped.find(c => c?.id === 'brent') ?? null

    const uralsItem = (() => {
      if (uralsData.rate !== null) {
        return {
          id: 'urals', label: 'Нефть Urals', unit: 'USD/bbl', source: 'MOEX',
          rate:      uralsData.rate,
          change:    uralsData.change,
          change7d:  uralsData.change7d,
          changeMtM: uralsData.changeMtM,
          changeYtY: uralsData.changeYtY,
        }
      }
      if (brentYahoo?.rate != null) {
        return {
          id: 'urals', label: 'Нефть Urals', unit: 'USD/bbl', source: 'est',
          rate:      Math.round((brentYahoo.rate - URALS_DISCOUNT) * 100) / 100,
          change:    brentYahoo.change,
          change7d:  brentYahoo.change7d,
          changeMtM: brentYahoo.changeMtM,
          changeYtY: brentYahoo.changeYtY,
        }
      }
      return null
    })()

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

import { NextResponse } from 'next/server'
import { createServerClient } from '@/supabase/server'

export const dynamic = 'force-dynamic'

async function get(url: string): Promise<unknown> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
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

export async function GET() {
  try {
    // ── Все запросы параллельно ─────────────────────────────────────────────
    const syms = [
      { id:'gold',   label:'Золото (XAU)',    s:'GC=F', u:'USD/oz'  },
      { id:'silver', label:'Серебро (XAG)',   s:'SI=F', u:'USD/oz'  },
      { id:'brent',  label:'Нефть Brent',     s:'BZ=F', u:'USD/bbl' },
      { id:'wti',    label:'Нефть WTI',       s:'CL=F', u:'USD/bbl' },
    ]

    const [fw0, fw1, fw7, erApi, cg, ...yahooResults] = await Promise.all([
      getFWRates(0),
      getFWRates(1),
      getFWRates(7),
      // open.er-api — free, no key, direct USD-base rates; fallback for any missing pairs
      get('https://open.er-api.com/v6/latest/USD'),
      get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=7d'),
      ...syms.map(t => get(`https://query1.finance.yahoo.com/v8/finance/chart/${t.s}?interval=1d&range=30d`)),
    ])

    // ── Currencies ──────────────────────────────────────────────────────────
    // open.er-api uses uppercase keys; normalise to lowercase
    const erRates = ((erApi as Record<string, unknown>)?.rates ?? {}) as Record<string, number>
    const erLower = Object.fromEntries(Object.entries(erRates).map(([k, v]) => [k.toLowerCase(), v]))
    // fawazahmed0 takes precedence; open.er-api fills any gaps
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
    const currencies = [
      pair('tjs','USD / TJS'), pair('rub','USD / RUB'), pair('eur','USD / EUR'),
      pair('cny','USD / CNY'), pair('aed','USD / AED'), pair('kzt','USD / KZT'),
    ]

    // ── Crypto ──────────────────────────────────────────────────────────────
    const cgArr = Array.isArray(cg) ? (cg as Record<string, number>[]) : []
    const cgMap = Object.fromEntries(cgArr.map(c => [c.id, c]))
    const crypto = [
      cgMap.bitcoin  && { id:'btc', label:'Bitcoin (BTC)',  rate: cgMap.bitcoin.current_price,  change: cgMap.bitcoin.price_change_percentage_24h   != null ? Math.round(cgMap.bitcoin.price_change_percentage_24h*100)/100   : null, change7d: cgMap.bitcoin.price_change_percentage_7d_in_currency  != null ? Math.round(cgMap.bitcoin.price_change_percentage_7d_in_currency*100)/100  : null, unit:'USD' },
      cgMap.ethereum && { id:'eth', label:'Ethereum (ETH)', rate: cgMap.ethereum.current_price, change: cgMap.ethereum.price_change_percentage_24h  != null ? Math.round(cgMap.ethereum.price_change_percentage_24h*100)/100  : null, change7d: cgMap.ethereum.price_change_percentage_7d_in_currency != null ? Math.round(cgMap.ethereum.price_change_percentage_7d_in_currency*100)/100 : null, unit:'USD' },
    ].filter(Boolean)

    // ── Commodities ─────────────────────────────────────────────────────────
    const commodities = yahooResults.map((d, i) => {
      try {
        const r0         = ((d as Record<string,unknown>)?.chart as Record<string,unknown>)?.result as Record<string,unknown>[]
        const meta       = r0[0].meta as Record<string,number>
        const quote      = (r0[0].indicators as Record<string,unknown[]>)?.quote[0] as Record<string,number[]>
        const cls        = quote?.close ?? []
        const timestamps = (r0[0].timestamp as number[]) ?? []
        const cur2       = meta.regularMarketPrice || (cls.length > 0 ? cls[cls.length-1] : 0)
        const prv        = cls.length > 1 ? cls[cls.length-2] : meta.previousClose
        if (!cur2) return null

        // find close price closest to 7 calendar days ago
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

    // ── Macro (from Supabase, editable by admin) ────────────────────────────
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
    } catch { /* fallback to static */ }

    return NextResponse.json({ updatedAt: new Date().toISOString(), currencies, crypto, commodities, macro })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

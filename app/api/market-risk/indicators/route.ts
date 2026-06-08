import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function get(url: string): Promise<unknown> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    clearTimeout(t)
    const txt = await res.text()
    if (!txt.startsWith('{') && !txt.startsWith('[')) return null
    return JSON.parse(txt)
  } catch {
    return null
  }
}

function dateStr(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0]
}

export async function GET() {
  try {
    // ── Currencies ─────────────────────────────────────────────────────────
    const [dToday, d1, d7] = await Promise.all([
      get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr(0)}/v1/currencies/usd.json`),
      get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr(1)}/v1/currencies/usd.json`),
      get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr(7)}/v1/currencies/usd.json`),
    ])

    type R = Record<string, number>
    const cur = ((dToday as Record<string,R>)?.usd) ?? {}
    const p1  = ((d1     as Record<string,R>)?.usd) ?? {}
    const p7  = ((d7     as Record<string,R>)?.usd) ?? {}

    const chg = (a: number, b: number) => b ? Math.round((a-b)/b*10000)/100 : null
    const pair = (code: string, label: string) => ({
      id: `usd_${code}`, label,
      rate:     cur[code] != null ? Math.round(Number(cur[code]) * 10000) / 10000 : null,
      change:   cur[code] && p1[code]  ? chg(cur[code], p1[code])  : null,
      change7d: cur[code] && p7[code]  ? chg(cur[code], p7[code])  : null,
      unit: code.toUpperCase(),
    })

    const currencies = [
      pair('tjs','USD / TJS'), pair('rub','USD / RUB'), pair('eur','USD / EUR'),
      pair('cny','USD / CNY'), pair('aed','USD / AED'), pair('kzt','USD / KZT'),
    ]

    // ── Crypto ─────────────────────────────────────────────────────────────
    const cg = await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true')
    const cgd = (cg ?? {}) as Record<string, Record<string, number>>
    const crypto = [
      cgd.bitcoin?.usd  && { id:'btc', label:'Bitcoin (BTC)',  rate: cgd.bitcoin.usd,  change: cgd.bitcoin.usd_24h_change  != null ? Math.round(cgd.bitcoin.usd_24h_change *100)/100 : null, unit:'USD' },
      cgd.ethereum?.usd && { id:'eth', label:'Ethereum (ETH)', rate: cgd.ethereum.usd, change: cgd.ethereum.usd_24h_change != null ? Math.round(cgd.ethereum.usd_24h_change*100)/100 : null, unit:'USD' },
    ].filter(Boolean)

    // ── Commodities ─────────────────────────────────────────────────────────
    const syms = [
      { id:'gold',   label:'Золото (XAU)',    s:'GC=F', u:'USD/oz'  },
      { id:'silver', label:'Серебро (XAG)',   s:'SI=F', u:'USD/oz'  },
      { id:'brent',  label:'Нефть Brent',     s:'BZ=F', u:'USD/bbl' },
      { id:'wti',    label:'Нефть WTI (США)', s:'CL=F', u:'USD/bbl' },
    ]

    const commodities = (await Promise.all(syms.map(async t => {
      const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${t.s}?interval=1d&range=5d`)
      try {
        const r0     = ((d as Record<string,unknown>)?.chart as Record<string,unknown>)?.result as Record<string,unknown>[]
        const meta   = r0[0].meta as Record<string,number>
        const closes = ((r0[0].indicators as Record<string,unknown[]>)?.quote[0] as Record<string,number[]>)?.close ?? []
        const cur2   = meta.regularMarketPrice || (closes.length > 0 ? closes[closes.length-1] : 0)
        const prv    = closes.length > 1 ? closes[closes.length-2] : meta.previousClose
        if (!cur2) return null
        return { id:t.id, label:t.label, rate: Math.round(cur2*100)/100, change: prv ? Math.round((cur2-prv)/prv*10000)/100 : null, unit:t.u }
      } catch { return null }
    }))).filter(Boolean)

    // ── Macro (NBT static) ──────────────────────────────────────────────────
    const macro = [
      { id:'nbt_key',    label:'Ключевая ставка НБТ',       rate:9.0, change:null, unit:'%', year:'2026' },
      { id:'nbt_ann',    label:'Годовая инфляция (апрель)', rate:3.6, change:null, unit:'%', year:'2026' },
      { id:'nbt_mon',    label:'Инфляция за апрель',        rate:0.6, change:null, unit:'%', year:'2026' },
      { id:'nbt_target', label:'Целевой показатель (±2%)',  rate:5.0, change:null, unit:'%', year:'2026' },
    ]

    return NextResponse.json({ updatedAt: new Date().toISOString(), currencies, crypto, commodities, macro })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ── Safe fetch with timeout ───────────────────────────────────────────────────
async function get(url: string): Promise<unknown> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(t)
    const txt = await res.text()
    if (!txt.startsWith('{') && !txt.startsWith('[')) return null
    return JSON.parse(txt)
  } catch { return null }
}

// ── Currencies ────────────────────────────────────────────────────────────────
async function getCurrencies() {
  const d = await get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
  const y = await get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}/v1/currencies/usd.json`)
  const cur  = (d as Record<string,Record<string,number>>)?.usd  ?? {}
  const prev = (y as Record<string,Record<string,number>>)?.usd  ?? {}
  const p = (code: string, label: string) => ({
    id: `usd_${code}`, label,
    rate:   cur[code]  ? Math.round(Number(cur[code])  * 10000) / 10000 : null,
    change: cur[code] && prev[code] ? Math.round((cur[code] - prev[code]) / prev[code] * 10000) / 100 : null,
    unit: code.toUpperCase(),
  })
  return [p('tjs','USD/TJS'), p('rub','USD/RUB'), p('eur','USD/EUR'), p('cny','USD/CNY'), p('aed','USD/AED'), p('kzt','USD/KZT')]
}

// ── Crypto ────────────────────────────────────────────────────────────────────
async function getCrypto() {
  const d = await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true')
  if (!d) return []
  const r = d as Record<string,Record<string,number>>
  return [
    r.bitcoin  && { id:'btc', label:'Bitcoin (BTC)',  rate: r.bitcoin.usd,  change: r.bitcoin.usd_24h_change  ? Math.round(r.bitcoin.usd_24h_change *100)/100  : null, unit:'USD' },
    r.ethereum && { id:'eth', label:'Ethereum (ETH)', rate: r.ethereum.usd, change: r.ethereum.usd_24h_change ? Math.round(r.ethereum.usd_24h_change*100)/100 : null, unit:'USD' },
  ].filter(Boolean)
}

// ── Commodities ───────────────────────────────────────────────────────────────
async function getCommodities() {
  const symbols = [
    { id:'gold',   label:'Золото (XAU)',    sym:'GC=F', unit:'USD/oz'  },
    { id:'silver', label:'Серебро (XAG)',   sym:'SI=F', unit:'USD/oz'  },
    { id:'brent',  label:'Нефть Brent',     sym:'BZ=F', unit:'USD/bbl' },
    { id:'wti',    label:'Нефть WTI (США)', sym:'CL=F', unit:'USD/bbl' },
  ]
  const all = await Promise.allSettled(symbols.map(async s => {
    const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.sym}?interval=1d&range=5d`)
    try {
      const res    = ((d as Record<string,unknown>)?.chart as Record<string,unknown>)?.result as Record<string,unknown>[]
      const item   = res[0]
      const meta   = item.meta as Record<string,number>
      const closes = ((item.indicators as Record<string,unknown[]>)?.quote?.[0] as Record<string,number[]>)?.close ?? []
      const cur    = meta.regularMarketPrice || closes[closes.length-1]
      const prv    = closes.length > 1 ? closes[closes.length-2] : meta.previousClose
      if (!cur) return null
      return { id:s.id, label:s.label, rate: Math.round(cur*100)/100, change: cur&&prv ? Math.round((cur-prv)/prv*10000)/100 : null, unit:s.unit }
    } catch { return null }
  }))
  return all.map(r => r.status==='fulfilled' ? r.value : null).filter(Boolean)
}

// ── Macro (World Bank + NBT static) ──────────────────────────────────────────
async function getMacro() {
  const wb = [
    { id:'gdp_growth', label:'Рост ВВП РТ', code:'NY.GDP.MKTP.KD.ZG', unit:'%' },
  ]
  const wbResults = await Promise.allSettled(wb.map(async ind => {
    const d = await get(`https://api.worldbank.org/v2/country/TJ/indicator/${ind.code}?format=json&mrv=2&per_page=2`)
    if (!Array.isArray(d) || d.length < 2) return null
    const rows   = d[1] as { value:number|null; date:string }[]
    const latest = rows.find(e => e.value != null)
    if (!latest?.value) return null
    const prev   = rows.find(e => e.date < latest.date && e.value != null)
    const rate   = ind.unit==='млрд USD' ? Math.round(latest.value/1e9*10)/10 : Math.round(latest.value*100)/100
    const change = prev?.value != null ? Math.round((latest.value - prev.value)*100)/100 : null
    return { id:ind.id, label:ind.label, rate, change, unit:ind.unit, year:latest.date }
  }))

  const result = wbResults.map(r => r.status==='fulfilled' ? r.value : null).filter(Boolean)

  // NBT актуальные данные (источник: nbt.tj, обновлено вручную)
  result.push({ id:'nbt_key',     label:'Ключевая ставка НБТ',        rate:9.0,  change:null, unit:'%', year:'2026' })
  result.push({ id:'nbt_ann',     label:'Годовая инфляция (апрель)',   rate:3.6,  change:null, unit:'%', year:'2026' })
  result.push({ id:'nbt_mon',     label:'Инфляция за апрель',         rate:0.6,  change:null, unit:'%', year:'2026' })
  result.push({ id:'nbt_target',  label:'Целевой показатель (±2%)',   rate:5.0,  change:null, unit:'%', year:'2026' })

  return result
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const [r1,r2,r3,r4] = await Promise.allSettled([getCurrencies(), getCrypto(), getCommodities(), getMacro()])
  return NextResponse.json({
    updatedAt:   new Date().toISOString(),
    currencies:  r1.status==='fulfilled' ? r1.value : [],
    crypto:      r2.status==='fulfilled' ? r2.value : [],
    commodities: r3.status==='fulfilled' ? r3.value : [],
    macro:       r4.status==='fulfilled' ? r4.value : [],
  })
}

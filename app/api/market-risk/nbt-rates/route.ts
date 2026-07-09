import { NextResponse } from 'next/server'

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0]
}

// Currency mapping: our code → API currency code (lowercase)
const CURRENCY_MAP: Record<string, string> = {
  USD: 'usd',
  RUB: 'rub',
  EUR: 'eur',
}

// ── Fetch one date from fawazahmed0 currency API ──────────────────────────────
// Free, no auth, hosted on jsDelivr CDN — accessible from Vercel
async function fetchRateOnDate(date: string, base: string): Promise<number | null> {
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base}.json`
    const res  = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = await res.json()
    const tjs  = data?.[base]?.['tjs']
    return typeof tjs === 'number' ? tjs : null
  } catch {
    return null
  }
}

// ── Build historical series (weekly samples) ───────────────────────────────────
async function buildHistoricalRates(
  base: string,
  d1: string,
  d2: string
): Promise<{ date: string; value: number }[]> {
  const start = new Date(d1)
  const end   = new Date(d2)
  const dayMs = 86400000
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs)

  // Sample weekly (max ~52 points) to stay within reasonable API calls
  const stepDays = Math.max(7, Math.floor(totalDays / 52))
  const dates: string[] = []

  for (let i = 0; i <= totalDays; i += stepDays) {
    dates.push(formatDate(addDays(d1, i)))
  }
  // Always include last date
  const last = formatDate(d2)
  if (!dates.includes(last)) dates.push(last)

  // Fetch all in parallel (batched to avoid rate limits)
  const BATCH = 10
  const results: { date: string; value: number }[] = []

  for (let i = 0; i < dates.length; i += BATCH) {
    const batch = dates.slice(i, i + BATCH)
    const fetched = await Promise.all(
      batch.map(async date => {
        const value = await fetchRateOnDate(date, base)
        return value ? { date, value } : null
      })
    )
    fetched.forEach(r => { if (r) results.push(r) })
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Stats calculation ─────────────────────────────────────────────────────────
function calcStats(rates: { date: string; value: number }[], trim = false) {
  if (rates.length < 2) return null

  let returns: number[] = []
  for (let i = 1; i < rates.length; i++) {
    const ret = (rates[i].value - rates[i-1].value) / rates[i-1].value * 100
    returns.push(ret)
  }
  if (trim && returns.length > 10) {
    const m = returns.reduce((s, r) => s + r, 0) / returns.length
    const sig = Math.sqrt(returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length)
    returns = returns.filter(r => Math.abs(r - m) <= 2.5 * sig)
  }

  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev   = Math.sqrt(variance)

  return {
    mean:        Math.round(mean * 100) / 100,
    stdDev:      Math.round(stdDev * 100) / 100,
    min:         Math.round(Math.min(...returns) * 100) / 100,
    max:         Math.round(Math.max(...returns) * 100) / 100,
    current:     rates[rates.length - 1].value,
    first:       rates[0].value,
    totalChange: Math.round((rates[rates.length-1].value - rates[0].value) / rates[0].value * 10000) / 100,
    points:      rates.length,
    returns,
    rates:       rates.slice(-90),
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = (searchParams.get('currency') || 'USD').toUpperCase()
    const d1       = searchParams.get('d1') || '2022-01-01'
    const d2       = searchParams.get('d2') || new Date().toISOString().split('T')[0]

    const base = CURRENCY_MAP[currency]
    if (!base) return NextResponse.json({ error: 'Неподдерживаемая валюта' }, { status: 400 })

    // 1. Try primary: fawazahmed0 CDN API (free, accessible from Vercel)
    const rates = await buildHistoricalRates(base, d1, d2)

    if (rates.length >= 2) {
      const trimOutliers = searchParams.get('trim') === 'true'
    const stats = calcStats(rates, trimOutliers)
      return NextResponse.json({
        currency,
        d1, d2,
        source: 'fawazahmed0',
        stats,
      })
    }

    // 2. Fallback: try NBT directly (works if Vercel has Tajik IPs or NBT opens)
    const nbtCodes: Record<string, { cn: string }> = {
      USD: { cn: '840' }, RUB: { cn: '643' }, EUR: { cn: '978' }
    }
    const nbtUrl = `https://nbt.tj/ru/kurs/export_xml_dynamic.php?d1=${d1}&d2=${d2}&cn=${nbtCodes[currency].cn}&cs=${currency}&export=xml`
    const nbtRes = await fetch(nbtUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://nbt.tj/ru/kurs/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
    })

    if (nbtRes.ok) {
      const xml = await nbtRes.text()
      const nbtRates = parseNBTXml(xml)
      if (nbtRates.length >= 2) {
        const stats = calcStats(nbtRates)
        return NextResponse.json({ currency, d1, d2, source: 'nbt', stats })
      }
    }

    return NextResponse.json({
      error: `Не удалось получить данные по ${currency}/TJS. НБТ недоступен с серверов платформы. Введите μ и σ вручную.`
    }, { status: 503 })

  } catch (error) {
    console.error('Rates error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

// ── NBT XML Parser (fallback) ─────────────────────────────────────────────────
function parseNBTXml(xml: string): { date: string; value: number }[] {
  const rates: { date: string; value: number }[] = []
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
  for (const item of items) {
    const dateMatch  = item.match(/<date>(.*?)<\/date>/)
    const valueMatch = item.match(/<value>(.*?)<\/value>/)
    if (dateMatch && valueMatch) {
      const value = parseFloat(valueMatch[1].replace(',', '.'))
      if (!isNaN(value) && value > 0) rates.push({ date: dateMatch[1], value })
    }
  }
  return rates
}

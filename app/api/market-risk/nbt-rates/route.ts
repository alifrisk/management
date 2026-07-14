import { NextResponse } from 'next/server'

// ── Currency mappings ─────────────────────────────────────────────────────────
const CURRENCY_MAP: Record<string, string> = {
  USD: 'usd',
  RUB: 'rub',
  EUR: 'eur',
}

const NBT_CODES: Record<string, string> = {
  USD: '840',
  RUB: '643',
  EUR: '978',
}

// ── NBT XML Parser ────────────────────────────────────────────────────────────
// Real format: <Record Date="DD.MM.YYYY" Id="840"><Value>9.3851</Value></Record>
function parseNBTXml(xml: string): { date: string; value: number }[] {
  const rates: { date: string; value: number }[] = []
  const records = xml.match(/<Record[^>]*>[\s\S]*?<\/Record>/g) || []
  for (const record of records) {
    const dateMatch  = record.match(/Date="(\d{2})\.(\d{2})\.(\d{4})"/)
    const valueMatch = record.match(/<Value>([\d.,]+)<\/Value>/)
    if (dateMatch && valueMatch) {
      const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      const value   = parseFloat(valueMatch[1].replace(',', '.'))
      if (!isNaN(value) && value > 0) rates.push({ date: isoDate, value })
    }
  }
  return rates.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Primary: NBT official API (one request → full daily series) ───────────────
async function fetchNBTRates(
  currency: string,
  d1: string,
  d2: string
): Promise<{ date: string; value: number }[]> {
  const cn = NBT_CODES[currency]
  if (!cn) return []
  const url = `https://nbt.tj/ru/kurs/export_xml_dynamic.php?d1=${d1}&d2=${d2}&cn=${cn}&cs=${currency}&export=xml`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer':         'https://nbt.tj/ru/kurs/',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) return []
    return parseNBTXml(await res.text())
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ── Fallback: fawazahmed0 CDN (one request per date, weekly sampling) ─────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

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

async function buildHistoricalRates(
  base: string,
  d1: string,
  d2: string
): Promise<{ date: string; value: number }[]> {
  const totalDays = Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000)
  const stepDays  = Math.max(7, Math.floor(totalDays / 52))
  const dates: string[] = []

  for (let i = 0; i <= totalDays; i += stepDays) {
    dates.push(new Date(addDays(d1, i)).toISOString().split('T')[0])
  }
  const last = new Date(d2).toISOString().split('T')[0]
  if (!dates.includes(last)) dates.push(last)

  const BATCH = 10
  const results: { date: string; value: number }[] = []
  for (let i = 0; i < dates.length; i += BATCH) {
    const fetched = await Promise.all(
      dates.slice(i, i + BATCH).map(async date => {
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
    returns.push((rates[i].value - rates[i-1].value) / rates[i-1].value * 100)
  }
  if (trim && returns.length > 10) {
    const m   = returns.reduce((s, r) => s + r, 0) / returns.length
    const sig = Math.sqrt(returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length)
    returns   = returns.filter(r => Math.abs(r - m) <= 2.5 * sig)
  }

  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length

  return {
    mean:        mean,
    stdDev:      Math.sqrt(variance),
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
    const currency     = (searchParams.get('currency') || 'USD').toUpperCase()
    const d1           = searchParams.get('d1') || '2022-01-01'
    const d2           = searchParams.get('d2') || new Date().toISOString().split('T')[0]
    const trimOutliers = searchParams.get('trim') === 'true'

    if (!CURRENCY_MAP[currency]) {
      return NextResponse.json({ error: 'Неподдерживаемая валюта' }, { status: 400 })
    }

    // 1. Primary: NBT official XML API — single request, full daily series (~195–273 pts)
    const nbtRates = await fetchNBTRates(currency, d1, d2)
    if (nbtRates.length >= 2) {
      return NextResponse.json({
        currency, d1, d2,
        source: 'nbt',
        stats: calcStats(nbtRates, trimOutliers),
      })
    }

    // 2. Fallback: fawazahmed0 CDN — weekly sampling (~39–52 pts)
    const cdnRates = await buildHistoricalRates(CURRENCY_MAP[currency], d1, d2)
    if (cdnRates.length >= 2) {
      return NextResponse.json({
        currency, d1, d2,
        source: 'fawazahmed0',
        stats: calcStats(cdnRates, trimOutliers),
      })
    }

    return NextResponse.json({
      error: `Не удалось получить данные по ${currency}/TJS. Введите μ и σ вручную.`,
    }, { status: 503 })

  } catch (error) {
    console.error('Rates error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

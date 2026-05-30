import { NextResponse } from 'next/server'

// Currency codes for NBT
const CURRENCY_CODES: Record<string, { cn: string; cs: string }> = {
  USD: { cn: '840', cs: 'USD' },
  RUB: { cn: '643', cs: 'RUB' },
  EUR: { cn: '978', cs: 'EUR' },
}

function parseNBTXml(xml: string): { date: string; value: number }[] {
  const rates: { date: string; value: number }[] = []
  // Match <item> blocks
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
  for (const item of items) {
    const dateMatch = item.match(/<date>(.*?)<\/date>/)
    const valueMatch = item.match(/<value>(.*?)<\/value>/)
    if (dateMatch && valueMatch) {
      const value = parseFloat(valueMatch[1].replace(',', '.'))
      if (!isNaN(value) && value > 0) {
        rates.push({ date: dateMatch[1], value })
      }
    }
  }
  return rates
}

function calcStats(rates: { date: string; value: number }[]) {
  if (rates.length < 2) return null

  // Daily returns
  const returns: number[] = []
  for (let i = 1; i < rates.length; i++) {
    const ret = (rates[i].value - rates[i-1].value) / rates[i-1].value * 100
    returns.push(ret)
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  const min = Math.min(...returns)
  const max = Math.max(...returns)

  // Current rate
  const current = rates[rates.length - 1].value
  const first = rates[0].value
  const totalChange = (current - first) / first * 100

  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    current,
    first,
    totalChange: Math.round(totalChange * 100) / 100,
    dataPoints: rates.length,
    returns,
    rates: rates.slice(-90), // last 90 days for chart
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = (searchParams.get('currency') || 'USD').toUpperCase()
    const d1 = searchParams.get('d1') || '2020-01-01'
    const d2 = searchParams.get('d2') || new Date().toISOString().split('T')[0]

    const codes = CURRENCY_CODES[currency]
    if (!codes) return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })

    const url = `https://nbt.tj/ru/kurs/export_xml_dynamic.php?d1=${d1}&d2=${d2}&cn=${codes.cn}&cs=${codes.cs}&export=xml`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlifRisk/1.0)' },
      next: { revalidate: 3600 } // cache 1 hour
    })

    if (!res.ok) throw new Error(`NBT returned ${res.status}`)

    const xml = await res.text()
    const rates = parseNBTXml(xml)

    if (!rates.length) throw new Error('No data from NBT')

    const stats = calcStats(rates)
    return NextResponse.json({ currency, d1, d2, stats })

  } catch (error) {
    console.error('NBT rates error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

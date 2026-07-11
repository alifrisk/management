import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const currency = searchParams.get('currency')?.toUpperCase()

  if (!currency) {
    return NextResponse.json({ error: 'Missing currency parameter' }, { status: 400 })
  }

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error('[exchange-rates] upstream error', res.status)
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
    }

    const json = await res.json()
    const rate = json?.rates?.[currency]

    if (rate == null) {
      return NextResponse.json({ error: `Rate not found for ${currency}` }, { status: 404 })
    }

    return NextResponse.json({ rate })
  } catch (err) {
    console.error('[exchange-rates] fetch failed', err)
    return NextResponse.json({ error: 'Rate unavailable' }, { status: 502 })
  }
}

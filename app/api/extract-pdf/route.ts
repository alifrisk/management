import { NextResponse } from 'next/server'
import { aiExtractFromPDF } from '@/lib/ai-provider'

export async function POST(request: Request) {
  try {
    const { fileBase64 } = await request.json()
    if (!fileBase64) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })

    const text = await aiExtractFromPDF(fileBase64, 4000)
    return NextResponse.json({ text })
  } catch (err) {
    console.error('extract-pdf error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

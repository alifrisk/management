import { NextResponse } from 'next/server'
import { inflateRaw } from 'zlib'
import { promisify } from 'util'

const inflate = promisify(inflateRaw)

async function parseDocx(buffer: Buffer): Promise<string> {
  const target = 'word/document.xml'
  let offset = 0

  while (offset < buffer.length - 30) {
    if (
      buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04
    ) {
      const method = buffer.readUInt16LE(offset + 8)
      const compressedSize = buffer.readUInt32LE(offset + 18)
      const fnLen = buffer.readUInt16LE(offset + 26)
      const extraLen = buffer.readUInt16LE(offset + 28)
      const dataStart = offset + 30 + fnLen + extraLen
      const filename = buffer.slice(offset + 30, offset + 30 + fnLen).toString('utf8')

      if (filename === target) {
        const compressed = buffer.slice(dataStart, dataStart + compressedSize)
        let xml: string

        if (method === 0) {
          xml = compressed.toString('utf8')
        } else if (method === 8) {
          const dec = await inflate(compressed)
          xml = dec.toString('utf8')
        } else {
          throw new Error('Unsupported compression: ' + method)
        }

        // Extract text from <w:t> elements
        const text = xml
          .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, '$1 ')
          .replace(/<w:br[^/]*/g, '\n')
          .replace(/<w:p[ >][^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        return text
      }

      offset = dataStart + (compressedSize || 1)
    } else {
      offset++
    }
  }

  throw new Error('word/document.xml не найден в файле')
}

export async function POST(request: Request) {
  try {
    const { fileBase64 } = await request.json()
    if (!fileBase64) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })

    const buffer = Buffer.from(fileBase64, 'base64')
    const text = await parseDocx(buffer)

    return NextResponse.json({ text })
  } catch (err) {
    console.error('extract-docx error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

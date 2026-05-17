import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

interface CellOpts {
  gray?: boolean
  bold?: boolean
  left?: boolean
  colSpan?: number
  rowSpan?: number
}

interface ParaOpts {
  right?: boolean
  center?: boolean
  after?: number
  indent?: boolean
  bold?: boolean
  size?: number
}

export async function POST(request: Request) {
  try {
    const { incident } = await request.json()

    const discoveryDate = incident.discovery_date
      ? new Date(incident.discovery_date).toLocaleDateString('ru-RU')
      : '—'
    const incidentDate = incident.incident_date
      ? new Date(incident.incident_date).toLocaleDateString('ru-RU')
      : '—'
    const loss = incident.loss_amount_tjs
      ? new Intl.NumberFormat('ru-RU').format(incident.loss_amount_tjs)
      : '—'
    const recovery = incident.recovery_amount
      ? new Intl.NumberFormat('ru-RU').format(incident.recovery_amount)
      : '—'
    const description = incident.case_description || incident.disclosure || incident.cause || '—'
    const department = incident.department || '—'

    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, ImageRun
    } = await import('docx')

    const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    const borders = { top: b, bottom: b, left: b, right: b }
    const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const noborders = { top: nob, bottom: nob, left: nob, right: nob }

    const makeCell = (text: string, opts: CellOpts = {}) =>
      new TableCell({
        borders,
        rowSpan: opts.rowSpan,
        columnSpan: opts.colSpan,
        verticalAlign: VerticalAlign.CENTER,
        shading: opts.gray ? { fill: 'D9D9D9', type: ShadingType.CLEAR } : undefined,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({
          alignment: opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: String(text || ''), size: 14, bold: !!opts.bold, font: 'Times New Roman' })]
        })]
      })

    const makePara = (text: string, opts: ParaOpts = {}) =>
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
        spacing: { after: opts.after !== undefined ? opts.after : 120, line: 276 },
        indent: opts.indent ? { firstLine: 720 } : undefined,
        children: [new TextRun({ text: String(text || ''), size: opts.size || 24, bold: !!opts.bold, font: 'Times New Roman' })]
      })

    const makeNB = (children: InstanceType<typeof Paragraph>[]) =>
      new TableCell({ borders: noborders, children })

    // Read logo
    let logoData: Buffer | null = null
    try {
      logoData = readFileSync(join(process.cwd(), 'public', 'nbt-header.png'))
    } catch { /* no logo */ }

    // ==================
    // SECTION 1: Portrait - Letter
    // ==================
    const section1Children = [
      ...(logoData ? [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
        children: [new ImageRun({ data: logoData, transformation: { width: 600, height: 100 } })]
      })] : []),

      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [4677, 4677],
        rows: [new TableRow({ children: [makeNB([makePara('')]), makeNB([makePara('Ба Бонки миллии Тоҷикистон', { right: true, bold: true })])] })]
      }),
      makePara(''),
      makePara('ҶСК «Алиф Бонк» (минбаъд дар матн - "Бонк") ба Шумо эҳтироми худро баён намуда, ҳисоботи умумии мониторинги хавфи амалиётиро оид ба ҳодисаҳои дорои хавфи амалиётии моддӣ, ки боиси зарар дар ҳаҷми 5 000 сомонӣ ва зиёда аз он оварда расонидаанд, мувофиқи банди 54-и Дастурамали №240 Бонки миллии Тоҷикистон барои санаи ҷорӣ пешниҳод менамояд.', { indent: true }),
      makePara('Замимаи №1 дар ҳаҷми 1 варақ', { after: 240 }),
      makePara('Бо эҳтиром,', { after: 480 }),
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [4677, 4677],
        rows: [new TableRow({ children: [makeNB([makePara('Раиси Бонк')]), makeNB([makePara('Атобек Гуланор', { right: true })])] })]
      }),
      makePara(''),
      makePara('Иҷрокунанда: Камила Мародмамадова', { after: 60 }),
      makePara('Тел.: +992884034004', { after: 60 }),
    ]

    // ==================
    // SECTION 2: Landscape - Table (Annex)
    // ==================
    const section2Children = [
      makePara('Замима', { right: true, bold: true }),
      makePara('Ҳисобот оид ба ҳодисаҳои хавфҳои амалиётӣ,', { center: true, bold: true, after: 60 }),
      makePara('ки ба зарар дар ҳаҷми 5000 сомонӣ ва зиёда аз он оварда расонидаанд', { center: true, bold: true, after: 60 }),
      makePara(`дар ҶСК "Алиф Бонк" барои "${discoveryDate}"`, { center: true, bold: true, after: 200 }),

      new Table({
        width: { size: 14400, type: WidthType.DXA },
        columnWidths: [400, 2200, 1200, 900, 600, 600, 600, 600, 600, 600, 600, 1200, 1300],
        rows: [
          // Header
          new TableRow({ tableHeader: true, children: [
            makeCell('№', { gray: true, bold: true }),
            makeCell('Муҳтавои ҳодисаҳои хавфи амалиётӣ (сабабҳои зарар)', { gray: true, bold: true }),
            makeCell('Ҷойе', { gray: true, bold: true }),
            makeCell('Санаи ҳодиса', { gray: true, bold: true }),
            makeCell('Ҷаримаҳо', { gray: true, bold: true }),
            makeCell('Хароҷоти судӣ', { gray: true, bold: true }),
            makeCell('Ҷуброни кормандон', { gray: true, bold: true }),
            makeCell('Ҷуброни муштариён', { gray: true, bold: true }),
            makeCell('Дороиҳо', { gray: true, bold: true }),
            makeCell('Хароҷоти бартараф', { gray: true, bold: true }),
            makeCell('Зарарҳои дигар', { gray: true, bold: true }),
            makeCell('Шакл ва ҳаҷми пайомадҳо (бо сомонӣ)', { gray: true, bold: true }),
            makeCell('Маблағҳои барқароршуда', { gray: true, bold: true }),
          ]}),
          // Data row
          new TableRow({ children: [
            makeCell('1'),
            makeCell(description, { left: true }),
            makeCell(department),
            makeCell(incidentDate),
            makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
            makeCell(loss),
            makeCell(recovery),
          ]}),
          // Total row
          new TableRow({ children: [
            new TableCell({
              borders,
              columnSpan: 11,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Ҳамагӣ:', size: 14, bold: true, font: 'Times New Roman' })] })]
            }),
            makeCell(loss, { bold: true }),
            makeCell(recovery, { bold: true }),
          ]}),
        ]
      }),
    ]

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 2836, right: 850, bottom: 1134, left: 1418 }
            }
          },
          children: section1Children
        },
        {
          properties: {
            page: {
              size: { width: 16838, height: 11906 },
              margin: { top: 1418, right: 2836, bottom: 850, left: 1134 }
            }
          },
          children: section2Children
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="NBT_OR_${incident.incident_number}_${new Date().toISOString().split('T')[0]}.docx"`,
      }
    })
  } catch (error) {
    console.error('NBT report error:', error)
    return NextResponse.json({ error: 'Ошибка генерации отчёта' }, { status: 500 })
  }
}

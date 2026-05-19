import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

interface CellOpts {
  gray?: boolean; bold?: boolean; left?: boolean
  colSpan?: number; rowSpan?: number; center?: boolean
}

interface ParaOpts {
  right?: boolean; center?: boolean; after?: number
  indent?: boolean; bold?: boolean; size?: number; before?: number
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
    const todayDate = new Date().toLocaleDateString('ru-RU')
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
    const bLight = { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' }
    const bordersLight = { top: bLight, bottom: bLight, left: bLight, right: bLight }

    const makeCell = (text: string, opts: CellOpts = {}) =>
      new TableCell({
        borders,
        rowSpan: opts.rowSpan,
        columnSpan: opts.colSpan,
        verticalAlign: VerticalAlign.CENTER,
        shading: opts.gray ? { fill: 'E8E8E8', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: String(text || ''), size: 16, bold: !!opts.bold, font: 'Times New Roman' })]
        })]
      })

    const makePara = (text: string, opts: ParaOpts = {}) =>
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
        spacing: {
          after: opts.after !== undefined ? opts.after : 120,
          before: opts.before !== undefined ? opts.before : 0,
          line: 276
        },
        indent: opts.indent ? { firstLine: 720 } : undefined,
        children: [new TextRun({
          text: String(text || ''),
          size: opts.size || 24,
          bold: !!opts.bold,
          font: 'Times New Roman'
        })]
      })

    const makeNB = (children: InstanceType<typeof Paragraph>[]) =>
      new TableCell({ borders: noborders, children })

    // Read logo
    let logoData: Buffer | null = null
    try {
      logoData = readFileSync(join(process.cwd(), 'public', 'nbt-header.png'))
    } catch { /* no logo */ }

    // ==================
    // SECTION 1: Portrait - Letter (улучшенный дизайн)
    // ==================
    const section1Children = [
      // Логотип — больше и выше
      ...(logoData ? [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 400, before: 0 },
        children: [new ImageRun({
          data: logoData,
          transformation: { width: 900, height: 140 }
        })]
      })] : []),

      // Горизонтальная линия под логотипом
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [9354],
        rows: [new TableRow({ children: [new TableCell({
          borders: {
            top: nob, left: nob, right: nob,
            bottom: { style: BorderStyle.SINGLE, size: 8, color: '1B8A4C' }
          },
          children: [new Paragraph({ children: [] })]
        })] })]
      }),

      makePara('', { after: 200 }),

      // Адресат справа
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [4677, 4677],
        rows: [new TableRow({ children: [
          makeNB([makePara('')]),
          makeNB([
            makePara('Ба Бонки миллии Тоҷикистон', { right: true, bold: true, size: 24, after: 40 }),
            makePara('(Бахши назорати хавфҳо)', { right: true, size: 22, after: 0 }),
          ])
        ]})]
      }),

      makePara('', { after: 160 }),

      // Основной текст письма
      makePara('ҶСК «Алиф Бонк» (минбаъд дар матн - "Бонк") ба Шумо эҳтироми худро баён намуда, ҳисоботи умумии мониторинги хавфи амалиётиро оид ба ҳодисаҳои дорои хавфи амалиётии моддӣ, ки боиси зарар дар ҳаҷми 5 000 сомонӣ ва зиёда аз он оварда расонидаанд, мувофиқи банди 54-и Дастурамали №240 Бонки миллии Тоҷикистон барои санаи ҷорӣ пешниҳод менамояд.', {
        indent: true, after: 160, size: 24
      }),

      makePara('Замимаи №1 дар ҳаҷми 1 варақ', { after: 320, size: 24 }),

      makePara('Бо эҳтиром,', { after: 400, size: 24 }),

      // Подпись
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [4677, 4677],
        rows: [new TableRow({ children: [
          makeNB([makePara('Раиси Бонк', { size: 24 })]),
          makeNB([makePara('Атобек Гуланор', { right: true, size: 24 })])
        ]})]
      }),

      makePara('', { after: 240 }),

      // Разделитель
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [9354],
        rows: [new TableRow({ children: [new TableCell({
          borders: {
            top: nob, left: nob, right: nob,
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
          },
          children: [new Paragraph({ children: [] })]
        })] })]
      }),

      makePara('', { after: 80 }),

      // Исполнитель
      makePara('Иҷрокунанда: Камила Мародмамадова', { after: 40, size: 20 }),
      makePara('Тел.: +992884034004', { after: 40, size: 20 }),
      makePara(`Сана: ${todayDate}`, { after: 0, size: 20 }),
    ]

    // ==================
    // SECTION 2: Landscape - Table (Annex)
    // ==================
    const section2Children = [
      makePara('Замима №1', { right: true, bold: true, after: 40 }),
      makePara(`ба мактуби ҶСК "Алиф Бонк" аз "${todayDate}"`, { right: true, after: 200, size: 20 }),

      makePara('Ҳисобот оид ба ҳодисаҳои хавфҳои амалиётӣ,', { center: true, bold: true, after: 40, size: 22 }),
      makePara('ки ба зарар дар ҳаҷми 5000 сомонӣ ва зиёда аз он оварда расонидаанд', { center: true, bold: true, after: 40, size: 22 }),
      makePara(`дар ҶСК "Алиф Бонк" барои "${discoveryDate}"`, { center: true, bold: true, after: 200, size: 22 }),

      new Table({
        width: { size: 14400, type: WidthType.DXA },
        columnWidths: [400, 2200, 1100, 900, 650, 650, 650, 650, 650, 650, 650, 1200, 1200],
        rows: [
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
          new TableRow({ children: [
            makeCell('1'),
            makeCell(description, { left: true }),
            makeCell(department),
            makeCell(incidentDate),
            makeCell(''), makeCell(''), makeCell(''), makeCell(''),
            makeCell(''), makeCell(''), makeCell(''),
            makeCell(loss, { bold: true }),
            makeCell(recovery),
          ]}),
          new TableRow({ children: [
            new TableCell({
              borders,
              columnSpan: 11,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Ҳамагӣ:', size: 16, bold: true, font: 'Times New Roman' })]
              })]
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
              margin: { top: 2268, right: 851, bottom: 1134, left: 1701 }
            }
          },
          children: section1Children
        },
        {
          properties: {
            page: {
              size: { width: 16838, height: 11906 },
              margin: { top: 1134, right: 851, bottom: 851, left: 1134 }
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
        'Content-Disposition': `attachment; filename="NBT_OR_${incident.incident_number}.docx"`,
      }
    })
  } catch (error) {
    console.error('NBT report error:', error)
    return NextResponse.json({ error: 'Ошибка генерации отчёта' }, { status: 500 })
  }
}

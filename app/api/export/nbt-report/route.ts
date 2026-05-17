import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

interface CellOpts {
  noBorder?: boolean
  rowSpan?: number
  colSpan?: number
  gray?: boolean
  bold?: boolean
  left?: boolean
}

interface ParaOpts {
  right?: boolean
  center?: boolean
  after?: number
  indent?: boolean
  size?: number
  bold?: boolean
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

    // Read logo from public folder
    let logoData: Buffer | null = null
    try {
      const logoPath = join(process.cwd(), 'public', 'nbt-header.png')
      logoData = readFileSync(logoPath)
    } catch {
      // Logo not found - continue without it
    }

    const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    const borders = { top: b, bottom: b, left: b, right: b }
    const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const noborders = { top: nob, bottom: nob, left: nob, right: nob }

    const makeCell = (text: string, opts: CellOpts = {}) =>
      new TableCell({
        borders: opts.noBorder ? noborders : borders,
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

    const doc = new Document({
      sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 851, bottom: 1134, left: 1701 }
          }
        },
        children: [
          // Logo header if available
          ...(logoData ? [new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 300 },
            children: [new ImageRun({
              data: logoData,
              transformation: { width: 600, height: 100 },
            })]
          })] : []),

          new Table({
            width: { size: 13500, type: WidthType.DXA },
            columnWidths: [400, 2000, 1200, 900, 600, 600, 600, 600, 600, 600, 600, 1000, 1200],
            rows: [
              // Single header row
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
              // Data row - 13 cells matching 13 columns
              new TableRow({ children: [
                makeCell('1'),
                makeCell(description, { left: true }),
                makeCell(department),
                makeCell(discoveryDate),
                makeCell(''),
                makeCell(''),
                makeCell(''),
                makeCell(''),
                makeCell(''),
                makeCell(''),
                makeCell(''),
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

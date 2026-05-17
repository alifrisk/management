import { NextResponse } from 'next/server'

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

    // Dynamic import to avoid SSR issues
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType
    } = await import('docx')

    const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    const borders = { top: b, bottom: b, left: b, right: b }
    const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const noborders = { top: nob, bottom: nob, left: nob, right: nob }

    function C(text: string, opts: { noBorder?: boolean; rowSpan?: number; colSpan?: number; gray?: boolean; bold?: boolean; left?: boolean } = {}) {
      return new TableCell({
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
    }

    function P(text: string, opts: { right?: boolean; center?: boolean; after?: number; indent?: boolean; size?: number; bold?: boolean } = {}) {
      return new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
        spacing: { after: opts.after !== undefined ? opts.after : 120, line: 276 },
        indent: opts.indent ? { firstLine: 720 } : undefined,
        children: [new TextRun({ text: String(text || ''), size: opts.size || 24, bold: !!opts.bold, font: 'Times New Roman' })]
      })
    }

    function NB(children: InstanceType<typeof Paragraph>[]) {
      return new TableCell({ borders: noborders, children })
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 851, bottom: 1134, left: 1701 }
          }
        },
        children: [
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [NB([P('')]), NB([P('Ба Бонки миллии Тоҷикистон', { right: true, bold: true })])] })]
          }),
          P(''),
          P('ҶСК «Алиф Бонк» (минбаъд дар матн - "Бонк") ба Шумо эҳтироми худро баён намуда, ҳисоботи умумии мониторинги хавфи амалиётиро оид ба ҳодисаҳои дорои хавфи амалиётии моддӣ, ки боиси зарар дар ҳаҷми 5 000 сомонӣ ва зиёда аз он оварда расонидаанд, мувофиқи банди 54-и Дастурамали №240 Бонки миллии Тоҷикистон барои санаи ҷорӣ пешниҳод менамояд.', { indent: true }),
          P('Замимаи №1 дар ҳаҷми 1 варақ', { after: 240 }),
          P('Бо эҳтиром,', { after: 480 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [NB([P('Раиси Бонк')]), NB([P('Атобек Гуланор', { right: true })])] })]
          }),
          P(''),
          P('Иҷрокунанда: Камила Мародмамадова', { after: 60 }),
          P('Тел.: +992884034004', { after: 60 }),
          new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }),
          P('Замима', { right: true, bold: true }),
          P('Ҳисобот оид ба ҳодисаҳои хавфҳои амалиётӣ,', { center: true, bold: true, after: 60 }),
          P('ки ба зарар дар ҳаҷми 5000 сомонӣ ва зиёда аз он оварда расонидаанд', { center: true, bold: true, after: 60 }),
          P(`дар ҶСК "Алиф Бонк" барои "${discoveryDate}"`, { center: true, bold: true, after: 200 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [400, 1600, 900, 800, 550, 550, 550, 550, 550, 550, 550, 550, 800],
            rows: [
              new TableRow({ tableHeader: true, children: [
                C('№', { rowSpan: 3, gray: true, bold: true }),
                C('Муҳтавои ҳодисаҳои хавфи амалиётӣ (сабабҳои зарар)', { rowSpan: 3, gray: true, bold: true }),
                C('Ҷойе', { rowSpan: 3, gray: true, bold: true }),
                C('Санаи ҳодиса', { rowSpan: 3, gray: true, bold: true }),
                C('Шакл ва ҳаҷми пайомадҳо (бо сомонӣ)', { colSpan: 8, gray: true, bold: true }),
                C('Маблағҳои барқароршуда', { rowSpan: 3, gray: true, bold: true }),
              ]}),
              new TableRow({ tableHeader: true, children: [
                C('Ҷаримаҳо', { gray: true, bold: true }),
                C('Хароҷоти судӣ', { gray: true, bold: true }),
                C('Ҷуброни кормандон', { gray: true, bold: true }),
                C('Ҷуброни муштариён', { gray: true, bold: true }),
                C('Дороиҳо', { gray: true, bold: true }),
                C('Хароҷоти бартараф', { gray: true, bold: true }),
                C('Зарарҳои дигар', { gray: true, bold: true }),
                C('Коҳиши арзиш', { gray: true, bold: true }),
              ]}),
              new TableRow({ tableHeader: true, children: [
                C('р/т', { gray: true }), C('1', { gray: true }), C('2', { gray: true }), C('3', { gray: true }),
                C('4', { gray: true }), C('5', { gray: true }), C('6', { gray: true }), C('7', { gray: true }),
                C('8', { gray: true }), C('9', { gray: true }), C('10', { gray: true }), C('11', { gray: true }),
              ]}),
              new TableRow({ children: [
                C('1'),
                C(description, { left: true }),
                C(department),
                C(incidentDate),
                C(loss), C(''), C(''), C(''), C(''), C(''), C(''), C(''),
                C(recovery),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders, columnSpan: 3, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ҳамагӣ', size: 14, bold: true, font: 'Times New Roman' })] })] }),
                C(''),
                new TableCell({ borders, columnSpan: 8, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: loss, size: 14, bold: true, font: 'Times New Roman' })] })] }),
                C(recovery, { bold: true }),
              ]}),
            ]
          }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(buffer, {
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

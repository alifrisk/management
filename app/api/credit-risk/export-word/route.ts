import { NextResponse } from 'next/server'

interface CellOpts { gray?: boolean; bold?: boolean; left?: boolean; colSpan?: number }
interface ParaOpts { right?: boolean; center?: boolean; after?: number; bold?: boolean; size?: number; indent?: boolean }

export async function POST(request: Request) {
  try {
    const { conclusion } = await request.json()

    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, HeadingLevel
    } = await import('docx')

    const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    const borders = { top: b, bottom: b, left: b, right: b }
    const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const noborders = { top: nob, bottom: nob, left: nob, right: nob }

    const makeCell = (text: string, opts: CellOpts = {}) =>
      new TableCell({
        borders: opts.gray ? borders : borders,
        columnSpan: opts.colSpan,
        verticalAlign: VerticalAlign.CENTER,
        shading: opts.gray ? { fill: 'E8E8E8', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: String(text || '—'), size: 20, bold: !!opts.bold, font: 'Times New Roman' })]
        })]
      })

    const makePara = (text: string, opts: ParaOpts = {}) =>
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
        spacing: { after: opts.after !== undefined ? opts.after : 120, line: 276 },
        indent: opts.indent ? { firstLine: 720 } : undefined,
        children: [new TextRun({ text: String(text || ''), size: opts.size || 24, bold: !!opts.bold, font: 'Times New Roman' })]
      })

    const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
    const today = new Date().toLocaleDateString('ru-RU')

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 851, bottom: 1134, left: 1701 }
          }
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: 'ҶСК «Алиф Бонк»', size: 28, bold: true, font: 'Times New Roman' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: 'Служба управления рисками', size: 24, font: 'Times New Roman' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: 'ЗАКЛЮЧЕНИЕ', size: 32, bold: true, font: 'Times New Roman' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: 'по кредитной заявке субъекта малого и среднего бизнеса', size: 24, font: 'Times New Roman' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: `Дата: ${today}`, size: 22, font: 'Times New Roman' })]
          }),

          // Borrower info table
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3500, 5854],
            rows: [
              new TableRow({ children: [
                makeCell('Наименование заёмщика', { gray: true, bold: true }),
                makeCell(conclusion.borrower_name, { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('ИНН', { gray: true, bold: true }),
                makeCell(conclusion.borrower_inn || '—', { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Вид деятельности', { gray: true, bold: true }),
                makeCell(conclusion.business_type || '—', { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Лет в бизнесе', { gray: true, bold: true }),
                makeCell(String(conclusion.years_in_business || '—'), { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Сумма кредита', { gray: true, bold: true }),
                makeCell(`${fmt(conclusion.loan_amount)} ${conclusion.loan_currency}`, { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Срок кредита', { gray: true, bold: true }),
                makeCell(conclusion.loan_term || '—', { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Цель кредита', { gray: true, bold: true }),
                makeCell(conclusion.loan_purpose, { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Кредитная история', { gray: true, bold: true }),
                makeCell(conclusion.credit_history || '—', { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Годовая выручка (TJS)', { gray: true, bold: true }),
                makeCell(fmt(conclusion.annual_revenue), { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Чистая прибыль (TJS)', { gray: true, bold: true }),
                makeCell(fmt(conclusion.net_profit), { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Залог', { gray: true, bold: true }),
                makeCell(`${conclusion.collateral_type || '—'} / ${fmt(conclusion.collateral_value)} TJS`, { left: true })
              ]}),
              new TableRow({ children: [
                makeCell('Аналитик', { gray: true, bold: true }),
                makeCell(conclusion.analyst_name || '—', { left: true })
              ]}),
            ]
          }),

          makePara('', { after: 240 }),

          // AI Conclusion
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: 'AI ЗАКЛЮЧЕНИЕ:', size: 24, bold: true, font: 'Times New Roman' })]
          }),

          // Split conclusion into paragraphs
          ...conclusion.ai_conclusion.split('\n').filter((line: string) => line.trim()).map((line: string) =>
            makePara(line.trim(), { after: 80, indent: !line.startsWith('1.') && !line.startsWith('2.') && !line.startsWith('3.') && !line.startsWith('4.') && !line.startsWith('5.') })
          ),

          makePara('', { after: 120 }),

          // Recommendation box
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3500, 5854],
            rows: [
              new TableRow({ children: [
                makeCell('РЕКОМЕНДАЦИЯ', { gray: true, bold: true }),
                makeCell(conclusion.recommendation || '—', { left: true, bold: true })
              ]}),
              new TableRow({ children: [
                makeCell('УРОВЕНЬ РИСКА', { gray: true, bold: true }),
                makeCell(conclusion.risk_level || '—', { left: true, bold: true })
              ]}),
            ]
          }),

          makePara('', { after: 360 }),

          // Signatures
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [
                makePara('Риск-аналитик: _________________', { after: 60 }),
                makePara(conclusion.analyst_name ? `(${conclusion.analyst_name})` : '(подпись)', { after: 0 })
              ]}),
              new TableCell({ borders: noborders, children: [
                makePara(`г. Душанбе, ${today}`, { right: true, after: 0 })
              ]})
            ]})]
          }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Zakluchenie_${conclusion.borrower_name}.docx"`,
      }
    })
  } catch (error) {
    console.error('Word export error:', error)
    return NextResponse.json({ error: 'Ошибка генерации Word' }, { status: 500 })
  }
}

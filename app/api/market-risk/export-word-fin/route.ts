import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const borders = { top: b, bottom: b, left: b, right: b }
const bGreen = { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' }
const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }
const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct = (n: number) => n ? `${n.toFixed(1)}%` : '—'

const cell = (text: string, opts: { green?: boolean; gray?: boolean; bold?: boolean; center?: boolean; color?: string; bg?: string } = {}) =>
  new TableCell({
    borders, verticalAlign: VerticalAlign.CENTER,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR }
      : opts.green ? { fill: 'E8F4E8', type: ShadingType.CLEAR }
      : opts.gray ? { fill: 'F5F5F5', type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? '—'), size: 20, bold: !!opts.bold, color: opts.color ?? '000000', font: 'Times New Roman' })]
    })]
  })

const para = (text: string, opts: { bold?: boolean; size?: number; center?: boolean; after?: number; before?: number; color?: string; indent?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
    indent: opts.indent ? { firstLine: 360 } : undefined,
    children: [new TextRun({ text: String(text ?? ''), size: opts.size ?? 22, bold: !!opts.bold, color: opts.color ?? '000000', font: 'Times New Roman' })]
  })

const sectionHead = (num: string, title: string) => new Paragraph({
  spacing: { before: 240, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' } },
  children: [
    new TextRun({ text: `${num}. `, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
    new TextRun({ text: title, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
  ]
})

const tableRow = (label: string, v1: number, v2: number, bold = false) => {
  const trend = v1 && v2 ? ((v2 - v1) / Math.abs(v1) * 100) : 0
  const trendText = v1 && v2 ? (trend > 0 ? ` ▲ +${trend.toFixed(1)}%` : ` ▼ ${trend.toFixed(1)}%`) : ''
  const trendColor = trend > 0 ? '1B8A4C' : trend < 0 ? 'C00000' : '555555'
  return new TableRow({ children: [
    cell(label, { green: bold, bold }),
    cell(fmt(v1), { center: true, bold }),
    cell(fmt(v2), { center: true, bold }),
    new TableCell({
      borders, margins: { top: 70, bottom: 70, left: 120, right: 120 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: trendText || '—', size: 18, color: trendColor, font: 'Times New Roman' })
      ]})]
    }),
  ]})
}

export async function POST(request: Request) {
  try {
    const { analysis: a } = await request.json()
    const today = a.created_at ? new Date(a.created_at).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')

    const p1_total_assets = (a.p1_cash||0) + (a.p1_receivables||0) + (a.p1_investments||0) + (a.p1_loans_issued||0) + (a.p1_fixed_assets||0) + (a.p1_other_assets||0)
    const p2_total_assets = (a.p2_cash||0) + (a.p2_receivables||0) + (a.p2_investments||0) + (a.p2_loans_issued||0) + (a.p2_fixed_assets||0) + (a.p2_other_assets||0)
    const p1_total_liab = (a.p1_deposits||0) + (a.p1_borrowings||0) + (a.p1_other_liab||0)
    const p2_total_liab = (a.p2_deposits||0) + (a.p2_borrowings||0) + (a.p2_other_liab||0)
    const p1_nim = (a.p1_interest_income||0) - (a.p1_interest_expense||0)
    const p2_nim = (a.p2_interest_income||0) - (a.p2_interest_expense||0)
    const p1_op_income = p1_nim + (a.p1_fee_income||0)
    const p2_op_income = p2_nim + (a.p2_fee_income||0)
    const p1_car = p1_total_assets > 0 ? (a.p1_equity / p1_total_assets * 100) : 0
    const p2_car = p2_total_assets > 0 ? (a.p2_equity / p2_total_assets * 100) : 0
    const p1_roe = a.p1_equity > 0 ? (a.p1_net_profit / a.p1_equity * 100) : 0
    const p2_roe = a.p2_equity > 0 ? (a.p2_net_profit / a.p2_equity * 100) : 0

    const conclusionParagraphs = (a.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
      const text = line.trim()
      if (/^\d+\./.test(text)) {
        return new Paragraph({
          spacing: { before: 180, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
          children: [new TextRun({ text, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
        })
      }
      return new Paragraph({
        alignment: AlignmentType.BOTH, spacing: { after: 80 }, indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
      })
    })

    const colWidths = [3800, 2200, 2200, 1154]
    const displayCurr = (a.currency && a.currency !== 'USD') ? a.currency : 'USD'
    const headerRow = new TableRow({ children: [
      cell(`Показатель (тыс. ${displayCurr})`, { green: true, bold: true }),
      cell(`${a.p1_label || 'Период 1'} (тыс.)`, { green: true, bold: true, center: true }),
      cell(`${a.p2_label || 'Период 2'} (тыс.)`, { green: true, bold: true, center: true }),
      cell('Динамика', { green: true, bold: true, center: true }),
    ]})

    const doc = new Document({
      numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          para('ҶСК «Алиф Бонк»', { bold: true, size: 30, center: true, after: 40 }),
          para('Служба управления рисками', { size: 20, center: true, after: 40, color: '555555' }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [9354],
            rows: [new TableRow({ children: [new TableCell({
              borders: { top: nob, left: nob, right: nob, bottom: bGreen },
              children: [new Paragraph({ children: [] })]
            })] })]
          }),
          para('', { after: 100 }),
          para('ФИНАНСОВЫЙ АНАЛИЗ КОНТРАГЕНТА', { bold: true, size: 28, center: true, after: 40 }),
          para(`Дата составления: ${today}`, { size: 20, center: true, after: 300, color: '555555' }),

          sectionHead('1', 'ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [cell('Код контрагента', { green: true, bold: true }), cell(a.code || '—', { bold: true })] }),
              new TableRow({ children: [cell('Аналитик', { green: true }), cell(a.analyst_name || '—')] }),
              new TableRow({ children: [cell('Анализируемые периоды', { green: true }), cell(`${a.p1_label || 'Период 1'} → ${a.p2_label || 'Период 2'}`)] }),
              new TableRow({ children: [cell('Дата анализа', { green: true }), cell(today)] }),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('2', 'БАЛАНСОВЫЕ ПОКАЗАТЕЛИ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: colWidths,
            rows: [
              headerRow,
              tableRow('Денежные средства', a.p1_cash||0, a.p2_cash||0),
              tableRow('Средства в банках', a.p1_receivables||0, a.p2_receivables||0),
              tableRow('Инвестиционные ценные бумаги', a.p1_investments||0, a.p2_investments||0),
              tableRow('Кредитный портфель (нетто)', a.p1_loans_issued||0, a.p2_loans_issued||0),
              tableRow('Основные средства', a.p1_fixed_assets||0, a.p2_fixed_assets||0),
              tableRow('Прочие активы', a.p1_other_assets||0, a.p2_other_assets||0),
              tableRow('ИТОГО АКТИВ', p1_total_assets, p2_total_assets, true),
              tableRow('Депозиты клиентов', a.p1_deposits||0, a.p2_deposits||0),
              tableRow('Заёмные средства', a.p1_borrowings||0, a.p2_borrowings||0),
              tableRow('Прочие обязательства', a.p1_other_liab||0, a.p2_other_liab||0),
              tableRow('Итого обязательства', p1_total_liab, p2_total_liab, true),
              tableRow('Собственный капитал', a.p1_equity||0, a.p2_equity||0, true),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('3', 'ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: colWidths,
            rows: [
              headerRow,
              tableRow('Процентные доходы', a.p1_interest_income||0, a.p2_interest_income||0),
              tableRow('Процентные расходы', a.p1_interest_expense||0, a.p2_interest_expense||0),
              tableRow('Чистый процентный доход (NIM)', p1_nim, p2_nim, true),
              tableRow('Комиссионные доходы', a.p1_fee_income||0, a.p2_fee_income||0),
              tableRow('Доход от FX операций', a.p1_fx_income||0, a.p2_fx_income||0),
              tableRow('Прочие операционные доходы', a.p1_other_income||0, a.p2_other_income||0),
              tableRow('Операционный доход', p1_op_income, p2_op_income, true),
              tableRow('Операционные расходы', a.p1_operating_expense||0, a.p2_operating_expense||0),
              tableRow('Резервы на потери', a.p1_provisions||0, a.p2_provisions||0),
              tableRow('Чистая прибыль', a.p1_net_profit||0, a.p2_net_profit||0, true),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('4', 'КЛЮЧЕВЫЕ КОЭФФИЦИЕНТЫ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3800, 2200, 2200, 1154],
            rows: [
              new TableRow({ children: [
                cell('Коэффициент', { green: true, bold: true }),
                cell(a.p1_label || 'Период 1', { green: true, bold: true, center: true }),
                cell(a.p2_label || 'Период 2', { green: true, bold: true, center: true }),
                cell('Норма', { green: true, bold: true, center: true }),
              ]}),
              new TableRow({ children: [
                cell('CAR (достаточность капитала)'),
                cell(pct(p1_car), { center: true, color: p1_car >= 13 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_car), { center: true, bold: true, color: p2_car >= 13 ? '1B8A4C' : 'C00000' }),
                cell('≥ 13%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('ROE (рентабельность капитала)'),
                cell(pct(p1_roe), { center: true, color: p1_roe >= 10 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_roe), { center: true, bold: true, color: p2_roe >= 10 ? '1B8A4C' : 'C00000' }),
                cell('≥ 10%', { center: true, color: '555555' }),
              ]}),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('5', 'ЗАКЛЮЧЕНИЕ И ВЫВОДЫ'),
          ...conclusionParagraphs,
          para('', { after: 60 }),
          para(`* Все суммы в таблицах указаны в тысячах ${(a.currency && a.currency !== 'USD') ? a.currency + '. Конвертация в USD выполнена по курсам периодов.' : 'долларов США (USD).'}`, { size: 18, color: '888888', after: 240 }),

          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [
                para('Аналитик: _________________', { after: 60 }),
                para(a.analyst_name ? `(${a.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0, color: '555555' }),
              ]}),
              new TableCell({ borders: noborders, children: [
                para(`г. Душанбе, ${today}`, { center: true, after: 0, color: '555555' }),
              ]}),
            ]})]
          }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="FinAnalysis.docx"',
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка Word: ' + String(error) }, { status: 500 })
  }
}

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
const fmt = (n: number) => (n || n === 0) ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct = (n: number) => isFinite(n) && !isNaN(n) && n !== 0 ? `${n.toFixed(1)}%` : '—'
const div = (a: number, b: number) => b !== 0 ? a / b : 0

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

const tableRow = (label: string, v1: number, v2: number, bold = false, isDeduction = false) => {
  const trend = v1 && v2 ? ((v2 - v1) / Math.abs(v1) * 100) : 0
  const trendText = v1 && v2 ? (trend > 0 ? ` ▲ +${trend.toFixed(1)}%` : ` ▼ ${trend.toFixed(1)}%`) : ''
  const trendColor = trend > 0 ? '1B8A4C' : trend < 0 ? 'C00000' : '555555'
  const disp1 = isDeduction ? `(${fmt(v1)})` : fmt(v1)
  const disp2 = isDeduction ? `(${fmt(v2)})` : fmt(v2)
  return new TableRow({ children: [
    cell(label, { green: bold, bold }),
    cell(disp1, { center: true, bold }),
    cell(disp2, { center: true, bold }),
    new TableCell({
      borders, margins: { top: 70, bottom: 70, left: 120, right: 120 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: trendText || '—', size: 18, color: trendColor, font: 'Times New Roman' })
      ]})]
    }),
  ]})
}

const subheadRow = (label: string) => new TableRow({ children: [
  new TableCell({
    borders, columnSpan: 4,
    shading: { fill: 'D6EFE3', type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: [new Paragraph({ children: [
      new TextRun({ text: label, size: 19, bold: true, color: '1B8A4C', font: 'Times New Roman' })
    ]})]
  })
]})

export async function POST(request: Request) {
  try {
    const { analysis: a } = await request.json()
    const today = a.created_at ? new Date(a.created_at).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')

    // Reconstruct totals from legacy DB columns
    const p1_total_assets = (a.p1_cash||0) + (a.p1_receivables||0) + (a.p1_investments||0) + (a.p1_loans_issued||0) + (a.p1_fixed_assets||0) + (a.p1_other_assets||0)
    const p2_total_assets = (a.p2_cash||0) + (a.p2_receivables||0) + (a.p2_investments||0) + (a.p2_loans_issued||0) + (a.p2_fixed_assets||0) + (a.p2_other_assets||0)
    const p1_total_liab = (a.p1_deposits||0) + (a.p1_borrowings||0) + (a.p1_other_liab||0)
    const p2_total_liab = (a.p2_deposits||0) + (a.p2_borrowings||0) + (a.p2_other_liab||0)
    const p1_nim = (a.p1_interest_income||0) - (a.p1_interest_expense||0)
    const p2_nim = (a.p2_interest_income||0) - (a.p2_interest_expense||0)
    const p1_op_income = p1_nim + (a.p1_fee_income||0) + (a.p1_fx_income||0) + (a.p1_other_income||0)
    const p2_op_income = p2_nim + (a.p2_fee_income||0) + (a.p2_fx_income||0) + (a.p2_other_income||0)

    // Computed ratios (USD, aggregated)
    const toUSD1 = (v: number) => a.currency !== 'USD' && (a.p1_usd_rate||1) > 0 ? v / (a.p1_usd_rate||1) : v
    const toUSD2 = (v: number) => a.currency !== 'USD' && (a.p2_usd_rate||1) > 0 ? v / (a.p2_usd_rate||1) : v
    const p1a_u = toUSD1(p1_total_assets), p2a_u = toUSD2(p2_total_assets)
    const p1l_u = toUSD1(p1_total_liab), p2l_u = toUSD2(p2_total_liab)
    const p1e_u = toUSD1(a.p1_equity||0), p2e_u = toUSD2(a.p2_equity||0)
    const p1np_u = toUSD1(a.p1_net_profit||0), p2np_u = toUSD2(a.p2_net_profit||0)
    const p1nim_u = toUSD1(p1_nim), p2nim_u = toUSD2(p2_nim)
    const p1opex_u = toUSD1(a.p1_operating_expense||0), p2opex_u = toUSD2(a.p2_operating_expense||0)
    const p1opi_u = toUSD1(p1_op_income), p2opi_u = toUSD2(p2_op_income)
    // Liquid assets: cash + receivables (due_banks) + investments (FVTPL+FVOCI+HTM)
    const p1liq_u = toUSD1((a.p1_cash||0) + (a.p1_receivables||0) + (a.p1_investments||0))
    const p2liq_u = toUSD2((a.p2_cash||0) + (a.p2_receivables||0) + (a.p2_investments||0))

    const p1_car = div(p1e_u, p1a_u) * 100
    const p2_car = div(p2e_u, p2a_u) * 100
    const p1_roe = div(p1np_u, p1e_u) * 100
    const p2_roe = div(p2np_u, p2e_u) * 100
    const p1_roa = div(p1np_u, p1a_u) * 100
    const p2_roa = div(p2np_u, p2a_u) * 100
    const p1_nim_pct = div(p1nim_u, p1a_u) * 100
    const p2_nim_pct = div(p2nim_u, p2a_u) * 100
    const p1_liq = div(p1liq_u, p1l_u) * 100
    const p2_liq = div(p2liq_u, p2l_u) * 100
    const p1_cir = div(p1opex_u, p1opi_u) * 100
    const p2_cir = div(p2opex_u, p2opi_u) * 100

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

    const colWidths = [3800, 2100, 2100, 1354]
    const displayCurr = (a.currency && a.currency !== 'USD') ? a.currency : 'USD'

    const headerRow = new TableRow({ children: [
      cell(`Показатель (тыс. ${displayCurr})`, { green: true, bold: true }),
      cell(`${a.p1_label || 'Период 1'}`, { green: true, bold: true, center: true }),
      cell(`${a.p2_label || 'Период 2'}`, { green: true, bold: true, center: true }),
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
          para('ФИНАНСОВЫЙ АНАЛИЗ КОНТРАГЕНТА — МСФО (IFRS)', { bold: true, size: 28, center: true, after: 40 }),
          para(`Стандарты: МСФО (IFRS 9 · IFRS 16 · IAS 1)  |  Дата составления: ${today}`, { size: 19, center: true, after: 300, color: '555555' }),

          sectionHead('1', 'ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [cell('Код контрагента', { green: true, bold: true }), cell(a.code || '—', { bold: true })] }),
              new TableRow({ children: [cell('Тип контрагента', { green: true }), cell(a.counterparty_type || 'Банк')] }),
              new TableRow({ children: [cell('Аналитик', { green: true }), cell(a.analyst_name || '—')] }),
              new TableRow({ children: [cell('Анализируемые периоды', { green: true }), cell(`${a.p1_label || 'Период 1'} → ${a.p2_label || 'Период 2'}`)] }),
              new TableRow({ children: [cell('Валюта отчётности', { green: true }), cell(displayCurr + (a.currency !== 'USD' ? ` (П1: 1 USD = ${a.p1_usd_rate||1} ${displayCurr}, П2: 1 USD = ${a.p2_usd_rate||1} ${displayCurr})` : ''))] }),
              new TableRow({ children: [cell('Дата анализа', { green: true }), cell(today)] }),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('2', 'ОТЧЁТ О ФИНАНСОВОМ ПОЛОЖЕНИИ (МСФО IAS 1)'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: colWidths,
            rows: [
              headerRow,
              subheadRow('АКТИВЫ'),
              tableRow('Денежные средства и счета в ЦБ/НБТ', a.p1_cash||0, a.p2_cash||0),
              tableRow('Средства в банках (МБК, ностро)', a.p1_receivables||0, a.p2_receivables||0),
              tableRow('Портфель цен. бумаг (FVTPL+FVOCI+HTM)', a.p1_investments||0, a.p2_investments||0),
              tableRow('Кредитный портфель, нетто (IFRS 9 ECL)', a.p1_loans_issued||0, a.p2_loans_issued||0),
              tableRow('ОС, НМА, активы ПП (PP&E+ROU IFRS 16)', a.p1_fixed_assets||0, a.p2_fixed_assets||0),
              tableRow('Прочие активы', a.p1_other_assets||0, a.p2_other_assets||0),
              tableRow('ИТОГО АКТИВЫ', p1_total_assets, p2_total_assets, true),
              subheadRow('ОБЯЗАТЕЛЬСТВА'),
              tableRow('Средства клиентов и депозиты', a.p1_deposits||0, a.p2_deposits||0),
              tableRow('МБК, ЦБ, долговые ЦБ, суборд. долг', a.p1_borrowings||0, a.p2_borrowings||0),
              tableRow('Прочие обязательства (+ IFRS 16)', a.p1_other_liab||0, a.p2_other_liab||0),
              tableRow('ИТОГО ОБЯЗАТЕЛЬСТВА', p1_total_liab, p2_total_liab, true),
              subheadRow('КАПИТАЛ'),
              tableRow('Собственный капитал', a.p1_equity||0, a.p2_equity||0, true),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('3', 'ОТЧЁТ О СОВОКУПНОМ ДОХОДЕ (МСФО IAS 1 / IFRS 9)'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: colWidths,
            rows: [
              headerRow,
              tableRow('Процентные доходы (ЭПС / EIR)', a.p1_interest_income||0, a.p2_interest_income||0),
              tableRow('Процентные расходы', a.p1_interest_expense||0, a.p2_interest_expense||0),
              tableRow('ЧИСТЫЙ ПРОЦЕНТНЫЙ ДОХОД (NIM)', p1_nim, p2_nim, true),
              tableRow('Комиссионные доходы', a.p1_fee_income||0, a.p2_fee_income||0),
              tableRow('Торговый доход + FX операции', a.p1_fx_income||0, a.p2_fx_income||0),
              tableRow('Прочие операционные доходы', a.p1_other_income||0, a.p2_other_income||0),
              tableRow('ИТОГО ОПЕРАЦИОННЫЙ ДОХОД', p1_op_income, p2_op_income, true),
              tableRow('Расходы на ОКУ (ECL charge IFRS 9)', a.p1_provisions||0, a.p2_provisions||0),
              tableRow('Операционные расходы (CIR)', a.p1_operating_expense||0, a.p2_operating_expense||0),
              tableRow('ЧИСТАЯ ПРИБЫЛЬ', a.p1_net_profit||0, a.p2_net_profit||0, true),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('4', 'КЛЮЧЕВЫЕ КОЭФФИЦИЕНТЫ МСФО'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3800, 1500, 1500, 1400, 1154],
            rows: [
              new TableRow({ children: [
                cell('Коэффициент (в долл. США)', { green: true, bold: true }),
                cell(a.p1_label || 'Период 1', { green: true, bold: true, center: true }),
                cell(a.p2_label || 'Период 2', { green: true, bold: true, center: true }),
                cell('Формула', { green: true, bold: true, center: true }),
                cell('Норма', { green: true, bold: true, center: true }),
              ]}),
              new TableRow({ children: [
                cell('CAR — достаточность капитала'),
                cell(pct(p1_car), { center: true, color: p1_car >= 13 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_car), { center: true, bold: true, color: p2_car >= 13 ? '1B8A4C' : 'C00000' }),
                cell('Капитал / Активы', { center: true, color: '555555' }),
                cell('≥ 13%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('ROE — рентабельность капитала'),
                cell(pct(p1_roe), { center: true, color: p1_roe >= 10 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_roe), { center: true, bold: true, color: p2_roe >= 10 ? '1B8A4C' : 'C00000' }),
                cell('Прибыль / Капитал', { center: true, color: '555555' }),
                cell('≥ 10%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('ROA — рентабельность активов'),
                cell(pct(p1_roa), { center: true, color: p1_roa >= 1 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_roa), { center: true, bold: true, color: p2_roa >= 1 ? '1B8A4C' : 'C00000' }),
                cell('Прибыль / Активы', { center: true, color: '555555' }),
                cell('≥ 1%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('NIM% — чистая процентная маржа'),
                cell(pct(p1_nim_pct), { center: true, color: p1_nim_pct >= 3 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_nim_pct), { center: true, bold: true, color: p2_nim_pct >= 3 ? '1B8A4C' : 'C00000' }),
                cell('NIM / Активы', { center: true, color: '555555' }),
                cell('≥ 3%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('Ликвидность (норматив НБТ)'),
                cell(pct(p1_liq), { center: true, color: p1_liq >= 30 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_liq), { center: true, bold: true, color: p2_liq >= 30 ? '1B8A4C' : 'C00000' }),
                cell('Ликв. активы / Обяз.', { center: true, color: '555555' }),
                cell('≥ 30%', { center: true, color: '555555' }),
              ]}),
              new TableRow({ children: [
                cell('Cost-to-Income (CIR)'),
                cell(pct(p1_cir), { center: true, color: p1_cir <= 60 ? '1B8A4C' : 'C00000' }),
                cell(pct(p2_cir), { center: true, bold: true, color: p2_cir <= 60 ? '1B8A4C' : 'C00000' }),
                cell('Опер. расх. / Опер. доход', { center: true, color: '555555' }),
                cell('< 60%', { center: true, color: '555555' }),
              ]}),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('5', 'ЗАКЛЮЧЕНИЕ И ВЫВОДЫ ИИ'),
          ...conclusionParagraphs,
          para('', { after: 60 }),
          para(`* Все суммы в таблицах указаны в тысячах ${displayCurr}. Коэффициенты рассчитаны в USD.${a.currency !== 'USD' ? ` Курс: П1: 1 USD = ${a.p1_usd_rate||1} ${displayCurr}; П2: 1 USD = ${a.p2_usd_rate||1} ${displayCurr}.` : ''}`, { size: 18, color: '888888', after: 240 }),

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
        'Content-Disposition': 'attachment; filename="FinAnalysis_IFRS.docx"',
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка Word: ' + String(error) }, { status: 500 })
  }
}

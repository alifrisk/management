import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

type CellOpts = { gray?: boolean; bold?: boolean; center?: boolean; colSpan?: number }
type ParaOpts = { bold?: boolean; size?: number; center?: boolean; after?: number }

const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const borders = { top: b, bottom: b, left: b, right: b }
const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const makeCell = (text: string, opts: CellOpts = {}) =>
  new TableCell({
    borders,
    columnSpan: opts.colSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.gray ? { fill: 'E8F4E8', type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text || '—'), size: 18, bold: !!opts.bold, font: 'Times New Roman' })]
    })]
  })

const makePara = (text: string, opts: ParaOpts = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    spacing: { after: opts.after ?? 120, line: 276 },
    children: [new TextRun({ text: String(text || ''), size: opts.size ?? 22, bold: !!opts.bold, font: 'Times New Roman' })]
  })

const makeSection = (title: string) =>
  new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: title, size: 24, bold: true, font: 'Times New Roman' })]
  })

const makeFinTable = (
  title: string,
  rows: [string, number, number][],
  totals: [string, number, number][] = [],
  p1: string,
  p2: string,
  fmt: (v: number) => string
) => [
  makeSection(title),
  new Table({
    width: { size: 9354, type: WidthType.DXA },
    columnWidths: [5000, 2177, 2177],
    rows: [
      new TableRow({ children: [makeCell('Показатель', { gray: true, bold: true }), makeCell(p1, { gray: true, bold: true, center: true }), makeCell(p2, { gray: true, bold: true, center: true })] }),
      ...rows.map(([label, v1, v2]) => new TableRow({ children: [makeCell(label), makeCell(fmt(v1), { center: true }), makeCell(fmt(v2), { center: true })] })),
      ...totals.map(([label, v1, v2]) => new TableRow({ children: [makeCell(label, { bold: true, gray: true }), makeCell(fmt(v1), { bold: true, center: true }), makeCell(fmt(v2), { bold: true, center: true })] })),
    ]
  }),
  makePara('', { after: 80 }),
]

export async function POST(request: Request) {
  try {
    const { conclusion: c } = await request.json()

    const fmt = (v: number) => (v || v === 0) ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
    const today = new Date().toLocaleDateString('ru-RU')
    const p1 = c.p1_label || 'Период 1'
    const p2 = c.p2_label || 'Период 2'

    const p1a = (c.p1_cash||0)+(c.p1_receivables||0)+(c.p1_inventory||0)+(c.p1_fixed_assets||0)+(c.p1_other_assets||0)
    const p2a = (c.p2_cash||0)+(c.p2_receivables||0)+(c.p2_inventory||0)+(c.p2_fixed_assets||0)+(c.p2_other_assets||0)
    const p1l = (c.p1_supplier_debt||0)+(c.p1_bank_debt||0)+(c.p1_other_liabilities||0)
    const p2l = (c.p2_supplier_debt||0)+(c.p2_bank_debt||0)+(c.p2_other_liabilities||0)
    const p1e = (c.p1_equity_capital||0)+(c.p1_reserves||0)+(c.p1_retained_earnings||0)
    const p2e = (c.p2_equity_capital||0)+(c.p2_reserves||0)+(c.p2_retained_earnings||0)

    // Parse collaterals safely
    let collaterals: {type: string; description: string; value: number}[] = []
    if (Array.isArray(c.collaterals)) {
      collaterals = c.collaterals
    } else if (typeof c.collaterals === 'string') {
      try { collaterals = JSON.parse(c.collaterals) } catch { collaterals = [] }
    }
    const totalCollateral = collaterals.reduce((s, col) => s + (col.value || 0), 0)

    // Monthly payment (annuity) calculation
    const loanAmt = c.loan_amount || 0
    const rate = (c.interest_rate || 0) / 100 / 12
    const months = parseInt(c.loan_term_months || c.loan_term) || 12
    const monthlyPayment = rate > 0 ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months))) : Math.round(loanAmt / months)

    const conclusionParagraphs = (c.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
      const text = line.trim()
      const isHeader = /^\d+\./.test(text)
      const isBullet = text.startsWith('-') || text.startsWith('•')
      
      if (isHeader) {
        return new Paragraph({
          spacing: { before: 200, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
          children: [new TextRun({ text, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
        })
      }
      if (isBullet) {
        return new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          alignment: AlignmentType.BOTH,
          children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
        })
      }
      return new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.BOTH,
        indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
      })
    })

    const doc = new Document({
      numbering: {
        config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }]
      },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          // Шапка
          makePara('ҶСК «Алиф Бонк»', { bold: true, size: 28, center: true, after: 40 }),
          makePara('Служба управления рисками', { size: 20, center: true, after: 200 }),
          makePara('ЗАКЛЮЧЕНИЕ О КРЕДИТОСПОСОБНОСТИ', { bold: true, size: 28, center: true, after: 40 }),
          makePara('Субъект малого и среднего бизнеса (SME)', { size: 20, center: true, after: 40 }),
          makePara(`Дата составления: ${today}`, { size: 20, center: true, after: 300 }),

          // 1. Параметры заявки
          makeSection('1. ПАРАМЕТРЫ КРЕДИТНОЙ ЗАЯВКИ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [makeCell('Наименование заёмщика', { gray: true, bold: true }), makeCell(c.borrower_name || '—')] }),
              new TableRow({ children: [makeCell('ИНН', { gray: true, bold: true }), makeCell(c.borrower_inn || '—')] }),
              new TableRow({ children: [makeCell('Вид деятельности', { gray: true, bold: true }), makeCell(c.business_type || '—')] }),
              new TableRow({ children: [makeCell('Лет в бизнесе', { gray: true, bold: true }), makeCell(String(c.years_in_business || '—'))] }),
              new TableRow({ children: [makeCell('Сумма кредита', { gray: true, bold: true }), makeCell(`${fmt(c.loan_amount)} ${c.loan_currency || 'TJS'}`)] }),
              new TableRow({ children: [makeCell('Срок кредита', { gray: true, bold: true }), makeCell(c.loan_term || '—')] }),
              new TableRow({ children: [makeCell('Процентная ставка', { gray: true, bold: true }), makeCell(c.interest_rate ? `${c.interest_rate}% годовых` : '—')] }),
              new TableRow({ children: [makeCell('Ежемесячный платёж (аннуитет)', { gray: true, bold: true }), makeCell(c.interest_rate ? `${fmt(monthlyPayment)} TJS` : '—')] }),
              new TableRow({ children: [makeCell('Цель кредита', { gray: true, bold: true }), makeCell(c.loan_purpose || '—')] }),
              new TableRow({ children: [makeCell('Кредитная история', { gray: true, bold: true }), makeCell(c.credit_history || '—')] }),
              new TableRow({ children: [makeCell('Аналитик', { gray: true, bold: true }), makeCell(c.analyst_name || '—')] }),
            ]
          }),
          makePara('', { after: 80 }),

          // 2. Баланс
          ...makeFinTable('2. ФИНАНСОВОЕ ПОЛОЖЕНИЕ (БАЛАНС)', [
            ['Денежные средства', c.p1_cash||0, c.p2_cash||0],
            ['Дебиторская задолженность', c.p1_receivables||0, c.p2_receivables||0],
            ['ТМЗ (запасы)', c.p1_inventory||0, c.p2_inventory||0],
            ['Основные средства', c.p1_fixed_assets||0, c.p2_fixed_assets||0],
            ['Прочие активы', c.p1_other_assets||0, c.p2_other_assets||0],
            ['ИТОГО АКТИВ', p1a, p2a],
            ['Долги поставщикам', c.p1_supplier_debt||0, c.p2_supplier_debt||0],
            ['Долги банкам', c.p1_bank_debt||0, c.p2_bank_debt||0],
            ['Прочие обязательства', c.p1_other_liabilities||0, c.p2_other_liabilities||0],
            ['ИТОГО ОБЯЗАТЕЛЬСТВА', p1l, p2l],
          ], [['КАПИТАЛ', p1e, p2e]], p1, p2, fmt),

          // 3. ОПУ
          ...makeFinTable('3. ФИНАНСОВЫЕ РЕЗУЛЬТАТЫ (ОПУ)', [
            ['Выручка от реализации', c.p1_revenue||0, c.p2_revenue||0],
            ['Себестоимость', c.p1_cogs||0, c.p2_cogs||0],
            ['Валовая прибыль', (c.p1_revenue||0)-(c.p1_cogs||0), (c.p2_revenue||0)-(c.p2_cogs||0)],
            ['Торговые расходы', c.p1_sales_expense||0, c.p2_sales_expense||0],
            ['Административные расходы', c.p1_admin_expense||0, c.p2_admin_expense||0],
            ['Прочие операционные доходы', c.p1_other_op_income||0, c.p2_other_op_income||0],
            ['Операционная прибыль', (c.p1_revenue||0)-(c.p1_cogs||0)-(c.p1_sales_expense||0)-(c.p1_admin_expense||0)+(c.p1_other_op_income||0), (c.p2_revenue||0)-(c.p2_cogs||0)-(c.p2_sales_expense||0)-(c.p2_admin_expense||0)+(c.p2_other_op_income||0)],
            ['Прочие внеоперац. доходы/(расходы)', c.p1_non_op||0, c.p2_non_op||0],
            ['Прибыль до налогообложения', (c.p1_revenue||0)-(c.p1_cogs||0)-(c.p1_sales_expense||0)-(c.p1_admin_expense||0)+(c.p1_other_op_income||0)+(c.p1_non_op||0), (c.p2_revenue||0)-(c.p2_cogs||0)-(c.p2_sales_expense||0)-(c.p2_admin_expense||0)+(c.p2_other_op_income||0)+(c.p2_non_op||0)],
            ['Налог на прибыль', c.p1_tax||0, c.p2_tax||0],
          ], [['Чистая прибыль', c.p1_net_profit||0, c.p2_net_profit||0]], p1, p2, fmt),

          // 4. ОДДС
          ...makeFinTable('4. ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС)', [
            ['Остаток на начало периода', c.p1_cash_begin||0, c.p2_cash_begin||0],
            ['Операционная деятельность (нетто)', (c.p1_op_inflow||0)-(c.p1_op_outflow||0), (c.p2_op_inflow||0)-(c.p2_op_outflow||0)],
            ['Финансовая деятельность (нетто)', (c.p1_fin_inflow||0)-(c.p1_fin_outflow||0), (c.p2_fin_inflow||0)-(c.p2_fin_outflow||0)],
            ['Инвест. деятельность (нетто)', (c.p1_inv_inflow||0)-(c.p1_inv_outflow||0), (c.p2_inv_inflow||0)-(c.p2_inv_outflow||0)],
          ], [['Остаток на конец периода', c.p1_cash_end||0, c.p2_cash_end||0]], p1, p2, fmt),

          // 5. Ключевые коэффициенты
          makeSection('5. КЛЮЧЕВЫЕ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ'),
          (() => {
            const p1rev = c.p1_revenue || 0
            const p2rev = c.p2_revenue || 0
            const p1profit = c.p1_net_profit || 0
            const p2profit = c.p2_net_profit || 0
            const p1liab = (c.p1_supplier_debt||0)+(c.p1_bank_debt||0)+(c.p1_other_liabilities||0)
            const p2liab = (c.p2_supplier_debt||0)+(c.p2_bank_debt||0)+(c.p2_other_liabilities||0)
            const p1assets = (c.p1_cash||0)+(c.p1_receivables||0)+(c.p1_inventory||0)+(c.p1_fixed_assets||0)+(c.p1_other_assets||0)
            const p2assets = (c.p2_cash||0)+(c.p2_receivables||0)+(c.p2_inventory||0)+(c.p2_fixed_assets||0)+(c.p2_other_assets||0)
            const p1equity = (c.p1_equity_capital||0)+(c.p1_reserves||0)+(c.p1_retained_earnings||0)
            const p2equity = (c.p2_equity_capital||0)+(c.p2_reserves||0)+(c.p2_retained_earnings||0)
            const p1op = (c.p1_op_inflow||0)-(c.p1_op_outflow||0)
            const p2op = (c.p2_op_inflow||0)-(c.p2_op_outflow||0)
            const loanAmt = c.loan_amount || 0
            const rate = (c.interest_rate || 0) / 100 / 12
            const months = c.loan_term_months || 12
            const monthlyPayment = rate > 0 ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months))) : Math.round(loanAmt / months)
            const debtServiceP1 = p1op > 0 ? (monthlyPayment * 12 / p1op * 100).toFixed(1) + '%' : '—'
            const debtServiceP2 = p2op > 0 ? (monthlyPayment * 12 / p2op * 100).toFixed(1) + '%' : '—'

            const ratios: [string, string, string, string][] = [
              ['Рентабельность продаж', p1rev > 0 ? (p1profit/p1rev*100).toFixed(1)+'%' : '—', p2rev > 0 ? (p2profit/p2rev*100).toFixed(1)+'%' : '—', 'Норма: >5%'],
              ['Долговая нагрузка (Обяз/Актив)', p1assets > 0 ? (p1liab/p1assets*100).toFixed(1)+'%' : '—', p2assets > 0 ? (p2liab/p2assets*100).toFixed(1)+'%' : '—', 'Норма: <70%'],
              ['Коэффициент автономии (Кап/Актив)', p1assets > 0 ? (p1equity/p1assets*100).toFixed(1)+'%' : '—', p2assets > 0 ? (p2equity/p2assets*100).toFixed(1)+'%' : '—', 'Норма: >30%'],
              ['Покрытие долга опер. потоком', p1liab > 0 ? (p1op/p1liab).toFixed(2) : '—', p2liab > 0 ? (p2op/p2liab).toFixed(2) : '—', 'Норма: >1'],
              ['Долговая нагрузка по платежу', debtServiceP1, debtServiceP2, 'Норма: <40% от потока'],
              ['Покрытие залогом (Залог/Кредит)', totalCollateral > 0 && loanAmt > 0 ? (totalCollateral/loanAmt*100).toFixed(1)+'%' : '—', '—', 'Норма: >120%'],
            ]

            return new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [3200, 1800, 1800, 2554],
              rows: [
                new TableRow({ children: [
                  makeCell('Коэффициент', { gray: true, bold: true }),
                  makeCell(p1, { gray: true, bold: true, center: true }),
                  makeCell(p2, { gray: true, bold: true, center: true }),
                  makeCell('Норматив', { gray: true, bold: true, center: true }),
                ]}),
                ...ratios.map(([label, v1, v2, norm]) => new TableRow({ children: [
                  makeCell(label),
                  makeCell(v1, { center: true }),
                  makeCell(v2, { center: true }),
                  makeCell(norm, { center: true }),
                ]})),
              ]
            })
          })(),
          makePara('', { after: 80 }),

          // 6. Залоги
          makeSection('6. ОБЕСПЕЧЕНИЕ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [450, 2500, 4000, 2404],
            rows: [
              new TableRow({ children: [
                makeCell('№', { gray: true, bold: true, center: true }),
                makeCell('Тип залога', { gray: true, bold: true }),
                makeCell('Описание', { gray: true, bold: true }),
                makeCell('Стоимость (TJS)', { gray: true, bold: true, center: true }),
              ]}),
              ...(collaterals.length > 0 ? collaterals.map((col, i) =>
                new TableRow({ children: [
                  makeCell(String(i+1), { center: true }),
                  makeCell(col.type || '—'),
                  makeCell(col.description || '—'),
                  makeCell(fmt(col.value), { center: true }),
                ]})
              ) : [new TableRow({ children: [makeCell('Залог не указан', { colSpan: 4 })] })]),
              new TableRow({ children: [
                new TableCell({ borders, columnSpan: 3, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: 'ИТОГО', size: 18, bold: true, font: 'Times New Roman' })] })] }),
                makeCell(fmt(totalCollateral), { bold: true, center: true }),
              ]}),
            ]
          }),
          makePara('', { after: 80 }),

          // 6. Заключение AI
          makeSection('7. ЗАКЛЮЧЕНИЕ СЛУЖБЫ УПРАВЛЕНИЯ РИСКАМИ'),
          ...conclusionParagraphs,
          makePara('', { after: 120 }),

          // Рекомендация
          (() => {
            const recColor = c.recommendation?.includes('Отклонить') ? 'C00000' : c.recommendation?.includes('Условно') ? 'BF8F00' : '1B8A4C'
            const recBg = c.recommendation?.includes('Отклонить') ? 'FFE7E7' : c.recommendation?.includes('Условно') ? 'FFF3CD' : 'E8F4E8'
            const riskColor = c.risk_level === 'Высокий' ? 'C00000' : c.risk_level === 'Средний' ? 'BF8F00' : '1B8A4C'
            return new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [3500, 5854],
              rows: [
                new TableRow({ children: [
                  new TableCell({
                    borders,
                    shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
                    margins: { top: 100, bottom: 100, left: 150, right: 150 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'РЕКОМЕНДАЦИЯ', size: 22, bold: true, font: 'Times New Roman', color: '1B8A4C' })] })]
                  }),
                  new TableCell({
                    borders,
                    shading: { fill: recBg, type: ShadingType.CLEAR },
                    margins: { top: 100, bottom: 100, left: 150, right: 150 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.recommendation || '—', size: 28, bold: true, font: 'Times New Roman', color: recColor })] })]
                  }),
                ]}),
                new TableRow({ children: [
                  new TableCell({
                    borders,
                    shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 150, right: 150 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'УРОВЕНЬ РИСКА', size: 22, bold: true, font: 'Times New Roman', color: '1B8A4C' })] })]
                  }),
                  new TableCell({
                    borders,
                    margins: { top: 80, bottom: 80, left: 150, right: 150 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.risk_level || '—', size: 24, bold: true, font: 'Times New Roman', color: riskColor })] })]
                  }),
                ]}),
              ]
            })
          })(),
          makePara('', { after: 300 }),

          // Подписи
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [
                makePara('Аналитик: _________________', { after: 60 }),
                makePara(c.analyst_name ? `(${c.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 }),
              ]}),
              new TableCell({ borders: noborders, children: [
                makePara(`г. Душанбе, ${today}`, { center: true, after: 0 }),
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
        'Content-Disposition': `attachment; filename="Zakluchenie.docx"; filename*=UTF-8''${encodeURIComponent('Заключение_' + c.borrower_name + '.docx')}`,
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка генерации Word: ' + String(error) }, { status: 500 })
  }
}

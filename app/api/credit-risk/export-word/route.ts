import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { conclusion: c } = await request.json()

    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
    } = await import('docx')

    const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
    const today = new Date().toLocaleDateString('ru-RU')
    const p1 = c.p1_label || 'Период 1'
    const p2 = c.p2_label || 'Период 2'

    const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
    const borders = { top: b, bottom: b, left: b, right: b }
    const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const noborders = { top: nob, bottom: nob, left: nob, right: nob }

    const makeCell = (text: string, opts: { gray?: boolean; bold?: boolean; center?: boolean; colSpan?: number } = {}) => {
      return new TableCell({
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
    }

    const makePara = (text: string, opts: { bold?: boolean; size?: number; center?: boolean; after?: number } = {}) => {
      return new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
        spacing: { after: opts.after ?? 120, line: 276 },
        children: [new TextRun({ text: String(text || ''), size: opts.size ?? 22, bold: !!opts.bold, font: 'Times New Roman' })]
      })
    }

    const makeSection = (title: string) => {
      return new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: title, size: 24, bold: true, font: 'Times New Roman' })]
      })
    }

    const makeFinTable = (title: string, rows: [string, number, number][], totals: [string, number, number][] = []) => {
      return [
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
        makePara('', { after: 60 }),
      ]
    }

    const p1a = (c.p1_cash||0)+(c.p1_receivables||0)+(c.p1_inventory||0)+(c.p1_fixed_assets||0)+(c.p1_other_assets||0)
    const p2a = (c.p2_cash||0)+(c.p2_receivables||0)+(c.p2_inventory||0)+(c.p2_fixed_assets||0)+(c.p2_other_assets||0)
    const p1l = (c.p1_supplier_debt||0)+(c.p1_bank_debt||0)+(c.p1_other_liabilities||0)
    const p2l = (c.p2_supplier_debt||0)+(c.p2_bank_debt||0)+(c.p2_other_liabilities||0)
    const p1e = (c.p1_equity_capital||0)+(c.p1_reserves||0)+(c.p1_retained_earnings||0)
    const p2e = (c.p2_equity_capital||0)+(c.p2_reserves||0)+(c.p2_retained_earnings||0)
    const collaterals: {type: string; description: string; value: number}[] = Array.isArray(c.collaterals) ? c.collaterals : []
    const totalCollateral = collaterals.reduce((s, col) => s + (col.value || 0), 0)

    const conclusionParagraphs = (c.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
      const isHeader = /^\d+\./.test(line.trim())
      return new Paragraph({
        spacing: { after: isHeader ? 60 : 100, before: isHeader ? 160 : 0 },
        children: [new TextRun({ text: line.trim(), size: 22, bold: isHeader, font: 'Times New Roman' })]
      })
    })

    const doc = new Document({
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          makePara('ҶСК «Алиф Бонк»', { bold: true, size: 28, center: true, after: 60 }),
          makePara('Служба управления рисками', { size: 22, center: true, after: 240 }),
          makePara('ЗАКЛЮЧЕНИЕ О КРЕДИТОСПОСОБНОСТИ', { bold: true, size: 30, center: true, after: 60 }),
          makePara('Субъект малого и среднего бизнеса (SME)', { size: 22, center: true, after: 60 }),
          makePara(`Дата: ${today}`, { size: 20, center: true, after: 360 }),

          makeSection('1. ПАРАМЕТРЫ КРЕДИТНОЙ ЗАЯВКИ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [makeCell('Заёмщик', { gray: true, bold: true }), makeCell(c.borrower_name || '—')] }),
              new TableRow({ children: [makeCell('ИНН', { gray: true, bold: true }), makeCell(c.borrower_inn || '—')] }),
              new TableRow({ children: [makeCell('Вид деятельности', { gray: true, bold: true }), makeCell(c.business_type || '—')] }),
              new TableRow({ children: [makeCell('Лет в бизнесе', { gray: true, bold: true }), makeCell(String(c.years_in_business || '—'))] }),
              new TableRow({ children: [makeCell('Сумма кредита', { gray: true, bold: true }), makeCell(`${fmt(c.loan_amount)} ${c.loan_currency}`)] }),
              new TableRow({ children: [makeCell('Срок', { gray: true, bold: true }), makeCell(c.loan_term || '—')] }),
              new TableRow({ children: [makeCell('Цель', { gray: true, bold: true }), makeCell(c.loan_purpose || '—')] }),
              new TableRow({ children: [makeCell('Кредитная история', { gray: true, bold: true }), makeCell(c.credit_history || '—')] }),
              new TableRow({ children: [makeCell('Аналитик', { gray: true, bold: true }), makeCell(c.analyst_name || '—')] }),
            ]
          }),
          makePara('', { after: 120 }),

          ...makeFinTable('2. ФИНАНСОВОЕ ПОЛОЖЕНИЕ (БАЛАНС)',
            [
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
            ],
            [['ИТОГО КАПИТАЛ', p1e, p2e]]
          ),

          ...makeFinTable('3. ФИНАНСОВЫЕ РЕЗУЛЬТАТЫ (ОПУ)',
            [
              ['Выручка', c.p1_revenue||0, c.p2_revenue||0],
              ['Себестоимость', c.p1_cogs||0, c.p2_cogs||0],
              ['Валовой доход', (c.p1_revenue||0)-(c.p1_cogs||0), (c.p2_revenue||0)-(c.p2_cogs||0)],
              ['Административные расходы', c.p1_admin_expense||0, c.p2_admin_expense||0],
              ['Торговые расходы', c.p1_sales_expense||0, c.p2_sales_expense||0],
            ],
            [['Чистая прибыль', c.p1_net_profit||0, c.p2_net_profit||0]]
          ),

          ...makeFinTable('4. ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС)',
            [
              ['Остаток на начало', c.p1_cash_begin||0, c.p2_cash_begin||0],
              ['Операционная деятельность (нетто)', (c.p1_op_inflow||0)-(c.p1_op_outflow||0), (c.p2_op_inflow||0)-(c.p2_op_outflow||0)],
              ['Финансовая деятельность (нетто)', (c.p1_fin_inflow||0)-(c.p1_fin_outflow||0), (c.p2_fin_inflow||0)-(c.p2_fin_outflow||0)],
              ['Инвест. деятельность (нетто)', (c.p1_inv_inflow||0)-(c.p1_inv_outflow||0), (c.p2_inv_inflow||0)-(c.p2_inv_outflow||0)],
            ],
            [['Остаток на конец', c.p1_cash_end||0, c.p2_cash_end||0]]
          ),

          makeSection('5. ОБЕСПЕЧЕНИЕ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [450, 2500, 4000, 2404],
            rows: [
              new TableRow({ children: [makeCell('№', { gray: true, bold: true, center: true }), makeCell('Тип', { gray: true, bold: true }), makeCell('Описание', { gray: true, bold: true }), makeCell('Стоимость (TJS)', { gray: true, bold: true, center: true })] }),
              ...collaterals.map((col, i) => new TableRow({ children: [makeCell(String(i+1), { center: true }), makeCell(col.type), makeCell(col.description || '—'), makeCell(fmt(col.value), { center: true })] })),
              new TableRow({ children: [makeCell('Итого', { bold: true, colSpan: 3 }), makeCell(fmt(totalCollateral), { bold: true, center: true })] }),
            ]
          }),
          makePara('', { after: 120 }),

          makeSection('6. ЗАКЛЮЧЕНИЕ СЛУЖБЫ УПРАВЛЕНИЯ РИСКАМИ'),
          ...conclusionParagraphs,
          makePara('', { after: 120 }),

          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3500, 5854],
            rows: [
              new TableRow({ children: [makeCell('РЕКОМЕНДАЦИЯ', { gray: true, bold: true }), makeCell(c.recommendation || '—', { bold: true })] }),
              new TableRow({ children: [makeCell('УРОВЕНЬ РИСКА', { gray: true, bold: true }), makeCell(c.risk_level || '—', { bold: true })] }),
            ]
          }),
          makePara('', { after: 360 }),

          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [makePara('Аналитик: _________________', { after: 60 }), makePara(c.analyst_name ? `(${c.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 })] }),
              new TableCell({ borders: noborders, children: [makePara(`г. Душанбе, ${today}`, { center: true, after: 0 })] }),
            ]})]
          }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Zakluchenie_${c.borrower_name}.docx"`,
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка генерации Word' }, { status: 500 })
  }
}

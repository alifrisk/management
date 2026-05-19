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

// ── Helpers ──

const cell = (text: string, opts: {
  gray?: boolean; green?: boolean; bold?: boolean; center?: boolean
  colSpan?: number; color?: string; bg?: string; size?: number
} = {}) => new TableCell({
  borders,
  columnSpan: opts.colSpan,
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR }
    : opts.green ? { fill: 'E8F4E8', type: ShadingType.CLEAR }
    : opts.gray ? { fill: 'F5F5F5', type: ShadingType.CLEAR }
    : undefined,
  margins: { top: 70, bottom: 70, left: 120, right: 120 },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(text ?? '—'),
      size: opts.size ?? 20,
      bold: !!opts.bold,
      color: opts.color ?? '000000',
      font: 'Times New Roman'
    })]
  })]
})

const para = (text: string, opts: {
  bold?: boolean; size?: number; center?: boolean; right?: boolean
  after?: number; before?: number; color?: string; indent?: boolean
} = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : opts.right ? AlignmentType.RIGHT : AlignmentType.BOTH,
  spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
  indent: opts.indent ? { firstLine: 360 } : undefined,
  children: [new TextRun({
    text: String(text ?? ''),
    size: opts.size ?? 22,
    bold: !!opts.bold,
    color: opts.color ?? '000000',
    font: 'Times New Roman'
  })]
})

// Section header with green underline
const sectionHead = (num: string, title: string) => new Paragraph({
  spacing: { before: 240, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' } },
  children: [
    new TextRun({ text: `${num}. `, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
    new TextRun({ text: title, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
  ]
})

// Financial table helper
const finTable = (
  rows: [string, number | string, number | string, boolean?][],
  p1: string, p2: string, fmt: (v: number) => string
) => new Table({
  width: { size: 9354, type: WidthType.DXA },
  columnWidths: [5200, 2077, 2077],
  rows: [
    new TableRow({ children: [
      cell('Показатель', { green: true, bold: true }),
      cell(p1, { green: true, bold: true, center: true }),
      cell(p2, { green: true, bold: true, center: true }),
    ]}),
    ...rows.map(([label, v1, v2, isBold]) => new TableRow({ children: [
      cell(label, { bold: isBold, green: isBold }),
      cell(typeof v1 === 'number' ? fmt(v1) : v1, { center: true, bold: isBold }),
      cell(typeof v2 === 'number' ? fmt(v2) : v2, { center: true, bold: isBold }),
    ]})),
  ]
})

export async function POST(request: Request) {
  try {
    const { conclusion: c } = await request.json()

    const fmt = (v: number) => v || v === 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
    const pct = (num: number, den: number, suffix = '%') => den > 0 ? (num / den * 100).toFixed(1) + suffix : '—'
    const today = new Date().toLocaleDateString('ru-RU')
    const p1 = c.p1_label || 'Период 1'
    const p2 = c.p2_label || 'Период 2'

    // Computed values
    const p1a = (c.p1_cash||0)+(c.p1_receivables||0)+(c.p1_inventory||0)+(c.p1_fixed_assets||0)+(c.p1_other_assets||0)
    const p2a = (c.p2_cash||0)+(c.p2_receivables||0)+(c.p2_inventory||0)+(c.p2_fixed_assets||0)+(c.p2_other_assets||0)
    const p1l = (c.p1_supplier_debt||0)+(c.p1_bank_debt||0)+(c.p1_other_liabilities||0)
    const p2l = (c.p2_supplier_debt||0)+(c.p2_bank_debt||0)+(c.p2_other_liabilities||0)
    const p1e = (c.p1_equity_capital||0)+(c.p1_reserves||0)+(c.p1_retained_earnings||0)
    const p2e = (c.p2_equity_capital||0)+(c.p2_reserves||0)+(c.p2_retained_earnings||0)
    const p1gross = (c.p1_revenue||0)-(c.p1_cogs||0)
    const p2gross = (c.p2_revenue||0)-(c.p2_cogs||0)
    const p1op = (c.p1_revenue||0)-(c.p1_cogs||0)-(c.p1_sales_expense||0)-(c.p1_admin_expense||0)+(c.p1_other_op_income||0)
    const p2op = (c.p2_revenue||0)-(c.p2_cogs||0)-(c.p2_sales_expense||0)-(c.p2_admin_expense||0)+(c.p2_other_op_income||0)
    const p1ebt = p1op+(c.p1_non_op||0)
    const p2ebt = p2op+(c.p2_non_op||0)
    const p1opCF = (c.p1_op_inflow||0)-(c.p1_op_outflow||0)
    const p2opCF = (c.p2_op_inflow||0)-(c.p2_op_outflow||0)

    let collaterals: {type: string; description: string; value: number}[] = []
    if (Array.isArray(c.collaterals)) collaterals = c.collaterals
    else if (typeof c.collaterals === 'string') { try { collaterals = JSON.parse(c.collaterals) } catch { collaterals = [] } }
    const totalCollateral = collaterals.reduce((s, col) => s + (col.value || 0), 0)

    // Parse guarantors
    let guarantors: {name: string; inn: string; relation: string}[] = []
    if (Array.isArray(c.guarantors)) guarantors = c.guarantors
    else if (typeof c.guarantors === 'string') { try { guarantors = JSON.parse(c.guarantors) } catch { guarantors = [] } }

    const loanAmt = c.loan_amount || 0
    const rate = (c.interest_rate || 0) / 100 / 12
    const months = parseInt(c.loan_term_months || c.loan_term) || 12
    const monthly = rate > 0 ? Math.round(loanAmt * rate / (1 - Math.pow(1 + rate, -months))) : Math.round(loanAmt / months)

    // Recommendation styling
    const recColor = c.recommendation?.includes('Отклонить') ? 'C00000' : c.recommendation?.includes('Условно') ? 'BF8F00' : '1B8A4C'
    const recBg = c.recommendation?.includes('Отклонить') ? 'FFE7E7' : c.recommendation?.includes('Условно') ? 'FFF9E6' : 'E8F4E8'
    const riskColor = c.risk_level === 'Высокий' ? 'C00000' : c.risk_level === 'Средний' ? 'BF8F00' : '1B8A4C'

    // AI conclusion paragraphs - styled
    const conclusionParagraphs = (c.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
      const text = line.trim()
      if (/^\d+\./.test(text)) {
        return new Paragraph({
          spacing: { before: 180, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
          children: [new TextRun({ text, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
        })
      }
      if (text.toUpperCase().includes('РЕКОМЕНДАЦИЯ:') || text.toUpperCase().includes('РЕШЕНИЕ:')) {
        return new Paragraph({
          spacing: { after: 80, before: 60 },
          alignment: AlignmentType.BOTH,
          indent: { firstLine: 360 },
          children: [new TextRun({ text, size: 22, bold: true, color: recColor, font: 'Times New Roman' })]
        })
      }
      if (text.startsWith('-') || text.startsWith('•')) {
        return new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          alignment: AlignmentType.BOTH,
          children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
        })
      }
      return new Paragraph({
        spacing: { after: 80 },
        alignment: AlignmentType.BOTH,
        indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
      })
    })

    const doc = new Document({
      numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [

          // ── ШАПКА ──
          para('ҶСК «Алиф Бонк»', { bold: true, size: 30, center: true, after: 40 }),
          para('Служба управления рисками', { size: 20, center: true, after: 40, color: '555555' }),
          // Горизонтальная линия
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [9354],
            rows: [new TableRow({ children: [new TableCell({
              borders: { top: nob, left: nob, right: nob, bottom: bGreen },
              children: [new Paragraph({ children: [] })]
            })] })]
          }),
          para('', { after: 100 }),
          para('ЗАКЛЮЧЕНИЕ О КРЕДИТОСПОСОБНОСТИ', { bold: true, size: 28, center: true, after: 40 }),
          para('Субъект малого и среднего бизнеса (SME)', { size: 20, center: true, after: 40, color: '555555' }),
          para(`Дата составления: ${today}`, { size: 20, center: true, after: 300, color: '555555' }),

          // ── 1. ПАРАМЕТРЫ ──
          sectionHead('1', 'ПАРАМЕТРЫ КРЕДИТНОЙ ЗАЯВКИ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [cell('Наименование заёмщика', { green: true, bold: true }), cell(c.borrower_name || '—', { bold: true })] }),
              new TableRow({ children: [cell('ИНН', { green: true }), cell(c.borrower_inn || '—')] }),
              new TableRow({ children: [cell('Вид деятельности', { green: true }), cell(c.business_type || '—')] }),
              new TableRow({ children: [cell('Лет в бизнесе', { green: true }), cell(String(c.years_in_business || '—'))] }),
              new TableRow({ children: [cell('Сумма кредита', { green: true, bold: true }), cell(`${fmt(c.loan_amount)} ${c.loan_currency || 'TJS'}`, { bold: true })] }),
              new TableRow({ children: [cell('Срок кредита', { green: true }), cell(c.loan_term || '—')] }),
              new TableRow({ children: [cell('Процентная ставка', { green: true }), cell(c.interest_rate ? `${c.interest_rate}% годовых` : '—')] }),
              new TableRow({ children: [cell('Ежемесячный платёж (аннуитет)', { green: true, bold: true }), cell(c.interest_rate ? `${fmt(monthly)} TJS` : '—', { bold: true })] }),
              new TableRow({ children: [cell('Цель кредита', { green: true }), cell(c.loan_purpose || '—')] }),
              new TableRow({ children: [cell('Кредитная история', { green: true }), cell(c.credit_history || '—')] }),
              new TableRow({ children: [cell('Аналитик', { green: true }), cell(c.analyst_name || '—')] }),
            ]
          }),
          para('', { after: 60 }),

          // ── 2. БАЛАНС ──
          sectionHead('2', 'ФИНАНСОВОЕ ПОЛОЖЕНИЕ (БАЛАНС)'),
          finTable([
            ['Денежные средства', c.p1_cash||0, c.p2_cash||0],
            ['Дебиторская задолженность', c.p1_receivables||0, c.p2_receivables||0],
            ['ТМЗ (запасы)', c.p1_inventory||0, c.p2_inventory||0],
            ['Основные средства', c.p1_fixed_assets||0, c.p2_fixed_assets||0],
            ['Прочие активы', c.p1_other_assets||0, c.p2_other_assets||0],
            ['ИТОГО АКТИВ', p1a, p2a, true],
            ['Долги поставщикам', c.p1_supplier_debt||0, c.p2_supplier_debt||0],
            ['Долги банкам', c.p1_bank_debt||0, c.p2_bank_debt||0],
            ['Прочие обязательства', c.p1_other_liabilities||0, c.p2_other_liabilities||0],
            ['ИТОГО ОБЯЗАТЕЛЬСТВА', p1l, p2l, true],
            ['КАПИТАЛ', p1e, p2e, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 3. ОПУ ──
          sectionHead('3', 'ФИНАНСОВЫЕ РЕЗУЛЬТАТЫ (ОПУ)'),
          finTable([
            ['Выручка от реализации', c.p1_revenue||0, c.p2_revenue||0],
            ['Себестоимость', c.p1_cogs||0, c.p2_cogs||0],
            ['Валовая прибыль', p1gross, p2gross, true],
            ['Торговые расходы', c.p1_sales_expense||0, c.p2_sales_expense||0],
            ['Административные расходы', c.p1_admin_expense||0, c.p2_admin_expense||0],
            ['Прочие операционные доходы', c.p1_other_op_income||0, c.p2_other_op_income||0],
            ['Операционная прибыль', p1op, p2op, true],
            ['Прочие внеоперац. доходы/(расходы)', c.p1_non_op||0, c.p2_non_op||0],
            ['Прибыль до налогообложения', p1ebt, p2ebt, true],
            ['Налог на прибыль', c.p1_tax||0, c.p2_tax||0],
            ['Чистая прибыль', c.p1_net_profit||0, c.p2_net_profit||0, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 4. ОДДС ──
          sectionHead('4', 'ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС)'),
          finTable([
            ['Остаток на начало периода', c.p1_cash_begin||0, c.p2_cash_begin||0],
            ['Операционная деятельность (нетто)', p1opCF, p2opCF],
            ['Финансовая деятельность (нетто)', (c.p1_fin_inflow||0)-(c.p1_fin_outflow||0), (c.p2_fin_inflow||0)-(c.p2_fin_outflow||0)],
            ['Инвест. деятельность (нетто)', (c.p1_inv_inflow||0)-(c.p1_inv_outflow||0), (c.p2_inv_inflow||0)-(c.p2_inv_outflow||0)],
            ['Остаток на конец периода', c.p1_cash_end||0, c.p2_cash_end||0, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 5. КОЭФФИЦИЕНТЫ ──
          sectionHead('5', 'КЛЮЧЕВЫЕ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3400, 1700, 1700, 2554],
            rows: [
              new TableRow({ children: [
                cell('Коэффициент', { green: true, bold: true }),
                cell(p1, { green: true, bold: true, center: true }),
                cell(p2, { green: true, bold: true, center: true }),
                cell('Норматив', { green: true, bold: true, center: true }),
              ]}),
              ...([
                ['Рентабельность продаж', pct(c.p1_net_profit||0, c.p1_revenue||0), pct(c.p2_net_profit||0, c.p2_revenue||0), 'Норма: >5%'],
                ['Долговая нагрузка (Обяз/Актив)', pct(p1l, p1a), pct(p2l, p2a), 'Норма: <70%'],
                ['Коэффициент автономии (Кап/Актив)', pct(p1e, p1a), pct(p2e, p2a), 'Норма: >30%'],
                ['Покрытие долга опер. потоком', p1l > 0 ? (p1opCF/p1l).toFixed(2) : '—', p2l > 0 ? (p2opCF/p2l).toFixed(2) : '—', 'Норма: >1'],
                ['Долговая нагрузка по платежу', p1opCF > 0 ? (monthly*12/p1opCF*100).toFixed(1)+'%' : '—', p2opCF > 0 ? (monthly*12/p2opCF*100).toFixed(1)+'%' : '—', 'Норма: <40%'],
                ['Покрытие залогом (Залог/Кредит)', totalCollateral > 0 && loanAmt > 0 ? (totalCollateral/loanAmt*100).toFixed(1)+'%' : '—', '—', 'Норма: >120%'],
              ] as [string,string,string,string][]).map(([label, v1, v2, norm]) => new TableRow({ children: [
                cell(label),
                cell(v1, { center: true }),
                cell(v2, { center: true }),
                cell(norm, { center: true, color: '555555' }),
              ]})),
            ]
          }),
          para('', { after: 60 }),

          // ── 6. ЗАЛОГ ──
          sectionHead('6', 'ОБЕСПЕЧЕНИЕ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [500, 2200, 4200, 2454],
            rows: [
              new TableRow({ children: [
                cell('№', { green: true, bold: true, center: true }),
                cell('Тип залога', { green: true, bold: true }),
                cell('Описание', { green: true, bold: true }),
                cell('Стоимость (TJS)', { green: true, bold: true, center: true }),
              ]}),
              ...(collaterals.length > 0
                ? collaterals.map((col, i) => new TableRow({ children: [
                    cell(String(i+1), { center: true }),
                    cell(col.type || '—'),
                    cell(col.description || '—'),
                    cell(fmt(col.value), { center: true }),
                  ]}))
                : [new TableRow({ children: [cell('Залог не указан', { colSpan: 4 })] })]),
              new TableRow({ children: [
                new TableCell({ borders, columnSpan: 3, margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'ИТОГО', size: 20, bold: true, font: 'Times New Roman' })] })] }),
                cell(fmt(totalCollateral), { bold: true, center: true }),
              ]}),
            ]
          }),
          // Поручители (если есть)
          ...(guarantors.length > 0 ? [
            para('Поручители', { bold: true, size: 20, after: 60, color: '1B8A4C' }),
            new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [500, 3000, 2200, 3654],
              rows: [
                new TableRow({ children: [
                  cell('№', { green: true, bold: true, center: true }),
                  cell('ФИО / Название', { green: true, bold: true }),
                  cell('ИНН', { green: true, bold: true }),
                  cell('Связь с заёмщиком', { green: true, bold: true }),
                ]}),
                ...guarantors.map((g, i) => new TableRow({ children: [
                  cell(String(i+1), { center: true }),
                  cell(g.name || '—'),
                  cell(g.inn || '—'),
                  cell(g.relation || '—'),
                ]})),
              ]
            }),
            para('', { after: 60 }),
          ] : []),

          // ── 7. ЗАКЛЮЧЕНИЕ ──
          sectionHead('7', 'ЗАКЛЮЧЕНИЕ СЛУЖБЫ УПРАВЛЕНИЯ РИСКАМИ'),
          ...conclusionParagraphs,
          para('', { after: 120 }),

          // ── РЕШЕНИЕ (выделенный блок) ──
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3200, 6154],
            rows: [
              new TableRow({ children: [
                new TableCell({
                  borders: { top: bGreen, bottom: bGreen, left: bGreen, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
                  shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 180, right: 180 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'РЕШЕНИЕ И РЕКОМЕНДАЦИЯ', size: 18, bold: true, color: '1B8A4C', font: 'Times New Roman' })] })
                  ]
                }),
                new TableCell({
                  borders: { top: bGreen, bottom: bGreen, right: bGreen, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
                  shading: { fill: recBg, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 180, right: 180 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: c.recommendation || '—', size: 32, bold: true, color: recColor, font: 'Times New Roman' })]
                    })
                  ]
                }),
              ]}),
              new TableRow({ children: [
                new TableCell({
                  borders,
                  shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'УРОВЕНЬ РИСКА', size: 18, bold: true, color: '555555', font: 'Times New Roman' })] })]
                }),
                new TableCell({
                  borders,
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.risk_level || '—', size: 24, bold: true, color: riskColor, font: 'Times New Roman' })] })]
                }),
              ]}),
            ]
          }),
          para('', { after: 300 }),

          // ── ПОДПИСИ ──
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [
                para('Аналитик: _________________', { after: 60 }),
                para(c.analyst_name ? `(${c.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0, color: '555555' }),
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
        'Content-Disposition': `attachment; filename="Zakluchenie.docx"; filename*=UTF-8''${encodeURIComponent('Заключение_' + (c.borrower_name || '') + '.docx')}`,
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

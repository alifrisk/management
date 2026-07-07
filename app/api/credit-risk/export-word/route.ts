import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const borders = { top: b, bottom: b, left: b, right: b }
const bGreen = { style: BorderStyle.SINGLE, size: 6, color: '333333' }
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
    : opts.green ? { fill: 'F0F0F0', type: ShadingType.CLEAR }
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
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } },
  children: [
    new TextRun({ text: `${num}. `, size: 24, bold: true, color: '000000', font: 'Times New Roman' }),
    new TextRun({ text: title, size: 24, bold: true, color: '000000', font: 'Times New Roman' }),
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

    // Computed values — новые поля МФ РТ с фолбэком на старые для обратной совместимости
    const p1ca = (c.p1_cash_desk||0)+(c.p1_cash_bank||0)+(c.p1_st_invest||0)+(c.p1_trade_rec||0)+(c.p1_other_rec||0)+(c.p1_founder_rec||0)+(c.p1_inventory||0)+(c.p1_prepaid||0)+(c.p1_nca_sale||0)
    const p2ca = (c.p2_cash_desk||0)+(c.p2_cash_bank||0)+(c.p2_st_invest||0)+(c.p2_trade_rec||0)+(c.p2_other_rec||0)+(c.p2_founder_rec||0)+(c.p2_inventory||0)+(c.p2_prepaid||0)+(c.p2_nca_sale||0)
    const p1nca = (c.p1_ppe||0)+(c.p1_nat_res||0)+(c.p1_intangibles||0)+(c.p1_bio_assets||0)+(c.p1_invest_prop||0)+(c.p1_lt_invest||0)+(c.p1_def_tax_asset||0)+(c.p1_lt_rec||0)
    const p2nca = (c.p2_ppe||0)+(c.p2_nat_res||0)+(c.p2_intangibles||0)+(c.p2_bio_assets||0)+(c.p2_invest_prop||0)+(c.p2_lt_invest||0)+(c.p2_def_tax_asset||0)+(c.p2_lt_rec||0)
    // Фолбэк для старых записей без новых полей
    const p1a = p1ca + p1nca || (c.p1_cash||0)+(c.p1_receivables||0)+(c.p1_inventory||0)+(c.p1_fixed_assets||0)+(c.p1_other_assets||0)
    const p2a = p2ca + p2nca || (c.p2_cash||0)+(c.p2_receivables||0)+(c.p2_inventory||0)+(c.p2_fixed_assets||0)+(c.p2_other_assets||0)
    const p1cl = (c.p1_trade_pay||0)+(c.p1_st_debt||0)+(c.p1_accrued||0)+(c.p1_taxes_pay||0)+(c.p1_exp_reserves||0)+(c.p1_other_st_liab||0)
    const p2cl = (c.p2_trade_pay||0)+(c.p2_st_debt||0)+(c.p2_accrued||0)+(c.p2_taxes_pay||0)+(c.p2_exp_reserves||0)+(c.p2_other_st_liab||0)
    const p1ll = (c.p1_lt_debt||0)+(c.p1_def_income||0)+(c.p1_def_tax_liab||0)
    const p2ll = (c.p2_lt_debt||0)+(c.p2_def_income||0)+(c.p2_def_tax_liab||0)
    const p1l = p1cl + p1ll || (c.p1_supplier_debt||0)+(c.p1_bank_debt||0)+(c.p1_other_liabilities||0)
    const p2l = p2cl + p2ll || (c.p2_supplier_debt||0)+(c.p2_bank_debt||0)+(c.p2_other_liabilities||0)
    const p1e = (c.p1_charter_cap||0)+(c.p1_add_cap||0)+(c.p1_retained||0)+(c.p1_reserve_cap||0)+(c.p1_minority||0) || (c.p1_equity_capital||0)+(c.p1_reserves||0)+(c.p1_retained_earnings||0)
    const p2e = (c.p2_charter_cap||0)+(c.p2_add_cap||0)+(c.p2_retained||0)+(c.p2_reserve_cap||0)+(c.p2_minority||0) || (c.p2_equity_capital||0)+(c.p2_reserves||0)+(c.p2_retained_earnings||0)
    const p1rev = (c.p1_net_rev||0) || (c.p1_revenue||0)
    const p2rev = (c.p2_net_rev||0) || (c.p2_revenue||0)
    const p1gross = p1rev-(c.p1_cogs||0)
    const p2gross = p2rev-(c.p2_cogs||0)
    const p1op = p1gross-(c.p1_sell_exp||c.p1_sales_expense||0)-(c.p1_admin_exp||c.p1_admin_expense||0)+(c.p1_other_op||c.p1_other_op_income||0)
    const p2op = p2gross-(c.p2_sell_exp||c.p2_sales_expense||0)-(c.p2_admin_exp||c.p2_admin_expense||0)+(c.p2_other_op||c.p2_other_op_income||0)
    const p1nonop = (c.p1_interest_exp||0)+(c.p1_invest_inc||0)+(c.p1_fx_diff||0)+(c.p1_currency_ex||0)+(c.p1_asset_disp||0)-(c.p1_impairment||0)+(c.p1_other_nonop||c.p1_non_op||0)
    const p2nonop = (c.p2_interest_exp||0)+(c.p2_invest_inc||0)+(c.p2_fx_diff||0)+(c.p2_currency_ex||0)+(c.p2_asset_disp||0)-(c.p2_impairment||0)+(c.p2_other_nonop||c.p2_non_op||0)
    const p1ebt = p1op + p1nonop + (c.p1_assoc_profit||0)
    const p2ebt = p2op + p2nonop + (c.p2_assoc_profit||0)
    const p1netProfit = (c.p1_net_profit||0) || p1ebt-(c.p1_tax||0)
    const p2netProfit = (c.p2_net_profit||0) || p2ebt-(c.p2_tax||0)
    const p1opCF = (c.p1_cf_sales||0)+(c.p1_cf_other_op_in||0)-((c.p1_cf_cogs_paid||0)+(c.p1_cf_salary||0)+(c.p1_cf_services||0)+(c.p1_cf_interest||0)+(c.p1_cf_income_tax||0)+(c.p1_cf_other_taxes||0)+(c.p1_cf_other_op_out||0)) || (c.p1_op_inflow||0)-(c.p1_op_outflow||0)
    const p2opCF = (c.p2_cf_sales||0)+(c.p2_cf_other_op_in||0)-((c.p2_cf_cogs_paid||0)+(c.p2_cf_salary||0)+(c.p2_cf_services||0)+(c.p2_cf_interest||0)+(c.p2_cf_income_tax||0)+(c.p2_cf_other_taxes||0)+(c.p2_cf_other_op_out||0)) || (c.p2_op_inflow||0)-(c.p2_op_outflow||0)
    const p1invCF = (c.p1_cf_asset_sold||0)+(c.p1_cf_intang_sold||0)+(c.p1_cf_sec_sold||0)+(c.p1_cf_loan_ret||0)+(c.p1_cf_other_inv_in||0)-((c.p1_cf_asset_buy||0)+(c.p1_cf_intang_buy||0)+(c.p1_cf_sec_buy||0)+(c.p1_cf_loans_given||0)+(c.p1_cf_other_inv_out||0)) || (c.p1_inv_inflow||0)-(c.p1_inv_outflow||0)
    const p2invCF = (c.p2_cf_asset_sold||0)+(c.p2_cf_intang_sold||0)+(c.p2_cf_sec_sold||0)+(c.p2_cf_loan_ret||0)+(c.p2_cf_other_inv_in||0)-((c.p2_cf_asset_buy||0)+(c.p2_cf_intang_buy||0)+(c.p2_cf_sec_buy||0)+(c.p2_cf_loans_given||0)+(c.p2_cf_other_inv_out||0)) || (c.p2_inv_inflow||0)-(c.p2_inv_outflow||0)
    const p1finCF = (c.p1_cf_shares||0)+(c.p1_cf_bonds||0)+(c.p1_cf_founders||0)+(c.p1_cf_loans_in||0)+(c.p1_cf_other_fin_in||0)-((c.p1_cf_dividends||0)+(c.p1_cf_loans_out||0)+(c.p1_cf_buyback||0)+(c.p1_cf_other_fin_out||0)) || (c.p1_fin_inflow||0)-(c.p1_fin_outflow||0)
    const p2finCF = (c.p2_cf_shares||0)+(c.p2_cf_bonds||0)+(c.p2_cf_founders||0)+(c.p2_cf_loans_in||0)+(c.p2_cf_other_fin_in||0)-((c.p2_cf_dividends||0)+(c.p2_cf_loans_out||0)+(c.p2_cf_buyback||0)+(c.p2_cf_other_fin_out||0)) || (c.p2_fin_inflow||0)-(c.p2_fin_outflow||0)
    const p1cashBegin = (c.p1_cf_cash_begin||0) || (c.p1_cash_begin||0)
    const p2cashBegin = (c.p2_cf_cash_begin||0) || (c.p2_cash_begin||0)
    const p1cashEnd = (c.p1_cash_end||0) || p1cashBegin + p1opCF + p1invCF + p1finCF

    let collaterals: {type: string; description: string; address?: string; value: number}[] = []
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
    const recColor = c.recommendation?.includes('Отклонить') ? 'C00000' : c.recommendation?.includes('Условно') ? 'BF8F00' : '000000'
    const recBg = c.recommendation?.includes('Отклонить') ? 'FFE7E7' : c.recommendation?.includes('Условно') ? 'FFF9E6' : 'F0F0F0'
    const riskColor = c.risk_level === 'Высокий' ? 'C00000' : c.risk_level === 'Средний' ? 'BF8F00' : '000000'

    // AI conclusion paragraphs - styled
    const conclusionParagraphs = (c.ai_conclusion || '').split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('Руководитель СУР')).map((line: string) => {
      const text = line.trim().replace(/\*\*/g, '').replace(/\*/g, '')
      if (/^\d+\./.test(text)) {
        return new Paragraph({
          spacing: { before: 180, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333' } },
          children: [new TextRun({ text, size: 22, bold: true, color: '000000', font: 'Times New Roman' })]
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
          para('ЗАКЛЮЧЕНИЕ', { bold: true, size: 32, center: true, after: 40 }),
          para('по кредитной заявке', { size: 22, center: true, after: 40 }),
          para(c.borrower_name || '—', { bold: true, size: 26, center: true, after: 160 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [new Paragraph({ children: [new TextRun({ text: `№ ___________`, size: 22, font: 'Times New Roman' })] })] }),
              new TableCell({ borders: noborders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: today, size: 22, font: 'Times New Roman' })] })] }),
            ]})]
          }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [9354],
            rows: [new TableRow({ children: [new TableCell({
              borders: { top: nob, left: nob, right: nob, bottom: bGreen },
              children: [new Paragraph({ children: [] })]
            })] })]
          }),
          para('', { after: 200 }),

          // ── 1. ОБЩАЯ ИНФОРМАЦИЯ ──
          sectionHead('1', 'ОБЩАЯ ИНФОРМАЦИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [cell('Код / Наименование заёмщика', { green: true, bold: true }), cell(c.borrower_name || '—', { bold: true })] }),
              new TableRow({ children: [cell('Кредитная история', { green: true }), cell(c.credit_history || '—')] }),
              new TableRow({ children: [cell('Сектор бизнеса', { green: true }), cell(c.sector || '—')] }),
              new TableRow({ children: [cell('Вид деятельности', { green: true }), cell(c.business_type || '—')] }),
              ...(c.conclusion_type === 'Увеличение кредитной линии' ? [
                new TableRow({ children: [cell('Тип операции', { green: true }), cell(c.conclusion_type)] }),
                new TableRow({ children: [cell('Действующий лимит', { green: true }), cell(`${fmt(c.existing_loan_balance)} ${c.loan_currency || 'TJS'}`)] }),
                new TableRow({ children: [cell('Желаемый лимит', { green: true, bold: true }), cell(`${fmt(c.loan_amount)} ${c.loan_currency || 'TJS'}`, { bold: true })] }),
              ] : c.conclusion_type === 'Смена залога' ? [
                new TableRow({ children: [cell('Тип операции', { green: true }), cell(c.conclusion_type)] }),
                new TableRow({ children: [cell('Остаток по кредиту', { green: true, bold: true }), cell(`${fmt(c.existing_loan_balance)} ${c.loan_currency || 'TJS'}`, { bold: true })] }),
              ] : [
                new TableRow({ children: [cell('Тип операции', { green: true }), cell(c.conclusion_type || 'Одобрение кредитной линии')] }),
                new TableRow({ children: [cell('Сумма линии', { green: true, bold: true }), cell(`${fmt(c.loan_amount)} ${c.loan_currency || 'TJS'}`, { bold: true })] }),
              ]),
              new TableRow({ children: [cell('Цель кредита', { green: true }), cell(c.loan_purpose || '—')] }),
              new TableRow({ children: [cell('Менеджер', { green: true }), cell(c.analyst_name || '—')] }),
            ]
          }),
          para('', { after: 60 }),

          // ── 2. ЗАЛОГ ──
          sectionHead('2', 'ОБЕСПЕЧЕНИЕ (ЗАЛОГ)'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [400, 1800, 3000, 2500, 1654],
            rows: [
              new TableRow({ children: [
                cell('№', { green: true, bold: true, center: true }),
                cell('Тип залога', { green: true, bold: true }),
                cell('Описание', { green: true, bold: true }),
                cell('Адрес', { green: true, bold: true }),
                cell('Стоимость (TJS)', { green: true, bold: true, center: true }),
              ]}),
              ...(collaterals.length > 0
                ? collaterals.map((col, i) => new TableRow({ children: [
                    cell(String(i+1), { center: true }),
                    cell(col.type || '—'),
                    cell(col.description || '—'),
                    cell(col.address || '—'),
                    cell(fmt(col.value), { center: true }),
                  ]}))
                : [new TableRow({ children: [cell('Залог не указан', { colSpan: 5 })] })]),
              new TableRow({ children: [
                new TableCell({ borders, columnSpan: 4, margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'ИТОГО', size: 20, bold: true, font: 'Times New Roman' })] })] }),
                cell(fmt(totalCollateral), { bold: true, center: true }),
              ]}),
            ]
          }),
          ...(guarantors.length > 0 ? [
            para('Поручители', { bold: true, size: 20, after: 60, color: '1B8A4C' }),
            new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [500, 3000, 2200, 3654],
              rows: [
                new TableRow({ children: [
                  cell('№', { green: true, bold: true, center: true }),
                  cell('ФИО / Название', { green: true, bold: true }),
                  cell('Доход (TJS)', { green: true, bold: true }),
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
          ] : []),
          para('', { after: 60 }),

          // ── 3. ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ ──
          sectionHead('3', 'КЛЮЧЕВЫЕ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ'),
          (() => {
            // Если есть прямо введённые коэффициенты — используем их
            const cc = (c.financial_data as { coefficients?: Record<string, number | null | string> } | null)?.coefficients
            if (!cc) return undefined
            const rv2 = (v: unknown) => (v !== null && v !== undefined) ? Number(v).toFixed(2) : '—'
            const pv2 = (v: unknown) => (v !== null && v !== undefined) ? Number(v).toFixed(1) + '%' : '—'
            const p1lbl = (cc.p1_label as string) || 'П1'
            const p2lbl = (cc.p2_label as string) || 'П2'
            const grp2 = (title: string) => new TableRow({ children: [new TableCell({
              borders, columnSpan: 6,
              shading: { fill: 'F0F0F0', type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: title, size: 20, bold: true, color: '000000', font: 'Times New Roman' })] })]
            })] })
            const row2 = (name: string, v1: string, v2: string, norm: string, meets: boolean, sym: string) => new TableRow({ children: [
              cell(name, { size: 18 }),
              cell(v1, { center: true, size: 18 }),
              cell(v2, { center: true, size: 18, bold: true }),
              cell(norm, { center: true, size: 18, color: '555555' }),
              new TableCell({
                borders, verticalAlign: VerticalAlign.CENTER,
                shading: meets ? { fill: 'E8F4E8', type: ShadingType.CLEAR } : undefined,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meets ? 'Да' : 'Нет', size: 18, bold: meets, color: meets ? '1B8A4C' : '000000', font: 'Times New Roman' })] })]
              }),
              cell(sym, { center: true, size: 18, color: '555555' }),
            ]})
            const hasAny = ['ctl','kbl','roa','roe','kfin','dscr','coll_cov']
              .some(k => cc[`${k}_p2`] != null || cc[`${k}_p1`] != null)
            if (!hasAny) return undefined
            const n2 = (k: string) => cc[k] as number | null | undefined
            const DEF_NORMS: Record<string, string> = {
              ctl: '>2.0 (>200%)', kbl: '>1.0 (>100%)',
              roa: '>6%', roe: '>20%',
              kfin: '>0.5', dscr: '>1.0', coll_cov: '>120%',
            }
            const nrm = (k: string) => (cc[`${k}_norm`] as string) || DEF_NORMS[k]
            const chk = (k: string, v: number | null | undefined) => {
              const s = nrm(k); const m = s.match(/([<>])\s*([\d.]+)/)
              if (!m || v == null) return false
              return m[1] === '>' ? v > parseFloat(m[2]) : v < parseFloat(m[2])
            }
            return new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [2800, 1100, 1200, 1400, 1300, 1554],
              rows: [
                new TableRow({ children: [
                  cell('Наименование показателя', { green: true, bold: true, size: 18 }),
                  cell(p1lbl, { green: true, bold: true, center: true, size: 16 }),
                  cell(p2lbl, { green: true, bold: true, center: true, size: 16 }),
                  cell('Рек. норма', { green: true, bold: true, center: true, size: 18 }),
                  cell('Соответствует', { green: true, bold: true, center: true, size: 16 }),
                  cell('Обозн.', { green: true, bold: true, center: true, size: 18 }),
                ]}),
                grp2('ПОКАЗАТЕЛИ ЛИКВИДНОСТИ'),
                row2('Коэффициент текущей ликвидности', rv2(n2('ctl_p1')), rv2(n2('ctl_p2')), nrm('ctl'), chk('ctl', n2('ctl_p2')), 'Ктл'),
                row2('Коэффициент быстрой ликвидности', rv2(n2('kbl_p1')), rv2(n2('kbl_p2')), nrm('kbl'), chk('kbl', n2('kbl_p2')), 'Кбл'),
                grp2('ПОКАЗАТЕЛИ РЕНТАБЕЛЬНОСТИ'),
                row2('Рентабельность активов (ROA)', pv2(n2('roa_p1')), pv2(n2('roa_p2')), nrm('roa'), chk('roa', n2('roa_p2')), 'ROA'),
                row2('Рентабельность собственных средств (ROE)', pv2(n2('roe_p1')), pv2(n2('roe_p2')), nrm('roe'), chk('roe', n2('roe_p2')), 'ROE'),
                grp2('ПОКАЗАТЕЛИ ФИНАНСОВОЙ УСТОЙЧИВОСТИ'),
                row2('Коэффициент финансирования/левериджа', rv2(n2('kfin_p1')), rv2(n2('kfin_p2')), nrm('kfin'), chk('kfin', n2('kfin_p2')), 'Кфин'),
                grp2('ПОКАЗАТЕЛИ КРЕДИТОСПОСОБНОСТИ'),
                row2('Коэффициент покрытия долга (DSCR)', rv2(n2('dscr_p1')), rv2(n2('dscr_p2')), nrm('dscr'), chk('dscr', n2('dscr_p2')), 'DSC'),
                row2('Коэффициент покрытия залогом', pv2(n2('coll_cov_p1')), pv2(n2('coll_cov_p2')), nrm('coll_cov'), chk('coll_cov', n2('coll_cov_p2')), 'Кзал'),
              ]
            })
          })() ||
          (() => {
            const p1inv = c.p1_inventory || 0
            const p2inv = c.p2_inventory || 0
            const rv = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(2) : '—'
            const pv = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(1) + '%' : '—'
            const lc1 = p1cl > 0 ? p1ca / p1cl : NaN
            const lc2 = p2cl > 0 ? p2ca / p2cl : NaN
            const lq1 = p1cl > 0 ? (p1ca - p1inv) / p1cl : NaN
            const lq2 = p2cl > 0 ? (p2ca - p2inv) / p2cl : NaN
            const getMonths = (label: string) => {
              const m = label?.match(/\d{2}\.(\d{2})\.\d{4}/)
              if (m) return parseInt(m[1]) || 12
              if (/март|mar/i.test(label)) return 3
              if (/июн|jun/i.test(label)) return 6
              if (/сент|sep/i.test(label)) return 9
              if (/дек|dec/i.test(label)) return 12
              return 12
            }
            const pm1 = getMonths(p1)
            const pm2 = getMonths(p2)
            const roa1 = p1a > 0 ? (p1netProfit / p1a * 100) / pm1 * 12 : NaN
            const roa2 = p2a > 0 ? (p2netProfit / p2a * 100) / pm2 * 12 : NaN
            const roe1 = p1e > 0 ? (p1netProfit / p1e * 100) / pm1 * 12 : NaN
            const roe2 = p2e > 0 ? (p2netProfit / p2e * 100) / pm2 * 12 : NaN
            const fin1 = p1l > 0 ? p1e / p1l : NaN
            const fin2 = p2l > 0 ? p2e / p2l : NaN
            const dsc1 = monthly > 0 ? (p1opCF + p1invCF + p1finCF) / pm1 / monthly : NaN
            const dsc2 = monthly > 0 ? (p2opCF + p2invCF + p2finCF) / pm2 / monthly : NaN
            const cov = loanAmt > 0 ? totalCollateral / loanAmt * 100 : NaN
            const grp = (title: string) => new TableRow({ children: [new TableCell({
              borders, columnSpan: 6,
              shading: { fill: 'F0F0F0', type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: title, size: 20, bold: true, color: '000000', font: 'Times New Roman' })] })]
            })] })
            const row = (name: string, v1: string, v2: string, norm: string, meets: boolean, sym: string) => new TableRow({ children: [
              cell(name, { size: 18 }),
              cell(v1, { center: true, size: 18 }),
              cell(v2, { center: true, size: 18 }),
              cell(norm, { center: true, size: 18, color: '555555' }),
              new TableCell({
                borders,
                verticalAlign: VerticalAlign.CENTER,
                shading: meets ? { fill: 'E8F4E8', type: ShadingType.CLEAR } : undefined,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meets ? 'Да' : 'Нет', size: 18, bold: meets, color: meets ? '1B8A4C' : '000000', font: 'Times New Roman' })] })]
              }),
              cell(sym, { center: true, size: 18, color: '555555' }),
            ]})
            return new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [2800, 1100, 1200, 1400, 1300, 1554],
              rows: [
                new TableRow({ children: [
                  cell('Наименование показателя', { green: true, bold: true, size: 18 }),
                  cell(p1, { green: true, bold: true, center: true, size: 16 }),
                  cell(p2, { green: true, bold: true, center: true, size: 16 }),
                  cell('Рек. норма', { green: true, bold: true, center: true, size: 18 }),
                  cell('Соответствует', { green: true, bold: true, center: true, size: 16 }),
                  cell('Обозн.', { green: true, bold: true, center: true, size: 18 }),
                ]}),
                grp('ПОКАЗАТЕЛИ ЛИКВИДНОСТИ'),
                row('Коэффициент текущей ликвидности', rv(lc1), rv(lc2), '>2.0 (>200%)', isFinite(lc2) && lc2 > 2.0, 'Ктл'),
                row('Коэффициент быстрой ликвидности', rv(lq1), rv(lq2), '>1.0 (>100%)', isFinite(lq2) && lq2 > 1.0, 'Кбл'),
                grp('ПОКАЗАТЕЛИ РЕНТАБЕЛЬНОСТИ'),
                row('Рентабельность активов (ROA)', pv(roa1), pv(roa2), '>6%', isFinite(roa2) && roa2 > 6, 'ROA'),
                row('Рентабельность собственных средств (ROE)', pv(roe1), pv(roe2), '>20%', isFinite(roe2) && roe2 > 20, 'ROE'),
                grp('ПОКАЗАТЕЛИ ФИНАНСОВОЙ УСТОЙЧИВОСТИ'),
                row('Коэффициент финансирования/левериджа', rv(fin1), rv(fin2), '>0.5', isFinite(fin2) && fin2 > 0.5, 'Кфин'),
                grp('ПОКАЗАТЕЛИ КРЕДИТОСПОСОБНОСТИ'),
                row('Коэффициент покрытия долга (DSC)', rv(dsc1), rv(dsc2), '>1.0', isFinite(dsc2) && dsc2 > 1.0, 'DSC'),
                row('Коэффициент покрытия залогом', '—', pv(cov), '>120%', isFinite(cov) && cov > 120, 'Кзал'),
              ]
            })
          })(),
          para('', { after: 60 }),

          // ── 4. КОНЦЕНТРАЦИЯ ──
          ...(() => {
            const smePf = c.sme_sector_portfolio || 0
            const bankPf = c.bank_total_portfolio || 0
            const loanAmt = c.loan_amount || 0
            const raConc = c.ra_conc_limit || 0
            if (!smePf && !bankPf) return []
            const concSme = smePf > 0 && loanAmt > 0 ? (loanAmt / smePf * 100) : 0
            const concBank = bankPf > 0 && loanAmt > 0 ? (loanAmt / bankPf * 100) : 0
            const concViolates = raConc > 0 && concSme > raConc
            return [
              sectionHead('4', 'КОНЦЕНТРАЦИЯ КРЕДИТНОГО РИСКА'),
              new Table({
                width: { size: 9354, type: WidthType.DXA },
                columnWidths: [4000, 2677, 2677],
                rows: [
                  new TableRow({ children: [cell('Показатель', { green: true, bold: true }), cell('Значение', { green: true, bold: true, center: true }), cell('Статус', { green: true, bold: true, center: true })] }),
                  ...(smePf > 0 ? [new TableRow({ children: [
                    cell(`Доля в портфеле МСБ (лимит: ${raConc > 0 ? raConc + '%' : 'не задан'})`, {}),
                    cell(`${concSme.toFixed(2)}%`, { center: true, bold: true }),
                    cell(concViolates ? '❌ Нарушает' : '✅ Норма', { center: true, color: concViolates ? 'C00000' : '1B8A4C' }),
                  ]})] : []),
                  ...(bankPf > 0 ? [new TableRow({ children: [
                    cell('Доля от общего портфеля банка (инфо)', {}),
                    cell(`${concBank.toFixed(2)}%`, { center: true }),
                    cell('Информационно', { center: true, color: '555555' }),
                  ]})] : []),
                ]
              }),
              para('', { after: 60 }),
            ]
          })(),

          // ── 5. РИСК-АППЕТИТ ──
          ...(() => {
            const bankPf = c.bank_total_portfolio || 0
            const loanAmt = c.loan_amount || 0
            const curPar30 = c.current_par30_pct || 0
            const raPar30 = c.ra_par30_limit || 0
            if (!bankPf || !loanAmt) return []
            const delta = loanAmt / bankPf * 100
            const after = curPar30 + delta
            const violates = raPar30 > 0 && after > raPar30
            return [
              sectionHead('5', 'РИСК-АППЕТИТ (PAR30)'),
              new Table({
                width: { size: 9354, type: WidthType.DXA },
                columnWidths: [4000, 2677, 2677],
                rows: [
                  new TableRow({ children: [cell('Показатель', { green: true, bold: true }), cell('Значение', { green: true, bold: true, center: true }), cell('Статус', { green: true, bold: true, center: true })] }),
                  new TableRow({ children: [cell('PAR30 до выдачи'), cell(curPar30 > 0 ? `${curPar30.toFixed(2)}%` : '—', { center: true }), cell('', {})] }),
                  new TableRow({ children: [cell('Прирост PAR30 при дефолте'), cell(`+${delta.toFixed(2)}%`, { center: true, color: 'BF8F00', bold: true }), cell('', {})] }),
                  new TableRow({ children: [cell(`PAR30 после выдачи (лимит: ${raPar30 > 0 ? raPar30 + '%' : 'не задан'})`), cell(`${after.toFixed(2)}%`, { center: true, bold: true }), cell(violates ? '❌ Нарушает' : '✅ Норма', { center: true, color: violates ? 'C00000' : '1B8A4C' })] }),
                ]
              }),
              para('', { after: 60 }),
            ]
          })(),

          // ── 6. ОЦЕНКА РИСКОВ / ЗАКЛЮЧЕНИЕ ──
          sectionHead('6', 'ЗАКЛЮЧЕНИЕ СЛУЖБЫ УПРАВЛЕНИЯ РИСКАМИ'),
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
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [9354],
            rows: [
              new TableRow({ children: [new TableCell({ borders: noborders, children: [
                new Paragraph({ children: [
                  new TextRun({ text: 'Руководитель', size: 22, font: 'Times New Roman' }),
                ] }),
                new Paragraph({ spacing: { after: 120 }, children: [
                  new TextRun({ text: 'Службы управления рисками:  _____________  Сангинова Ф. И.', size: 22, font: 'Times New Roman' }),
                ] }),
                new Paragraph({ children: [
                  new TextRun({ text: 'Менеджер', size: 22, font: 'Times New Roman' }),
                ] }),
                new Paragraph({ spacing: { after: 0 }, children: [
                  new TextRun({ text: `Службы управления рисками:  _____________  ${c.analyst_name || '___________________'}`, size: 22, font: 'Times New Roman' }),
                ] }),
              ]}) ]}),
            ]
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

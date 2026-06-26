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

          // ── 2. БАЛАНС (Форма №1) ──
          sectionHead('2', 'ФИНАНСОВОЕ ПОЛОЖЕНИЕ (БАЛАНС — Форма №1)'),
          finTable([
            ['КРАТКОСРОЧНЫЕ АКТИВЫ', '', '', true],
            ['Денежные средства в кассе (10100)', c.p1_cash_desk||0, c.p2_cash_desk||0],
            ['Денежные средства в банках (10200)', c.p1_cash_bank||0, c.p2_cash_bank||0],
            ['Краткосрочные инвестиции (10300)', c.p1_st_invest||0, c.p2_st_invest||0],
            ['Торговая дебиторская задолженность (10400)', c.p1_trade_rec||0, c.p2_trade_rec||0],
            ['Прочая дебиторская задолженность (10500)', c.p1_other_rec||0, c.p2_other_rec||0],
            ['Задолженность учредителей (10600)', c.p1_founder_rec||0, c.p2_founder_rec||0],
            ['ТМЗ (10700)', c.p1_inventory||0, c.p2_inventory||0],
            ['Расходы будущих периодов (10800)', c.p1_prepaid||0, c.p2_prepaid||0],
            ['Долгосроч. активы для продажи (10900)', c.p1_nca_sale||0, c.p2_nca_sale||0],
            ['Итого краткосрочных активов', p1ca, p2ca, true],
            ['ДОЛГОСРОЧНЫЕ АКТИВЫ', '', '', true],
            ['Основные средства (11000)', c.p1_ppe||0, c.p2_ppe||0],
            ['Природные ресурсы (11200)', c.p1_nat_res||0, c.p2_nat_res||0],
            ['Нематериальные активы (11300)', c.p1_intangibles||0, c.p2_intangibles||0],
            ['Биологические активы (11400)', c.p1_bio_assets||0, c.p2_bio_assets||0],
            ['Инвестиционное имущество (11500)', c.p1_invest_prop||0, c.p2_invest_prop||0],
            ['Долгосрочные инвестиции (11600)', c.p1_lt_invest||0, c.p2_lt_invest||0],
            ['Отложенные налоговые активы (11700)', c.p1_def_tax_asset||0, c.p2_def_tax_asset||0],
            ['Долгосрочная дебиторка (11800)', c.p1_lt_rec||0, c.p2_lt_rec||0],
            ['Итого долгосрочных активов', p1nca, p2nca, true],
            ['ИТОГО АКТИВЫ', p1a, p2a, true],
            ['КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА', '', '', true],
            ['Торговая кредиторка (22000)', c.p1_trade_pay||0, c.p2_trade_pay||0],
            ['Краткосрочные долговые обяз. (22100)', c.p1_st_debt||0, c.p2_st_debt||0],
            ['Начисленные обязательства (22200)', c.p1_accrued||0, c.p2_accrued||0],
            ['Налоговые обязательства (22300)', c.p1_taxes_pay||0, c.p2_taxes_pay||0],
            ['Резервы на расходы (22400)', c.p1_exp_reserves||0, c.p2_exp_reserves||0],
            ['Прочие краткосрочные обяз. (22500)', c.p1_other_st_liab||0, c.p2_other_st_liab||0],
            ['Итого краткосрочных обязательств', p1cl, p2cl, true],
            ['ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА', '', '', true],
            ['Долгосрочные долговые обяз. (22600)', c.p1_lt_debt||0, c.p2_lt_debt||0],
            ['Доходы будущих периодов (22700)', c.p1_def_income||0, c.p2_def_income||0],
            ['Отложенные нал. обязательства (22800)', c.p1_def_tax_liab||0, c.p2_def_tax_liab||0],
            ['Итого долгосрочных обязательств', p1ll, p2ll, true],
            ['ИТОГО ОБЯЗАТЕЛЬСТВА', p1l, p2l, true],
            ['СОБСТВЕННЫЙ КАПИТАЛ', '', '', true],
            ['Уставный капитал (33000)', c.p1_charter_cap||0, c.p2_charter_cap||0],
            ['Дополнительный капитал (33100)', c.p1_add_cap||0, c.p2_add_cap||0],
            ['Нераспределённая прибыль (33200)', c.p1_retained||0, c.p2_retained||0],
            ['Резервный капитал (33300)', c.p1_reserve_cap||0, c.p2_reserve_cap||0],
            ['Доля меньшинства (33400)', c.p1_minority||0, c.p2_minority||0],
            ['ИТОГО КАПИТАЛ', p1e, p2e, true],
            ['ИТОГО ПАССИВЫ', p1l+p1e, p2l+p2e, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 3. ОПУ (Форма №2) ──
          sectionHead('3', 'ФИНАНСОВЫЕ РЕЗУЛЬТАТЫ (ОПУ — Форма №2)'),
          finTable([
            ['Чистый доход от продаж (010)', p1rev, p2rev],
            ['Себестоимость продаж (020)', c.p1_cogs||0, c.p2_cogs||0],
            ['Валовая прибыль (030)', p1gross, p2gross, true],
            ['Расходы на продажу (040)', c.p1_sell_exp||c.p1_sales_expense||0, c.p2_sell_exp||c.p2_sales_expense||0],
            ['Административные расходы (050)', c.p1_admin_exp||c.p1_admin_expense||0, c.p2_admin_exp||c.p2_admin_expense||0],
            ['Прочие операционные доходы/(расходы) (070)', c.p1_other_op||c.p1_other_op_income||0, c.p2_other_op||c.p2_other_op_income||0],
            ['Операционная прибыль/(убыток) (080)', p1op, p2op, true],
            ['Доходы/(расходы) по процентам (100)', c.p1_interest_exp||0, c.p2_interest_exp||0],
            ['Доходы/(убыток) от инвестиций (110)', c.p1_invest_inc||0, c.p2_invest_inc||0],
            ['Доходы/(убыток) от курсовых разниц (120)', c.p1_fx_diff||0, c.p2_fx_diff||0],
            ['Доходы/(убыток) от обмена валюты (130)', c.p1_currency_ex||0, c.p2_currency_ex||0],
            ['Доходы/(убыток) от выбытия активов (140)', c.p1_asset_disp||0, c.p2_asset_disp||0],
            ['Убыток от обесценения (150)', c.p1_impairment||0, c.p2_impairment||0],
            ['Прочие неоперационные (160)', c.p1_other_nonop||c.p1_non_op||0, c.p2_other_nonop||c.p2_non_op||0],
            ['Итого неоперационных (170)', p1nonop, p2nonop, true],
            ['Доля прибыли ассоц. компаний (180)', c.p1_assoc_profit||0, c.p2_assoc_profit||0],
            ['Прибыль до налогообложения (190)', p1ebt, p2ebt, true],
            ['Налог на прибыль (200)', c.p1_tax||0, c.p2_tax||0],
            ['ЧИСТАЯ ПРИБЫЛЬ/(УБЫТОК) (230)', p1netProfit, p2netProfit, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 4. ОДДС (Форма №5) ──
          sectionHead('4', 'ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС — Форма №5)'),
          finTable([
            ['ОПЕРАЦИОННАЯ ДЕЯТЕЛЬНОСТЬ', '', '', true],
            ['Поступления от продаж (010)', c.p1_cf_sales||0, c.p2_cf_sales||0],
            ['Прочие опер. поступления (020)', c.p1_cf_other_op_in||0, c.p2_cf_other_op_in||0],
            ['Оплата себестоимости (050)', c.p1_cf_cogs_paid||0, c.p2_cf_cogs_paid||0],
            ['Оплата труда и отчислений (060)', c.p1_cf_salary||0, c.p2_cf_salary||0],
            ['Оплата прочих услуг (070)', c.p1_cf_services||0, c.p2_cf_services||0],
            ['Выплата процентов (080)', c.p1_cf_interest||0, c.p2_cf_interest||0],
            ['Уплата налога на прибыль (090)', c.p1_cf_income_tax||0, c.p2_cf_income_tax||0],
            ['Уплата прочих налогов (100)', c.p1_cf_other_taxes||0, c.p2_cf_other_taxes||0],
            ['Прочие опер. выплаты (110)', c.p1_cf_other_op_out||0, c.p2_cf_other_op_out||0],
            ['Чистый поток — операционная (200)', p1opCF, p2opCF, true],
            ['ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ', '', '', true],
            ['Продажа ОС (210)', c.p1_cf_asset_sold||0, c.p2_cf_asset_sold||0],
            ['Приобретение ОС (270)', c.p1_cf_asset_buy||0, c.p2_cf_asset_buy||0],
            ['Выданные займы (300)', c.p1_cf_loans_given||0, c.p2_cf_loans_given||0],
            ['Прочие инвестиционные нетто', c.p1_cf_intang_sold||0+c.p1_cf_sec_sold||0+c.p1_cf_loan_ret||0+c.p1_cf_other_inv_in||0-c.p1_cf_intang_buy||0-c.p1_cf_sec_buy||0-c.p1_cf_other_inv_out||0, c.p2_cf_intang_sold||0+c.p2_cf_sec_sold||0+c.p2_cf_loan_ret||0+c.p2_cf_other_inv_in||0-c.p2_cf_intang_buy||0-c.p2_cf_sec_buy||0-c.p2_cf_other_inv_out||0],
            ['Чистый поток — инвестиционная (330)', p1invCF, p2invCF, true],
            ['ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ', '', '', true],
            ['Полученные займы и кредиты (440)', c.p1_cf_loans_in||0, c.p2_cf_loans_in||0],
            ['Погашение займов и кредитов (480)', c.p1_cf_loans_out||0, c.p2_cf_loans_out||0],
            ['Выплата дивидендов (470)', c.p1_cf_dividends||0, c.p2_cf_dividends||0],
            ['Прочие финансовые нетто', c.p1_cf_shares||0+c.p1_cf_bonds||0+c.p1_cf_founders||0+c.p1_cf_other_fin_in||0-c.p1_cf_buyback||0-c.p1_cf_other_fin_out||0, c.p2_cf_shares||0+c.p2_cf_bonds||0+c.p2_cf_founders||0+c.p2_cf_other_fin_in||0-c.p2_cf_buyback||0-c.p2_cf_other_fin_out||0],
            ['Чистый поток — финансовая (520)', p1finCF, p2finCF, true],
            ['Влияние курсовых разниц (600)', c.p1_cf_fx||0, c.p2_cf_fx||0],
            ['Остаток на начало периода', p1cashBegin, p2cashBegin],
            ['Остаток на конец периода', p1cashEnd, (c.p2_cash_end||0)||p2cashBegin+p2opCF+p2invCF+p2finCF, true],
          ], p1, p2, fmt),
          para('', { after: 60 }),

          // ── 5. КОЭФФИЦИЕНТЫ ──
          sectionHead('5', 'КЛЮЧЕВЫЕ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ'),
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
                row('Коэффициент финансирования (леверидж)', rv(fin1), rv(fin2), '≤0.5', isFinite(fin2) && fin2 <= 0.5, 'Кфин'),
                grp('ПОКАЗАТЕЛИ КРЕДИТОСПОСОБНОСТИ'),
                row('Коэффициент покрытия долга (DSC)', rv(dsc1), rv(dsc2), '>1.0', isFinite(dsc2) && dsc2 > 1.0, 'DSC'),
                row('Коэффициент покрытия залогом', '—', pv(cov), '>120%', isFinite(cov) && cov > 120, 'Кзал'),
              ]
            })
          })(),
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
                  new TextRun({ text: 'Аналитик', size: 22, font: 'Times New Roman' }),
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

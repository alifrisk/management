import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

// ✅ Все три сценария — пересчитываем на лету из исходных данных
const ALL_SCENARIOS = {
  'Оптимистичный': {
    due_to_banks:      { t1: 0.10, t7: 0.20, t30: 0.30 },
    current_accounts:  { t1: 0.05, t7: 0.10, t30: 0.15 },
    electronic_wallet: { t1: 0.02, t7: 0.05, t30: 0.08 },
    savings:           { t1: 0.01, t7: 0.03, t30: 0.05 },
    term_deposits:     { t1: 0.01, t7: 0.05, t30: 0.10 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.00 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.02, t7: 0.03, t30: 0.05 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
  'Пессимистичный': {
    due_to_banks:      { t1: 1.00, t7: 1.00, t30: 1.00 },
    current_accounts:  { t1: 0.20, t7: 0.35, t30: 0.50 },
    electronic_wallet: { t1: 0.10, t7: 0.15, t30: 0.20 },
    savings:           { t1: 0.03, t7: 0.07, t30: 0.10 },
    term_deposits:     { t1: 0.05, t7: 0.20, t30: 0.35 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.00 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.05, t7: 0.07, t30: 0.10 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
  'Катастрофический': {
    due_to_banks:      { t1: 1.00, t7: 1.00, t30: 1.00 },
    current_accounts:  { t1: 0.40, t7: 0.60, t30: 0.80 },
    electronic_wallet: { t1: 0.25, t7: 0.40, t30: 0.60 },
    savings:           { t1: 0.10, t7: 0.20, t30: 0.35 },
    term_deposits:     { t1: 0.15, t7: 0.40, t30: 0.60 },
    borrowings:        { t1: 0.00, t7: 0.00, t30: 0.05 },
    other_liabilities: { t1: 0.00, t7: 0.00, t30: 0.00 },
    credit_line_salom: { t1: 0.10, t7: 0.15, t30: 0.20 },
    credit_line_sme:   { t1: 0.00, t7: 0.00, t30: 0.00 },
  },
}

function calcScenario(t: Record<string, number>, scenarioName: string) {
  const rates = ALL_SCENARIOS[scenarioName as keyof typeof ALL_SCENARIOS]
  const calc = (h: 't1' | 't7' | 't30') => {
    const liab =
      t.due_to_banks      * rates.due_to_banks[h] +
      t.current_accounts  * rates.current_accounts[h] +
      t.electronic_wallet * rates.electronic_wallet[h] +
      t.savings           * rates.savings[h] +
      t.term_deposits     * rates.term_deposits[h] +
      t.borrowings        * rates.borrowings[h] +
      t.other_liabilities * rates.other_liabilities[h]
    const draw =
      t.credit_line_salom * rates.credit_line_salom[h] +
      t.credit_line_sme   * rates.credit_line_sme[h]
    const need = liab + draw
    const cov_cash = need > 0 ? t.cash_equivalents / need : 0
    const cov_only = need > 0 ? t.cash_only / need : 0
    const risk = cov_only < 1 ? 'High' : cov_cash < 1 ? 'High' : cov_only < 1.1 ? 'Elevated' : cov_cash < 1.1 ? 'Elevated' : 'Normal'
    return { liab, draw, need, cov_cash, cov_only, risk }
  }
  return { t1: calc('t1'), t7: calc('t7'), t30: calc('t30') }
}

const b  = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const bB = { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' }
const bO = { style: BorderStyle.SINGLE, size: 6, color: 'F59E0B' }
const bR = { style: BorderStyle.SINGLE, size: 6, color: 'EF4444' }
const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const borders = { top: b, bottom: b, left: b, right: b }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

const riskLabel = (r: string) => r === 'High' ? 'Высокий' : r === 'Elevated' ? 'Повышенный' : 'Нормальный'
const riskColor = (r: string) => r === 'High' ? 'C00000' : r === 'Elevated' ? 'BF8F00' : '1B8A4C'
const riskBg    = (r: string) => r === 'High' ? 'FFE7E7' : r === 'Elevated' ? 'FFF3CD' : 'E8F4E8'
const covColor  = (v: number) => v >= 1.1 ? '1B8A4C' : v >= 1.0 ? 'BF8F00' : 'C00000'

const cell = (text: string, opts: {
  bold?: boolean; center?: boolean; gray?: boolean
  bg?: string; color?: string; colSpan?: number; size?: number
} = {}) => new TableCell({
  borders,
  columnSpan: opts.colSpan,
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.bg
    ? { fill: opts.bg, type: ShadingType.CLEAR }
    : opts.gray ? { fill: 'F3F4F6', type: ShadingType.CLEAR } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(text || '—'), size: opts.size || 18,
      bold: !!opts.bold, color: opts.color || '000000', font: 'Times New Roman'
    })]
  })]
})

const para = (text: string, opts: {
  bold?: boolean; center?: boolean; size?: number
  after?: number; before?: number; color?: string; indent?: boolean
} = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
  spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
  indent: opts.indent ? { firstLine: 360 } : undefined,
  children: [new TextRun({
    text: String(text || ''), size: opts.size ?? 22,
    bold: !!opts.bold, color: opts.color || '000000', font: 'Times New Roman'
  })]
})

const sectionTitle = (title: string) => new Paragraph({
  spacing: { before: 200, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
  children: [new TextRun({ text: title, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
})

const riskCell = (risk: string) => new TableCell({
  borders,
  shading: { fill: riskBg(risk), type: ShadingType.CLEAR },
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: riskLabel(risk), size: 18, bold: true, color: riskColor(risk), font: 'Times New Roman' })]
  })]
})

const covCell = (v: number) => new TableCell({
  borders,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: pct(v), size: 18, bold: true, color: covColor(v), font: 'Times New Roman' })]
  })]
})

// ✅ Таблица результатов для одного сценария
function scenarioTable(name: string, res: ReturnType<typeof calcScenario>, borderColor: typeof bB, cashEq: number, cashOnly: number) {
  const headerBorders = { top: borderColor, bottom: borderColor, left: borderColor, right: b }
  const titleCell = (text: string, colSpan?: number) => new TableCell({
    borders: { top: borderColor, bottom: borderColor, left: borderColor, right: borderColor },
    columnSpan: colSpan,
    shading: { fill: 'F8F9FA', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, size: 20, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
    })]
  })
  return new Table({
    width: { size: 9354, type: WidthType.DXA },
    columnWidths: [3500, 1951, 1951, 1952],
    rows: [
      new TableRow({ children: [
        titleCell('Показатель'),
        titleCell('T+1 (1 день)'),
        titleCell('T+7 (7 дней)'),
        titleCell('T+30 (30 дней)'),
      ]}),
      new TableRow({ children: [
        cell('Отток обязательств (TJS)', { gray: true }),
        cell(fmt(res.t1.liab), { center: true }),
        cell(fmt(res.t7.liab), { center: true }),
        cell(fmt(res.t30.liab), { center: true }),
      ]}),
      new TableRow({ children: [
        cell('Использование кредитных линий (TJS)', { gray: true }),
        cell(fmt(res.t1.draw), { center: true }),
        cell(fmt(res.t7.draw), { center: true }),
        cell(fmt(res.t30.draw), { center: true }),
      ]}),
      new TableRow({ children: [
        cell('Стресс-потребность (TJS)', { gray: true, bold: true }),
        cell(fmt(res.t1.need), { center: true, bold: true }),
        cell(fmt(res.t7.need), { center: true, bold: true }),
        cell(fmt(res.t30.need), { center: true, bold: true }),
      ]}),
      new TableRow({ children: [
        cell('Cash & Equivalents (буфер, TJS)', { gray: true }),
        cell(fmt(cashEq), { center: true, bold: true, color: '1B8A4C' }),
        cell(fmt(cashEq), { center: true, bold: true, color: '1B8A4C' }),
        cell(fmt(cashEq), { center: true, bold: true, color: '1B8A4C' }),
      ]}),
      new TableRow({ children: [
        cell('Cash Only (наличные)', { gray: true }),
        cell(fmt(cashOnly), { center: true, bold: true, color: '1B8A4C' }),
        cell(fmt(cashOnly), { center: true, bold: true, color: '1B8A4C' }),
        cell(fmt(cashOnly), { center: true, bold: true, color: '1B8A4C' }),
      ]}),
      new TableRow({ children: [
        cell('Покрытие (Cash & Eq)', { gray: true }),
        covCell(res.t1.cov_cash), covCell(res.t7.cov_cash), covCell(res.t30.cov_cash),
      ]}),
      new TableRow({ children: [
        cell('Покрытие (Cash Only)', { gray: true }),
        covCell(res.t1.cov_only), covCell(res.t7.cov_only), covCell(res.t30.cov_only),
      ]}),
      new TableRow({ children: [
        cell('Уровень риска', { gray: true, bold: true }),
        riskCell(res.t1.risk), riskCell(res.t7.risk), riskCell(res.t30.risk),
      ]}),
    ]
  })
}

// ✅ Сводная сравнительная таблица T+30
function summaryTable(results: Record<string, ReturnType<typeof calcScenario>>, cashEq: number, cashOnly: number) {
  return new Table({
    width: { size: 9354, type: WidthType.DXA },
    columnWidths: [3000, 2118, 2118, 2118],
    rows: [
      new TableRow({ children: [
        cell('Показатель (T+30)', { bold: true, gray: true }),
        cell('📈 Оптимистичный', { bold: true, center: true, bg: 'E8F5E9', color: '1B8A4C' }),
        cell('📉 Пессимистичный', { bold: true, center: true, bg: 'FFFDE7', color: 'BF8F00' }),
        cell('⚠️ Катастрофический', { bold: true, center: true, bg: 'FFEBEE', color: 'C00000' }),
      ]}),
      new TableRow({ children: [
        cell('Стресс-потребность (TJS)', { gray: true }),
        cell(fmt(results['Оптимистичный'].t30.need), { center: true }),
        cell(fmt(results['Пессимистичный'].t30.need), { center: true }),
        cell(fmt(results['Катастрофический'].t30.need), { center: true }),
      ]}),
      new TableRow({ children: [
        cell('Покрытие Cash & Eq', { gray: true }),
        covCell(results['Оптимистичный'].t30.cov_cash),
        covCell(results['Пессимистичный'].t30.cov_cash),
        covCell(results['Катастрофический'].t30.cov_cash),
      ]}),
      new TableRow({ children: [
        cell('Покрытие Cash Only', { gray: true }),
        covCell(results['Оптимистичный'].t30.cov_only),
        covCell(results['Пессимистичный'].t30.cov_only),
        covCell(results['Катастрофический'].t30.cov_only),
      ]}),
      new TableRow({ children: [
        cell('Уровень риска T+30', { gray: true, bold: true }),
        riskCell(results['Оптимистичный'].t30.risk),
        riskCell(results['Пессимистичный'].t30.risk),
        riskCell(results['Катастрофический'].t30.risk),
      ]}),
    ]
  })
}

export async function POST(request: Request) {
  try {
    const { test: t } = await request.json()
    const today = t.test_date
      ? new Date(t.test_date).toLocaleDateString('ru-RU')
      : new Date().toLocaleDateString('ru-RU')

    const inputs = {
      due_to_banks:      t.due_to_banks      || 0,
      current_accounts:  t.current_accounts  || 0,
      electronic_wallet: t.electronic_wallet || 0,
      savings:           t.savings           || 0,
      term_deposits:     t.term_deposits     || 0,
      borrowings:        t.borrowings        || 0,
      other_liabilities: t.other_liabilities || 0,
      credit_line_salom: t.credit_line_salom || 0,
      credit_line_sme:   t.credit_line_sme   || 0,
      cash_equivalents:  t.cash_equivalents  || 0,
      cash_only:         t.cash_only         || 0,
    }

    // ✅ Рассчитываем все три сценария
    const results = {
      'Оптимистичный':    calcScenario(inputs, 'Оптимистичный'),
      'Пессимистичный':   calcScenario(inputs, 'Пессимистичный'),
      'Катастрофический': calcScenario(inputs, 'Катастрофический'),
    }

    const savedScenario = t.scenario || 'Пессимистичный'
    const overallRisk = results['Катастрофический'].t30.risk === 'High' ? 'High'
      : results['Пессимистичный'].t30.risk !== 'Normal' ? results['Пессимистичный'].t30.risk
      : 'Normal'

    const overallBg    = overallRisk === 'High' ? 'FFE7E7' : overallRisk === 'Elevated' ? 'FFF9E6' : 'E8F4E8'
    const overallColor = overallRisk === 'High' ? 'C00000' : overallRisk === 'Elevated' ? 'BF8F00' : '1B8A4C'

    const addPara = (text: string, bold = false, color = '000000') => new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { after: 100, line: 276 },
      indent: { firstLine: 360 },
      children: [new TextRun({ text, size: 20, bold, color, font: 'Times New Roman' })]
    })

    // ✅ Заключение по каждому сценарию
    const optRes  = results['Оптимистичный']
    const pesRes  = results['Пессимистичный']
    const catRes  = results['Катастрофический']

    const conclusionItems = [
      addPara('Стресс-тест ликвидности проведён по трём сценариям на горизонтах T+1, T+7 и T+30.'),
      addPara(
        `Оптимистичный сценарий (базовый): T+30 покрытие Cash & Eq — ${pct(optRes.t30.cov_cash)}, Cash Only — ${pct(optRes.t30.cov_only)}. Риск: ${riskLabel(optRes.t30.risk)}.`,
        false, optRes.t30.risk === 'Normal' ? '1B8A4C' : 'BF8F00'
      ),
      addPara(
        `Пессимистичный сценарий: T+30 покрытие Cash & Eq — ${pct(pesRes.t30.cov_cash)}, Cash Only — ${pct(pesRes.t30.cov_only)}. Риск: ${riskLabel(pesRes.t30.risk)}.`,
        false, pesRes.t30.risk === 'High' ? 'C00000' : pesRes.t30.risk === 'Elevated' ? 'BF8F00' : '1B8A4C'
      ),
      addPara(
        `Катастрофический сценарий: T+30 покрытие Cash & Eq — ${pct(catRes.t30.cov_cash)}, Cash Only — ${pct(catRes.t30.cov_only)}. Риск: ${riskLabel(catRes.t30.risk)}.`,
        false, catRes.t30.risk === 'High' ? 'C00000' : 'BF8F00'
      ),
      new Paragraph({
        spacing: { before: 160, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
        children: [new TextRun({ text: 'Рекомендации:', size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
      }),
      ...(overallRisk === 'High' ? [
        addPara('1. Незамедлительно активировать план действий в чрезвычайных ситуациях (Liquidity Contingency Plan).', false, 'C00000'),
        addPara('2. Привлечь дополнительное финансирование через межбанковский рынок или кредитные линии.'),
        addPara('3. Провести срочное совещание АЛКО для принятия мер по восстановлению ликвидности.'),
        addPara('4. Ограничить новые выдачи кредитов до стабилизации ситуации.'),
      ] : overallRisk === 'Elevated' ? [
        addPara('1. Усилить мониторинг ликвидности — перейти на ежедневную отчётность.'),
        addPara('2. Подготовить резервные источники фондирования для возможного использования.'),
        addPara('3. Провести анализ концентрации обязательств и выявить крупных вкладчиков.'),
        addPara('4. Информировать Правление банка о текущем уровне риска ликвидности.'),
      ] : [
        addPara('1. Поддерживать текущий уровень ликвидного буфера — показатели в норме.'),
        addPara('2. Продолжить плановый мониторинг ликвидности в соответствии с политикой.'),
        addPara('3. Провести следующий стресс-тест согласно установленному графику.'),
      ]),
      para('', { after: 120 }),
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [3200, 6154],
        rows: [new TableRow({ children: [
          new TableCell({
            borders: { top: bB, bottom: bB, left: bB, right: b },
            shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [new Paragraph({ children: [new TextRun({ text: 'ОБЩИЙ УРОВЕНЬ РИСКА', size: 18, bold: true, color: '1B8A4C', font: 'Times New Roman' })] })]
          }),
          new TableCell({
            borders: { top: bB, bottom: bB, right: bB, left: b },
            shading: { fill: overallBg, type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: riskLabel(overallRisk), size: 32, bold: true, color: overallColor, font: 'Times New Roman' })] })]
          }),
        ]})]
      }),
    ]

    const doc = new Document({
      numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          // Заголовок
          para('ҶСК «Алиф Бонк»', { bold: true, size: 28, center: true, after: 40 }),
          para('Служба управления рисками', { size: 20, center: true, after: 200 }),
          para('СТРЕСС-ТЕСТ ЛИКВИДНОСТИ', { bold: true, size: 28, center: true, after: 40 }),
          para('Сценарный анализ · T+1 / T+7 / T+30', { size: 20, center: true, after: 40 }),
          para(`Дата: ${today}`, { size: 20, center: true, after: 300 }),

          // 1. Общие сведения
          sectionTitle('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [cell('Наименование теста', { gray: true, bold: true }), cell(t.test_name)] }),
              new TableRow({ children: [cell('Дата', { gray: true, bold: true }), cell(today)] }),
              new TableRow({ children: [cell('Аналитик', { gray: true, bold: true }), cell(t.analyst_name || '—')] }),
              new TableRow({ children: [cell('Сценарий (сохранённый)', { gray: true, bold: true }), cell(savedScenario)] }),
            ]
          }),
          para('', { after: 80 }),

          // 2. Входные данные
          sectionTitle('2. ВХОДНЫЕ ДАННЫЕ (TJS)'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3500, 2500, 3354],
            rows: [
              new TableRow({ children: [cell('Статья', { gray: true, bold: true }), cell('Отток T+1/T+7/T+30', { gray: true, bold: true, center: true }), cell('Сумма (TJS)', { gray: true, bold: true, center: true })] }),
              ...([
                { label: 'Межбанковские обязательства', key: 'due_to_banks', val: inputs.due_to_banks },
                { label: 'Текущие счета клиентов',      key: 'current_accounts', val: inputs.current_accounts },
                { label: 'Электронный кошелёк',          key: 'electronic_wallet', val: inputs.electronic_wallet },
                { label: 'Накопительные счета',          key: 'savings', val: inputs.savings },
                { label: 'Срочные депозиты',             key: 'term_deposits', val: inputs.term_deposits },
                { label: 'Заимствования',                key: 'borrowings', val: inputs.borrowings },
                { label: 'Прочие обязательства',         key: 'other_liabilities', val: inputs.other_liabilities },
                { label: 'Кредитная линия Salom',        key: 'credit_line_salom', val: inputs.credit_line_salom },
                { label: 'Кредитная линия SME',          key: 'credit_line_sme', val: inputs.credit_line_sme },
              ].map(row => {
                const sc = ALL_SCENARIOS[savedScenario as keyof typeof ALL_SCENARIOS]
                const r = sc[row.key as keyof typeof sc] as { t1: number; t7: number; t30: number }
                const rateStr = r ? `${(r.t1*100).toFixed(0)}% / ${(r.t7*100).toFixed(0)}% / ${(r.t30*100).toFixed(0)}%` : '—'
                return new TableRow({ children: [cell(row.label), cell(rateStr, { center: true, color: '1B8A4C' }), cell(fmt(row.val), { center: true })] })
              })),
              new TableRow({ children: [cell('Cash & Cash Equivalents (буфер)', { bold: true }), cell('—', { center: true }), cell(fmt(inputs.cash_equivalents), { center: true, bold: true })] }),
              new TableRow({ children: [cell('Cash Only (наличные)', { bold: true }), cell('—', { center: true }), cell(fmt(inputs.cash_only), { center: true, bold: true })] }),
            ]
          }),
          para('', { after: 80 }),

          // 3. Оптимистичный
          sectionTitle('3. ОПТИМИСТИЧНЫЙ СЦЕНАРИЙ (Base Case)'),
          scenarioTable('Оптимистичный', results['Оптимистичный'], bB, inputs.cash_equivalents, inputs.cash_only),
          para('', { after: 80 }),

          // 4. Пессимистичный
          sectionTitle('4. ПЕССИМИСТИЧНЫЙ СЦЕНАРИЙ (Stress)'),
          scenarioTable('Пессимистичный', results['Пессимистичный'], bO, inputs.cash_equivalents, inputs.cash_only),
          para('', { after: 80 }),

          // 5. Катастрофический
          sectionTitle('5. КАТАСТРОФИЧЕСКИЙ СЦЕНАРИЙ (Severe)'),
          scenarioTable('Катастрофический', results['Катастрофический'], bR, inputs.cash_equivalents, inputs.cash_only),
          para('', { after: 80 }),

          // 6. Сравнительная таблица
          sectionTitle('6. СРАВНИТЕЛЬНЫЙ АНАЛИЗ (T+30)'),
          summaryTable(results, inputs.cash_equivalents, inputs.cash_only),
          para('', { after: 80 }),

          // 7. Заключение
          sectionTitle('7. ЗАКЛЮЧЕНИЕ И РЕКОМЕНДАЦИИ'),
          ...conclusionItems,

          para('', { after: 300 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [para('Аналитик: _________________', { after: 60 }), para(t.analyst_name ? `(${t.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 })] }),
              new TableCell({ borders: noborders, children: [para(`г. Душанбе, ${today}`, { center: true, after: 0 })] }),
            ]})]
          }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="StressTest.docx"',
      }
    })
  } catch (error) {
    console.error('Liquidity Word error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

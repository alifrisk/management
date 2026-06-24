import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType,
} from 'docx'

const b   = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const nob = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const borders   = { top: b,   bottom: b,   left: b,   right: b   }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const CFP_BUCKETS = ['Текущая дата', '1–30 дн.', '31–90 дн.', '91–180 дн.', '181–365 дн.', '1–3 года', 'свыше 3 лет']
const OUTFLOW_ROWS = ['Текущие счета / до востребования','Срочные депозиты физлиц (погашение)','Срочные депозиты юрлиц (погашение)','МБК привлечённые (погашение)','Внебалансовые обязательства','Прочие оттоки']
const INFLOW_ROWS  = ['Наличность и кор. счета НБТ','РЕПО / реализация ценных бумаг','Кредитные линии НБТ','Привлечение новых МБК','Возврат выданных кредитов','Прочие поступления']

const fmt = (n: number) => n !== 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtPct = (n: number | null) => n != null ? n.toFixed(1) + '%' : '—'

const STATUS_COLOR = (s: string) => s === 'red' ? 'C00000' : s === 'yellow' ? 'BF8F00' : '1B8A4C'
const STATUS_BG    = (s: string) => s === 'red' ? 'FFE7E7' : s === 'yellow' ? 'FFF3CD' : 'E8F4E8'
const STATUS_LABEL = (s: string) => s === 'red' ? 'Дефицит' : s === 'yellow' ? 'Внимание' : 'Профицит'

// CAR norm status
function normStatus(val: number, norm: number, warnBuf: number) {
  if (val <= 0) return 'green'
  if (val < norm) return 'red'
  if (val < norm + warnBuf) return 'yellow'
  return 'green'
}

// Landscape layout: label col (2600) + 7 bucket cols (953 each, last 1003) = total 9354
const COL_WIDTHS = [2600, 953, 953, 953, 953, 953, 953, 1036]

const cell = (text: string, opts: {
  gray?: boolean; green?: boolean; red?: boolean; bold?: boolean; center?: boolean
  color?: string; bg?: string; size?: number
} = {}) => new TableCell({
  borders,
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.bg    ? { fill: opts.bg,    type: ShadingType.CLEAR }
         : opts.green ? { fill: 'E8F4E8', type: ShadingType.CLEAR }
         : opts.red   ? { fill: 'FFE7E7', type: ShadingType.CLEAR }
         : opts.gray  ? { fill: 'F5F5F5', type: ShadingType.CLEAR }
         : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(text ?? '—'), size: opts.size ?? 18,
      bold: !!opts.bold, color: opts.color ?? '000000', font: 'Times New Roman',
    })],
  })],
})

const para = (text: string, opts: {
  bold?: boolean; size?: number; center?: boolean; after?: number; before?: number; color?: string; indent?: boolean
} = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
  spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
  indent: opts.indent ? { firstLine: 360 } : undefined,
  children: [new TextRun({
    text: String(text ?? ''), size: opts.size ?? 22,
    bold: !!opts.bold, color: opts.color ?? '000000', font: 'Times New Roman',
  })],
})

const sectionHead = (title: string) => new Paragraph({
  spacing: { before: 240, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' } },
  children: [new TextRun({ text: title, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' })],
})

function bucketTable(
  headerLabel: string,
  dataRows: { label: string; vals: string[]; bold?: boolean; colors?: string[] }[],
) {
  return new Table({
    width: { size: 9354, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [
      new TableRow({ children: [
        cell(headerLabel, { green: true, bold: true }),
        ...CFP_BUCKETS.map(b => cell(b, { green: true, bold: true, center: true, size: 16 })),
      ]}),
      ...dataRows.map(row => new TableRow({ children: [
        cell(row.label, { gray: row.bold, bold: row.bold }),
        ...row.vals.map((v, i) => new TableCell({
          borders,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: v, size: 18, bold: !!row.bold,
              color: row.colors ? row.colors[i] : '000000',
              font: 'Times New Roman',
            })],
          })],
        })),
      ]})),
    ],
  })
}

export async function POST(request: Request) {
  try {
    const { report: r } = await request.json()
    const today = new Date().toLocaleDateString('ru-RU')

    const car11 = Number(r.car11) || 0
    const car12 = Number(r.car12) || 0
    const car13 = Number(r.car13) || 0
    const k21   = Number(r.k21)   || 0

    const s11  = normStatus(car11, 12, 1)
    const s12  = normStatus(car12, 10, 1)
    const s13  = normStatus(car13, 10, 1)
    const sk21 = normStatus(k21,   30, 5)

    const buckets: { label: string; outflow: number; inflow: number; net: number; cumulative_net: number; coverage_ratio: number | null; status: string }[] = r.cfp_results?.buckets || []
    const outflowsRows: number[][] = r.outflows_data?.rows || Array(6).fill(Array(7).fill(0))
    const inflowsRows:  number[][] = r.inflows_data?.rows  || Array(6).fill(Array(7).fill(0))

    const hasBuckets = buckets.length === 7

    // Summary bucket rows
    const summaryRows = [
      { label: 'Оттоки (млн TJS)',             vals: buckets.map(b => fmt(b.outflow)),         bold: false, colors: buckets.map(() => 'C00000') },
      { label: 'Поступления (млн TJS)',         vals: buckets.map(b => fmt(b.inflow)),           bold: false, colors: buckets.map(() => '1B8A4C') },
      { label: 'Чистая позиция (млн TJS)',      vals: buckets.map(b => (b.net >= 0 ? '+' : '') + fmt(b.net)), bold: true, colors: buckets.map(b => STATUS_COLOR(b.status)) },
      { label: 'Накопленная позиция (млн TJS)', vals: buckets.map(b => (b.cumulative_net >= 0 ? '+' : '') + fmt(b.cumulative_net)), bold: true, colors: buckets.map(b => b.cumulative_net >= 0 ? '1B8A4C' : 'C00000') },
      { label: 'Покрытие (%)',                  vals: buckets.map(b => fmtPct(b.coverage_ratio)), bold: false },
    ]

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 1000, right: 851, bottom: 1000, left: 1701 } } },
        children: [
          // Title
          para('Служба управления рисками', { bold: true, size: 26, center: true, after: 40 }),
          para('ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ (CFP)', { bold: true, size: 28, center: true, after: 40 }),
          para('Contingency Funding Plan · Срочные корзины · Инструкция НБТ №247', { size: 20, center: true, after: 40 }),
          para(`Дата составления: ${today}`, { size: 20, center: true, after: 300 }),

          // 1. General info
          sectionHead('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [cell('Название плана',  { gray: true, bold: true }), cell(r.report_name || '—')] }),
              new TableRow({ children: [cell('Аналитик',        { gray: true, bold: true }), cell(r.analyst_name || '—')] }),
              new TableRow({ children: [cell('Период действия', { gray: true, bold: true }), cell(r.plan_period || '—')] }),
              new TableRow({ children: [cell('Дата плана',      { gray: true, bold: true }), cell(r.plan_date || today)] }),
            ],
          }),
          para('', { after: 80 }),

          // 2. Normatives
          ...(r.car11 != null ? [
            sectionHead('2. НОРМАТИВЫ НБТ (Инструкция №176 / №247)'),
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: [4500, 1600, 1600, 1654],
              rows: [
                new TableRow({ children: [cell('Норматив / Формула', { green: true, bold: true }), cell('Норма НБТ', { green: true, bold: true, center: true }), cell('Значение (%)', { green: true, bold: true, center: true }), cell('Статус', { green: true, bold: true, center: true })] }),
                ...([
                  { code: 'CAR 1.1 = Кр / Ар × 100%',  norm: '≥ 12%', val: car11, st: s11 },
                  { code: 'CAR 1.2 = Кр / А × 100%',   norm: '≥ 10%', val: car12, st: s12 },
                  { code: 'CAR 1.3 = Чок / Ар × 100%', norm: '≥ 10%', val: car13, st: s13 },
                  { code: 'К2-1 = ЛАТ / ОВТ × 100%',  norm: '≥ 30%', val: k21,   st: sk21 },
                ].map(n => new TableRow({ children: [
                  cell(n.code), cell(n.norm, { center: true }),
                  cell(n.val > 0 ? n.val + '%' : '—', { center: true, bold: true }),
                  new TableCell({ borders, shading: { fill: STATUS_BG(n.st), type: ShadingType.CLEAR }, margins: { top: 70, bottom: 70, left: 120, right: 120 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n.st === 'red' ? 'НАРУШЕНИЕ' : n.st === 'yellow' ? 'Близко к норме' : 'Норма', size: 18, bold: true, color: STATUS_COLOR(n.st), font: 'Times New Roman' })] })] }),
                ]}))),
              ],
            }),
            para('', { after: 80 }),
          ] : []),

          // 3. CFP summary by buckets
          ...(hasBuckets ? [
            sectionHead('3. СВОДНАЯ CFP-ТАБЛИЦА ПО ВРЕМЕННЫМ КОРЗИНАМ'),
            bucketTable('Показатель', summaryRows),
            para('', { after: 80 }),
            // Status row
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: COL_WIDTHS,
              rows: [new TableRow({ children: [
                cell('Статус ликвидности', { gray: true, bold: true }),
                ...buckets.map(b => new TableCell({
                  borders,
                  shading: { fill: STATUS_BG(b.status), type: ShadingType.CLEAR },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: STATUS_LABEL(b.status), size: 18, bold: true, color: STATUS_COLOR(b.status), font: 'Times New Roman' })] })],
                })),
              ]})],
            }),
            para('', { after: 80 }),
            // Legend
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: [3118, 3118, 3118],
              rows: [new TableRow({ children: [
                new TableCell({ borders: noborders, shading: { fill: 'E8F4E8', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Профицит: поступления ≥ оттоков', size: 18, color: '1B8A4C', bold: true, font: 'Times New Roman' })] })] }),
                new TableCell({ borders: noborders, shading: { fill: 'FFF3CD', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Внимание: дефицит ≤ 20% оттоков', size: 18, color: 'BF8F00', bold: true, font: 'Times New Roman' })] })] }),
                new TableCell({ borders: noborders, shading: { fill: 'FFE7E7', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Дефицит: > 20% оттоков', size: 18, color: 'C00000', bold: true, font: 'Times New Roman' })] })] }),
              ]})],
            }),
            para('', { after: 80 }),

            // 4. Outflows detail
            sectionHead('4. ДЕТАЛИЗАЦИЯ ОТТОКОВ (млн TJS)'),
            bucketTable('Статья оттоков', OUTFLOW_ROWS.map((label, ri) => ({
              label, vals: outflowsRows[ri]?.map(fmt) ?? Array(7).fill('—'),
            }))),
            para('', { after: 80 }),

            // 5. Inflows detail
            sectionHead('5. ДЕТАЛИЗАЦИЯ ПОСТУПЛЕНИЙ (млн TJS)'),
            bucketTable('Статья поступлений', INFLOW_ROWS.map((label, ri) => ({
              label, vals: inflowsRows[ri]?.map(fmt) ?? Array(7).fill('—'),
            }))),
            para('', { after: 80 }),
          ] : []),

          // 6. CFP text
          sectionHead(`${hasBuckets ? '6' : '3'}. ПЛАН ФИНАНСИРОВАНИЯ (CFP-ДОКУМЕНТ)`),
          ...(r.ai_conclusion
            ? r.ai_conclusion.split('\n').filter((l: string) => l.trim()).map((line: string) =>
                para(line, { indent: !line.startsWith('РАЗДЕЛ') && !line.match(/^\d+\./) })
              )
            : [para('Документ не сгенерирован', { color: '999999' })]),

          // Signature
          para('', { after: 300 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [para('Аналитик: _________________', { after: 60 }), para(r.analyst_name ? `(${r.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 })] }),
              new TableCell({ borders: noborders, children: [para(`г. Душанбе, ${today}`, { center: true, after: 0 })] }),
            ]})],
          }),
        ],
      }],
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="CFP_${r.report_name || 'plan'}.docx"`,
      },
    })
  } catch (err) {
    console.error('CFP Word error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

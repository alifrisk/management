import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType,
} from 'docx'

const b   = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const nob = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const borders   = { top: b,   bottom: b,   left: b,   right: b   }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const BUCKETS = ['Текущая дата', '1–30 дн.', '31–90 дн.', '91–180 дн.', '181–365 дн.', '1–3 года', 'свыше 3 лет']
const ASSET_ROWS = ['Наличность и кор.счета', 'Краткосрочные МБК размещённые', 'Ценные бумаги НБТ/ГКО', 'Кредиты юрлицам', 'Кредиты физлицам', 'Прочие активы']
const LIAB_ROWS  = ['Текущие счета клиентов', 'Срочные депозиты физлиц', 'Срочные депозиты юрлиц', 'МБК привлечённые', 'Выпущенные долговые бумаги', 'Прочие обязательства']

const fmt = (n: number) => n !== 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const fmtPct = (n: number | null) => n != null ? n.toFixed(1) + '%' : '—'

const STATUS_COLOR = (s: string) => s === 'red' ? 'C00000' : s === 'yellow' ? 'BF8F00' : '1B8A4C'
const STATUS_BG    = (s: string) => s === 'red' ? 'FFE7E7' : s === 'yellow' ? 'FFF3CD' : 'E8F4E8'
const STATUS_LABEL = (s: string) => s === 'red' ? 'Дефицит' : s === 'yellow' ? 'Внимание' : 'Норма'

const cell = (text: string, opts: {
  gray?: boolean; green?: boolean; bold?: boolean; center?: boolean
  color?: string; bg?: string; size?: number
} = {}) => new TableCell({
  borders,
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.bg    ? { fill: opts.bg,    type: ShadingType.CLEAR }
         : opts.green ? { fill: 'E8F4E8', type: ShadingType.CLEAR }
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
  bold?: boolean; size?: number; center?: boolean; after?: number; before?: number; color?: string
} = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
  spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
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

// Wide table with bucket columns (label col + 7 bucket cols)
const COL_WIDTHS = [2600, 953, 953, 953, 953, 953, 953, 1036] // total 9354

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
        ...BUCKETS.map(b => cell(b, { green: true, bold: true, center: true, size: 16 })),
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
    const today     = new Date().toLocaleDateString('ru-RU')
    const periodStr = r.period_date ? new Date(r.period_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '—'

    const buckets: {
      label: string; assets: number; liabilities: number; gap: number
      cumulative_gap: number; liquidity_ratio: number | null; status: string
    }[] = r.gap_results?.buckets || []

    const assetsRows:  number[][] = r.assets_data?.rows      || Array(6).fill(Array(7).fill(0))
    const liabRows:    number[][] = r.liabilities_data?.rows || Array(6).fill(Array(7).fill(0))

    // Gap summary rows
    const gapRows = [
      { label: 'Активы (TJS)',           vals: buckets.map(b => fmt(b.assets)),      bold: false },
      { label: 'Обязательства (TJS)',    vals: buckets.map(b => fmt(b.liabilities)), bold: false },
      {
        label: 'ГЭП (TJS)',
        vals:   buckets.map(b => (b.gap >= 0 ? '+' : '') + fmt(b.gap)),
        bold: true,
        colors: buckets.map(b => STATUS_COLOR(b.status)),
      },
      {
        label: 'Накопленный ГЭП (TJS)',
        vals:   buckets.map(b => (b.cumulative_gap >= 0 ? '+' : '') + fmt(b.cumulative_gap)),
        bold: true,
        colors: buckets.map(b => b.cumulative_gap >= 0 ? '1B8A4C' : 'C00000'),
      },
      { label: 'Коэф. ликвидности (%)', vals: buckets.map(b => fmtPct(b.liquidity_ratio)), bold: false },
    ]

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 1000, right: 851, bottom: 1000, left: 1701 } } },
        children: [
          // Заголовок (landscape)
          para('Служба управления рисками', { bold: true, size: 26, center: true, after: 40 }),
          para('ГЭП-АНАЛИЗ ЛИКВИДНОСТИ', { bold: true, size: 28, center: true, after: 40 }),
          para('Разрывы ликвидности по временным корзинам · Инструкция НБТ №247', { size: 20, center: true, after: 40 }),
          para(`Период: ${periodStr}   ·   Дата составления: ${today}`, { size: 20, center: true, after: 300 }),

          // 1. Общие сведения
          sectionHead('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [cell('Период анализа', { gray: true, bold: true }), cell(periodStr)] }),
              new TableRow({ children: [cell('Аналитик',       { gray: true, bold: true }), cell(r.analyst_name || '—')] }),
              new TableRow({ children: [cell('Дата создания',  { gray: true, bold: true }), cell(new Date(r.created_at).toLocaleDateString('ru-RU'))] }),
            ],
          }),
          para('', { after: 80 }),

          // 2. Сводная таблица ГЭП
          sectionHead('2. СВОДНАЯ ТАБЛИЦА ГЭП-АНАЛИЗА'),
          bucketTable('Показатель', gapRows),
          para('', { after: 80 }),

          // Статус по корзинам
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: COL_WIDTHS,
            rows: [new TableRow({ children: [
              cell('Статус', { gray: true, bold: true }),
              ...buckets.map(b => new TableCell({
                borders,
                shading: { fill: STATUS_BG(b.status), type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: STATUS_LABEL(b.status), size: 18, bold: true, color: STATUS_COLOR(b.status), font: 'Times New Roman' })] })],
              })),
            ]})],
          }),
          para('', { after: 80 }),

          // Легенда
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3118, 3118, 3118],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, shading: { fill: 'E8F4E8', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Норма: ГЭП ≥ 0', size: 18, color: '1B8A4C', bold: true, font: 'Times New Roman' })] })] }),
              new TableCell({ borders: noborders, shading: { fill: 'FFF3CD', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Внимание: дефицит ≤ 10% обяз.', size: 18, color: 'BF8F00', bold: true, font: 'Times New Roman' })] })] }),
              new TableCell({ borders: noborders, shading: { fill: 'FFE7E7', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Дефицит: > 10% обязательств', size: 18, color: 'C00000', bold: true, font: 'Times New Roman' })] })] }),
            ]})],
          }),
          para('', { after: 80 }),

          // 3. Детали активов
          sectionHead('3. ДЕТАЛЬНЫЕ ДАННЫЕ — АКТИВЫ (TJS)'),
          bucketTable('Статья актива', ASSET_ROWS.map((label, ri) => ({
            label,
            vals: assetsRows[ri]?.map(fmt) ?? Array(7).fill('—'),
          }))),
          para('', { after: 80 }),

          // 4. Детали обязательств
          sectionHead('4. ДЕТАЛЬНЫЕ ДАННЫЕ — ОБЯЗАТЕЛЬСТВА (TJS)'),
          bucketTable('Статья обязательства', LIAB_ROWS.map((label, ri) => ({
            label,
            vals: liabRows[ri]?.map(fmt) ?? Array(7).fill('—'),
          }))),
          para('', { after: 80 }),

          // Подпись
          para('', { after: 200 }),
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
        'Content-Disposition': `attachment; filename="GAP_${periodStr.replace(/\s/g, '_')}.docx"`,
      },
    })
  } catch (err) {
    console.error('GAP Word error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

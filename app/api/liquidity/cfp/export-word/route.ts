import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType,
} from 'docx'

const b   = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const bG  = { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' }
const nob = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const borders   = { top: b,   bottom: b,   left: b,   right: b   }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) : '—'

const cell = (text: string, opts: {
  gray?: boolean; green?: boolean; bold?: boolean; center?: boolean
  color?: string; bg?: string; colSpan?: number; size?: number
} = {}) => new TableCell({
  borders,
  columnSpan: opts.colSpan,
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.bg    ? { fill: opts.bg,    type: ShadingType.CLEAR }
         : opts.green ? { fill: 'E8F4E8', type: ShadingType.CLEAR }
         : opts.gray  ? { fill: 'F5F5F5', type: ShadingType.CLEAR }
         : undefined,
  margins: { top: 70, bottom: 70, left: 120, right: 120 },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(text ?? '—'), size: opts.size ?? 20,
      bold: !!opts.bold, color: opts.color ?? '000000', font: 'Times New Roman',
    })],
  })],
})

const para = (text: string, opts: {
  bold?: boolean; size?: number; center?: boolean
  after?: number; before?: number; color?: string; indent?: boolean
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

const STATUS_COLOR = (s: string) => s === 'red' ? 'C00000' : s === 'yellow' ? 'BF8F00' : '1B8A4C'
const STATUS_BG    = (s: string) => s === 'red' ? 'FFE7E7' : s === 'yellow' ? 'FFF3CD' : 'E8F4E8'
const STATUS_LABEL = (s: string) => s === 'red' ? 'НАРУШЕНИЕ' : s === 'yellow' ? 'Близко к нарушению' : 'Норма'

function normStatus(val: number, norm: number, warnBuffer: number) {
  if (val <= 0) return 'green'
  if (val < norm) return 'red'
  if (val < norm + warnBuffer) return 'yellow'
  return 'green'
}

export async function POST(request: Request) {
  try {
    const { report: r } = await request.json()
    const today = new Date().toLocaleDateString('ru-RU')
    const isNew = r.car11 != null

    // Norms
    const car11 = Number(r.car11) || 0
    const car12 = Number(r.car12) || 0
    const car13 = Number(r.car13) || 0
    const k21   = Number(r.k21)   || 0
    const s11   = normStatus(car11, 12, 1)
    const s12   = normStatus(car12, 10, 1)
    const s13   = normStatus(car13, 10, 1)
    const sk21  = normStatus(k21,   30, 5)

    const liab = r.liabilities || {}
    const td   = Number(liab.term_deposits)    || 0
    const ca   = Number(liab.current_accounts) || 0
    const ib   = Number(liab.interbank)        || 0
    const oth  = Number(liab.other)            || 0
    const totalL = td + ca + ib + oth

    const sources: { name: string; amount: number; access_term: string; status: string }[] = r.funding_sources || []
    const totalF = sources.reduce((s: number, x: { amount: number }) => s + (x.amount || 0), 0)

    const normRows = isNew ? [
      { code: 'CAR 1.1 = Кр / Ар × 100%',  norm: '≥ 12%', val: car11, st: s11 },
      { code: 'CAR 1.2 = Кр / А × 100%',   norm: '≥ 10%', val: car12, st: s12 },
      { code: 'CAR 1.3 = Чок / Ар × 100%', norm: '≥ 10%', val: car13, st: s13 },
      { code: 'К2-1 = ЛАТ / ОВТ × 100%',  norm: '≥ 30%', val: k21,   st: sk21 },
    ] : []

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          // Заголовок
          para('Служба управления рисками', { bold: true, size: 26, center: true, after: 40 }),
          para('ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ', { bold: true, size: 28, center: true, after: 40 }),
          para('Contingency Funding Plan (CFP) · Инструкция НБТ №247', { size: 20, center: true, after: 40 }),
          para(`Дата: ${today}`, { size: 20, center: true, after: 300 }),

          // 1. Общие сведения
          sectionHead('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [cell('Название плана', { gray: true, bold: true }), cell(r.report_name || '—')] }),
              new TableRow({ children: [cell('Аналитик',       { gray: true, bold: true }), cell(r.analyst_name || '—')] }),
              new TableRow({ children: [cell('Период действия', { gray: true, bold: true }), cell(r.plan_period || '—')] }),
              new TableRow({ children: [cell('Дата составления', { gray: true, bold: true }), cell(r.plan_date || today)] }),
            ],
          }),
          para('', { after: 80 }),

          // 2. Нормативы
          ...(isNew ? [
            sectionHead('2. НОРМАТИВЫ НБТ (Инструкция №176 / №247)'),
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: [4500, 1600, 1600, 1654],
              rows: [
                new TableRow({ children: [
                  cell('Норматив / Формула', { green: true, bold: true }),
                  cell('Норма НБТ',          { green: true, bold: true, center: true }),
                  cell('Значение (%)',        { green: true, bold: true, center: true }),
                  cell('Статус',             { green: true, bold: true, center: true }),
                ]}),
                ...normRows.map(n => new TableRow({ children: [
                  cell(n.code),
                  cell(n.norm, { center: true }),
                  cell(n.val > 0 ? n.val + '%' : '—', { center: true, bold: true }),
                  new TableCell({
                    borders,
                    shading: { fill: STATUS_BG(n.st), type: ShadingType.CLEAR },
                    margins: { top: 70, bottom: 70, left: 120, right: 120 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: STATUS_LABEL(n.st), size: 18, bold: true, color: STATUS_COLOR(n.st), font: 'Times New Roman' })] })],
                  }),
                ]})),
              ],
            }),
            para('', { after: 80 }),
          ] : []),

          // 3. Структура обязательств
          ...(isNew && totalL > 0 ? [
            sectionHead('3. СТРУКТУРА ОБЯЗАТЕЛЬСТВ'),
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: [6000, 3354],
              rows: [
                new TableRow({ children: [cell('Статья', { green: true, bold: true }), cell('Сумма (млн TJS)', { green: true, bold: true, center: true })] }),
                new TableRow({ children: [cell('Срочные депозиты физлиц'),  cell(fmt(td), { center: true })] }),
                new TableRow({ children: [cell('Текущие счета клиентов'),   cell(fmt(ca), { center: true })] }),
                new TableRow({ children: [cell('МБК привлечённые'),         cell(fmt(ib), { center: true })] }),
                new TableRow({ children: [cell('Прочие обязательства'),     cell(fmt(oth), { center: true })] }),
                new TableRow({ children: [cell('ИТОГО', { bold: true }),    cell(fmt(totalL), { center: true, bold: true, color: '1B8A4C' })] }),
              ],
            }),
            para('', { after: 80 }),
          ] : []),

          // 4. Источники финансирования
          ...(isNew && sources.length > 0 ? [
            sectionHead('4. ИСТОЧНИКИ ЭКСТРЕННОГО ФИНАНСИРОВАНИЯ'),
            new Table({
              width: { size: 9354, type: WidthType.DXA }, columnWidths: [3500, 2000, 2000, 1854],
              rows: [
                new TableRow({ children: [
                  cell('Источник', { green: true, bold: true }),
                  cell('Сумма (млн TJS)', { green: true, bold: true, center: true }),
                  cell('Срок доступа',   { green: true, bold: true, center: true }),
                  cell('Статус',         { green: true, bold: true, center: true }),
                ]}),
                ...sources.map((s: { name: string; amount: number; access_term: string; status: string }) => new TableRow({ children: [
                  cell(s.name),
                  cell(fmt(s.amount), { center: true }),
                  cell(s.access_term || '—', { center: true }),
                  new TableCell({
                    borders,
                    shading: { fill: s.status === 'Доступен' ? 'E8F4E8' : s.status === 'Условно доступен' ? 'FFF3CD' : 'FFE7E7', type: ShadingType.CLEAR },
                    margins: { top: 70, bottom: 70, left: 120, right: 120 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.status, size: 18, font: 'Times New Roman', color: s.status === 'Доступен' ? '1B8A4C' : s.status === 'Условно доступен' ? 'BF8F00' : 'C00000' })] })],
                  }),
                ]})),
                new TableRow({ children: [
                  cell('ИТОГО доступно', { bold: true }),
                  cell(fmt(totalF), { center: true, bold: true, color: '1B8A4C' }),
                  cell('', { colSpan: 2 }),
                ]}),
              ],
            }),
            para('', { after: 80 }),
          ] : []),

          // 5. CFP-план
          sectionHead(`${isNew ? '5' : '2'}. ПЛАН ФИНАНСИРОВАНИЯ (CFP-ДОКУМЕНТ)`),
          ...(r.ai_conclusion
            ? r.ai_conclusion.split('\n').filter((l: string) => l.trim()).map((line: string) =>
                para(line, { indent: !line.startsWith('РАЗДЕЛ') && !line.match(/^\d+\./) })
              )
            : [para('Документ не сгенерирован', { color: '999999' })]),

          // Подпись
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

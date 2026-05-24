import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

const CRITERIA_LABELS: Record<string, string> = {
  score_intl_rating: 'Международный рейтинг',
  score_national_rating: 'Национальный рейтинг',
  score_bank_history: 'История банка',
  score_ownership: 'Состав собственников',
  score_license: 'Отзыв лицензии',
  score_rating_revocation: 'Отзыв рейтинга',
  score_sanctions: 'Санкционные списки',
  score_negative_media: 'Негативные СМИ',
  score_asset_volume: 'Объём активов',
  score_capital_adequacy: 'Достаточность капитала (CAR)',
  score_profitability: 'Рентабельность (ROE)',
  score_liquidity: 'Ликвидность (LCR)',
}

const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const borders = { top: b, bottom: b, left: b, right: b }
const bGreen = { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' }
const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

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

const sectionHead = (num: string, title: string) => new Paragraph({
  spacing: { before: 240, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B8A4C' } },
  children: [
    new TextRun({ text: `${num}. `, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
    new TextRun({ text: title, size: 24, bold: true, color: '1B8A4C', font: 'Times New Roman' }),
  ]
})

export async function POST(request: Request) {
  try {
    const { assessment: a } = await request.json()
    const today = a.assessment_date
      ? new Date(a.assessment_date).toLocaleDateString('ru-RU')
      : new Date().toLocaleDateString('ru-RU')

    const scoreColor = a.total_score >= 50 ? '1B8A4C' : a.total_score >= 40 ? '1F5DA8' : a.total_score >= 25 ? 'BF8F00' : 'C00000'
    const bgColor = a.total_score >= 50 ? 'E8F4E8' : a.total_score >= 40 ? 'EBF3FF' : a.total_score >= 25 ? 'FFF9E6' : 'FFE7E7'

    const conclusionParagraphs = (a.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
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
          children: [new TextRun({ text, size: 22, bold: true, color: scoreColor, font: 'Times New Roman' })]
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
        alignment: AlignmentType.BOTH,
        spacing: { after: 80 },
        indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
      })
    })

    // ✅ Build criteria rows safely
    const criteriaRows = Object.entries(CRITERIA_LABELS).map(([key, label]) => {
      const score = Number((a as Record<string, unknown>)[key]) || 0
      const levelText = score === 4 ? 'Отлично' : score === 3 ? 'Хорошо' : score === 2 ? 'Удовл.' : score === 1 ? 'Риск' : '—'
      const levelColor = score >= 3 ? '1B8A4C' : score === 2 ? 'BF8F00' : score === 1 ? 'C00000' : '999999'
      return new TableRow({ children: [
        cell(label),
        cell(score > 0 ? `${score}/4` : '—', { center: true, bold: score > 0, color: levelColor }),
        cell(score > 0 ? String(score) : '—', { center: true, color: levelColor }),
        cell(levelText, { center: true, color: levelColor, bold: score > 0 }),
      ]})
    })

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
          para('ЗАКЛЮЧЕНИЕ ОБ ОЦЕНКЕ НАДЁЖНОСТИ КОНТРАГЕНТА', { bold: true, size: 28, center: true, after: 40 }),
          para(`Дата составления: ${today}`, { size: 20, center: true, after: 300, color: '555555' }),

          sectionHead('1', 'ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [cell('Наименование банка', { green: true, bold: true }), cell(a.bank_name || '—', { bold: true })] }),
              new TableRow({ children: [cell('Страна', { green: true }), cell(a.country || '—')] }),
              new TableRow({ children: [cell('Дата оценки', { green: true }), cell(a.created_at ? new Date(a.created_at).toLocaleDateString('ru-RU') : today)] }),
              new TableRow({ children: [cell('Аналитик', { green: true }), cell(a.analyst_name || '—')] }),
              new TableRow({ children: [cell('Стаж банка', { green: true }), cell(a.bank_history_years ? `${a.bank_history_years} лет` : '—')] }),
              new TableRow({ children: [cell('Международный рейтинг', { green: true }), cell(a.intl_rating_value || '—')] }),
              new TableRow({ children: [cell('Национальный рейтинг', { green: true }), cell(a.national_rating_value || '—')] }),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('2', 'ИТОГОВАЯ ОЦЕНКА'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3800, 5554],
            rows: [
              new TableRow({ children: [
                cell('Итоговый балл', { green: true, bold: true }),
                new TableCell({
                  borders,
                  shading: { fill: bgColor, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${a.total_score} / 60`, size: 32, bold: true, color: scoreColor, font: 'Times New Roman' })] })]
                })
              ]}),
              new TableRow({ children: [cell('Категория надёжности', { green: true, bold: true }), cell(a.reliability_category || '—', { bold: true, color: scoreColor })] }),
              new TableRow({ children: [cell('Рекомендуемый лимит', { green: true, bold: true }), cell(a.limit_recommendation || '—', { bold: true })] }),
              new TableRow({ children: [cell('CAR (достаточность капитала)', { green: true }), cell(a.car_ratio ? `${a.car_ratio}%` : '—')] }),
              new TableRow({ children: [cell('ROE (рентабельность)', { green: true }), cell(a.roe_ratio ? `${a.roe_ratio}%` : '—')] }),
              new TableRow({ children: [cell('LCR (ликвидность)', { green: true }), cell(a.lcr_ratio ? `${a.lcr_ratio}%` : '—')] }),
            ]
          }),
          para('', { after: 60 }),

          sectionHead('3', 'МАТРИЦА ОЦЕНОК ПО КРИТЕРИЯМ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [5200, 1600, 1400, 1154],
            rows: [
              new TableRow({ children: [
                cell('Критерий', { green: true, bold: true }),
                cell('Оценка', { green: true, bold: true, center: true }),
                cell('Из 4', { green: true, bold: true, center: true }),
                cell('Уровень', { green: true, bold: true, center: true }),
              ]}),
              ...criteriaRows,
            ]
          }),
          para('', { after: 60 }),

          sectionHead('4', 'ЗАКЛЮЧЕНИЕ СЛУЖБЫ УПРАВЛЕНИЯ РИСКАМИ'),
          ...conclusionParagraphs,
          para('', { after: 120 }),

          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [3200, 6154],
            rows: [
              new TableRow({ children: [
                new TableCell({
                  borders: { top: bGreen, bottom: bGreen, left: bGreen, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
                  shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 180, right: 180 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'РЕШЕНИЕ И РЕКОМЕНДАЦИЯ', size: 18, bold: true, color: '1B8A4C', font: 'Times New Roman' })] })]
                }),
                new TableCell({
                  borders: { top: bGreen, bottom: bGreen, right: bGreen, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
                  shading: { fill: bgColor, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 180, right: 180 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: a.recommendation || '—', size: 28, bold: true, color: scoreColor, font: 'Times New Roman' })
                  ]})]
                }),
              ]}),
              new TableRow({ children: [
                new TableCell({
                  borders,
                  shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'КАТЕГОРИЯ НАДЁЖНОСТИ', size: 18, bold: true, color: '555555', font: 'Times New Roman' })] })]
                }),
                new TableCell({
                  borders,
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: `${a.reliability_category || '—'} · ${a.total_score}/60`, size: 22, bold: true, color: scoreColor, font: 'Times New Roman' })
                  ]})]
                }),
              ]}),
            ]
          }),
          para('', { after: 300 }),

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
        'Content-Disposition': 'attachment; filename="Assessment.docx"',
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка Word: ' + String(error) }, { status: 500 })
  }
}

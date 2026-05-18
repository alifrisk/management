import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType, LevelFormat
} from 'docx'

const CRITERIA_LABELS: Record<string, string> = {
  intl_rating: 'Международный рейтинг',
  national_rating: 'Национальный рейтинг',
  bank_history: 'История банка',
  ownership: 'Состав собственников',
  license_revocation: 'Отзыв лицензии',
  rating_revocation: 'Отзыв рейтинга',
  sanctions: 'Санкционные списки',
  negative_media: 'Негативные СМИ',
  asset_volume: 'Объём активов',
  capital_adequacy: 'Достаточность капитала',
  profitability: 'Рентабельность',
  liquidity: 'Ликвидность (LCR)',
}

const b = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
const borders = { top: b, bottom: b, left: b, right: b }
const nob = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noborders = { top: nob, bottom: nob, left: nob, right: nob }

const makeCell = (text: string, opts: { gray?: boolean; bold?: boolean; center?: boolean; colSpan?: number; color?: string } = {}) =>
  new TableCell({
    borders,
    columnSpan: opts.colSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.gray ? { fill: 'E8F4E8', type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text || '—'), size: 18, bold: !!opts.bold, color: opts.color || '000000', font: 'Times New Roman' })]
    })]
  })

const makePara = (text: string, opts: { bold?: boolean; size?: number; center?: boolean; after?: number; color?: string } = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    spacing: { after: opts.after ?? 120, line: 276 },
    children: [new TextRun({ text: String(text || ''), size: opts.size ?? 22, bold: !!opts.bold, color: opts.color || '000000', font: 'Times New Roman' })]
  })

const makeSection = (title: string) =>
  new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
    children: [new TextRun({ text: title, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
  })

export async function POST(request: Request) {
  try {
    const { assessment: a } = await request.json()
    const today = a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')

    const scoreColor = a.total_score >= 50 ? '1B8A4C' : a.total_score >= 40 ? '1F5DA8' : a.total_score >= 25 ? 'BF8F00' : 'C00000'
    const bgColor = a.total_score >= 50 ? 'E8F4E8' : a.total_score >= 40 ? 'EBF3FF' : a.total_score >= 25 ? 'FFF3CD' : 'FFE7E7'

    const conclusionParagraphs = (a.ai_conclusion || '').split('\n').filter((l: string) => l.trim()).map((line: string) => {
      const text = line.trim()
      const isHeader = /^\d+\./.test(text)
      if (isHeader) {
        return new Paragraph({
          spacing: { before: 160, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1B8A4C' } },
          children: [new TextRun({ text, size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })]
        })
      }
      return new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 80 },
        indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, font: 'Times New Roman' })]
      })
    })

    const doc = new Document({
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 851, bottom: 1134, left: 1701 } } },
        children: [
          makePara('ҶСК «Алиф Бонк»', { bold: true, size: 28, center: true, after: 40 }),
          makePara('Служба управления рисками', { size: 20, center: true, after: 200 }),
          makePara('ЗАКЛЮЧЕНИЕ ОБ ОЦЕНКЕ НАДЁЖНОСТИ КОНТРАГЕНТА', { bold: true, size: 26, center: true, after: 40 }),
          makePara(`Дата составления: ${today}`, { size: 20, center: true, after: 300 }),

          makeSection('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [makeCell('Наименование банка', { gray: true, bold: true }), makeCell(a.bank_name)] }),
              new TableRow({ children: [makeCell('Страна', { gray: true, bold: true }), makeCell(a.country || '—')] }),
              new TableRow({ children: [makeCell('Дата оценки', { gray: true, bold: true }), makeCell(new Date(a.created_at).toLocaleDateString('ru-RU'))] }),
              new TableRow({ children: [makeCell('Аналитик', { gray: true, bold: true }), makeCell(a.analyst_name || '—')] }),
            ]
          }),
          makePara('', { after: 80 }),

          makeSection('2. ИТОГОВАЯ ОЦЕНКА'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [
                makeCell('Итоговый балл', { gray: true, bold: true }),
                new TableCell({
                  borders,
                  shading: { fill: bgColor, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${a.total_score} / 60`, size: 28, bold: true, color: scoreColor, font: 'Times New Roman' })] })]
                })
              ]}),
              new TableRow({ children: [makeCell('Категория надёжности', { gray: true, bold: true }), makeCell(a.reliability_category, { bold: true, color: scoreColor })] }),
              new TableRow({ children: [makeCell('Рекомендуемый лимит', { gray: true, bold: true }), makeCell(a.limit_recommendation, { bold: true })] }),
            ]
          }),
          makePara('', { after: 80 }),

          makeSection('3. ОЦЕНКА ПО КРИТЕРИЯМ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [5500, 1800, 2054],
            rows: [
              new TableRow({ children: [makeCell('Критерий', { gray: true, bold: true }), makeCell('Оценка', { gray: true, bold: true, center: true }), makeCell('Уровень', { gray: true, bold: true, center: true })] }),
              ...Object.entries(CRITERIA_LABELS).map(([key, label]) => {
                const score = a[key] || 0
                const levelText = score === 4 ? 'Отлично' : score === 3 ? 'Хорошо' : score === 2 ? 'Удовл.' : 'Риск'
                const levelColor = score >= 3 ? '1B8A4C' : score === 2 ? 'BF8F00' : 'C00000'
                return new TableRow({ children: [
                  makeCell(label),
                  makeCell(`${score}/4`, { center: true, bold: true, color: levelColor }),
                  makeCell(levelText, { center: true, color: levelColor }),
                ]})
              }),
            ]
          }),
          makePara('', { after: 80 }),

          makeSection('4. ЗАКЛЮЧЕНИЕ'),
          ...conclusionParagraphs,
          makePara('', { after: 120 }),

          // Recommendation box
          (() => {
            const recColor = a.total_score >= 40 ? '1B8A4C' : a.total_score >= 25 ? 'BF8F00' : 'C00000'
            const recBg = a.total_score >= 40 ? 'E8F4E8' : a.total_score >= 25 ? 'FFF3CD' : 'FFE7E7'
            return new Table({
              width: { size: 9354, type: WidthType.DXA },
              columnWidths: [3500, 5854],
              rows: [
                new TableRow({ children: [
                  new TableCell({ borders, shading: { fill: 'E8F4E8', type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [new Paragraph({ children: [new TextRun({ text: 'РЕКОМЕНДАЦИЯ', size: 22, bold: true, color: '1B8A4C', font: 'Times New Roman' })] })] }),
                  new TableCell({ borders, shading: { fill: recBg, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a.recommendation || '—', size: 24, bold: true, color: recColor, font: 'Times New Roman' })] })] }),
                ]}),
              ]
            })
          })(),
          makePara('', { after: 300 }),

          new Table({
            width: { size: 9354, type: WidthType.DXA },
            columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [makePara('Аналитик: _________________', { after: 60 }), makePara(a.analyst_name ? `(${a.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 })] }),
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
        'Content-Disposition': `attachment; filename="Assessment.docx"`,
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка Word: ' + String(error) }, { status: 500 })
  }
}

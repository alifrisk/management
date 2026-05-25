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
const fmt = (n: number) => n ? new Intl.NumberFormat('ru-RU').format(Math.round(n)) : '—'
const pct = (n: number) => n ? (n * 100).toFixed(1) + '%' : '—'
const makeCell = (text: string, opts: { gray?: boolean; bold?: boolean; center?: boolean; colSpan?: number; color?: string; bg?: string } = {}) =>
  new TableCell({
    borders, columnSpan: opts.colSpan, verticalAlign: VerticalAlign.CENTER,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : opts.gray ? { fill: 'E8F4E8', type: ShadingType.CLEAR } : undefined,
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
const riskLabel = (r: string) => r === 'High' ? 'Высокий' : r === 'Elevated' ? 'Повышенный' : 'Нормальный'
const riskColor = (r: string) => r === 'High' ? 'C00000' : r === 'Elevated' ? 'BF8F00' : '1B8A4C'
const riskBg = (r: string) => r === 'High' ? 'FFE7E7' : r === 'Elevated' ? 'FFF3CD' : 'E8F4E8'
const covColor = (v: number) => v >= 1.1 ? '1B8A4C' : v >= 1.0 ? 'BF8F00' : 'C00000'
const makeRiskCell = (risk: string) => new TableCell({
  borders, shading: { fill: riskBg(risk), type: ShadingType.CLEAR },
  margins: { top: 80, bottom: 80, left: 100, right: 100 },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: riskLabel(risk), size: 20, bold: true, color: riskColor(risk), font: 'Times New Roman' })] })]
})
const makeCovCell = (v: number) => new TableCell({
  borders, margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pct(v), size: 20, bold: true, color: covColor(v), font: 'Times New Roman' })] })]
})
export async function POST(request: Request) {
  try {
    const { test: t } = await request.json()
    const today = t.test_date ? new Date(t.test_date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')
    const overallRisk = (t.risk_t1 === 'High' || t.risk_t7 === 'High' || t.risk_t30 === 'High') ? 'High'
      : (t.risk_t7 === 'Elevated' || t.risk_t30 === 'Elevated') ? 'Elevated' : 'Normal'
    const overallColor = overallRisk === 'High' ? 'C00000' : overallRisk === 'Elevated' ? 'BF8F00' : '1B8A4C'
    const overallBg = overallRisk === 'High' ? 'FFE7E7' : overallRisk === 'Elevated' ? 'FFF9E6' : 'E8F4E8'
    const t1ok = (t.coverage_cash_t1 || 0) >= 1.0
    const t7ok = (t.coverage_cash_t7 || 0) >= 1.0
    const t30ok = (t.coverage_cash_t30 || 0) >= 1.0
    // ✅ Cash Only sufficiency check
    const t1only = (t.coverage_only_t1 || 0) >= 1.0
    const t7only = (t.coverage_only_t7 || 0) >= 1.0
    const t30only = (t.coverage_only_t30 || 0) >= 1.0
    const cashOnlyIsReason = (t.risk_t1 === 'High' || t.risk_t7 === 'High' || t.risk_t30 === 'High')
      && (t1ok || t7ok || t30ok)
      && (!t1only || !t7only || !t30only)
    const addPara = (text: string, bold = false, color = '000000') =>
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 100, line: 276 },
        indent: { firstLine: 360 },
        children: [new TextRun({ text, size: 20, bold, color, font: 'Times New Roman' })]
      })
    const conclusionItems: (Paragraph | Table)[] = [
      addPara('По результатам стресс-теста ликвидности в пессимистическом сценарии банк демонстрирует следующие показатели покрытия обязательств:'),
      addPara(
        `T+1 (1 день): Cash & Eq — ${((t.coverage_cash_t1 || 0) * 100).toFixed(1)}%, Cash Only — ${((t.coverage_only_t1 || 0) * 100).toFixed(1)}% — ${t1ok ? 'ПРОФИЦИТ' : 'ДЕФИЦИТ'}. ` +
        (t1ok && !t1only ? 'Покрытие достигается за счёт эквивалентов (ЦБ, краткосрочные бумаги), физических наличных недостаточно.' :
         t1ok ? 'Буфер ликвидности достаточен.' : `Дефицит: ${fmt((t.need_t1 || 0) - (t.cash_equivalents || 0))} TJS.`),
        false, t1ok ? '1B8A4C' : 'C00000'
      ),
      addPara(
        `T+7 (7 дней): Cash & Eq — ${((t.coverage_cash_t7 || 0) * 100).toFixed(1)}%, Cash Only — ${((t.coverage_only_t7 || 0) * 100).toFixed(1)}% — ${t7ok ? 'ПРОФИЦИТ' : 'ДЕФИЦИТ'}. ` +
        (t7ok && !t7only ? 'Покрытие достигается за счёт эквивалентов, физических наличных недостаточно.' :
         t7ok ? 'Семидневный горизонт покрывается.' : `Дефицит: ${fmt((t.need_t7 || 0) - (t.cash_equivalents || 0))} TJS.`),
        false, t7ok ? '1B8A4C' : 'C00000'
      ),
      addPara(
        `T+30 (30 дней): Cash & Eq — ${((t.coverage_cash_t30 || 0) * 100).toFixed(1)}%, Cash Only — ${((t.coverage_only_t30 || 0) * 100).toFixed(1)}% — ${t30ok ? 'ПРОФИЦИТ' : 'ДЕФИЦИТ'}. ` +
        (t30ok && !t30only ? 'Покрытие достигается за счёт эквивалентов, физических наличных недостаточно.' :
         t30ok ? 'Банк устойчив в 30-дневном горизонте.' : `Дефицит: ${fmt((t.need_t30 || 0) - (t.cash_equivalents || 0))} TJS.`),
        false, t30ok ? '1B8A4C' : 'C00000'
      ),
      // ✅ Explain why risk is High when Cash&Eq is OK but Cash Only is not
      ...(cashOnlyIsReason ? [
        new Paragraph({
          spacing: { after: 100, before: 120, line: 276 },
          shading: { fill: 'FFE7E7', type: ShadingType.CLEAR },
          indent: { left: 200, right: 200 },
          children: [new TextRun({
            text: '⚠ Причина высокого риска: несмотря на достаточность общего буфера (Cash & Equivalents), объём физических наличных (Cash Only) не покрывает стресс-потребность. Эквиваленты (средства в ЦБ, краткосрочные ценные бумаги) требуют времени для конвертации и могут быть недоступны в момент острой нехватки ликвидности.',
            size: 18, bold: false, color: 'C00000', font: 'Times New Roman'
          })]
        })
      ] : []),
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
        ...(cashOnlyIsReason ? [addPara('5. Рассмотреть возможность увеличения объёма физических наличных и средств на корсчёте ЦБ.')] : []),
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
      makePara('', { after: 120 }),
      new Table({
        width: { size: 9354, type: WidthType.DXA },
        columnWidths: [3200, 6154],
        rows: [new TableRow({ children: [
          new TableCell({
            borders: { top: bGreen, bottom: bGreen, left: bGreen, right: b },
            shading: { fill: 'E8F4E8', type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [new Paragraph({ children: [new TextRun({ text: 'ОБЩИЙ УРОВЕНЬ РИСКА', size: 18, bold: true, color: '1B8A4C', font: 'Times New Roman' })] })]
          }),
          new TableCell({
            borders: { top: bGreen, bottom: bGreen, right: bGreen, left: b },
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
          makePara('ҶСК «Алиф Бонк»', { bold: true, size: 28, center: true, after: 40 }),
          makePara('Служба управления рисками', { size: 20, center: true, after: 200 }),
          makePara('СТРЕСС-ТЕСТ ЛИКВИДНОСТИ', { bold: true, size: 28, center: true, after: 40 }),
          makePara('Пессимистический сценарий · T+1 / T+7 / T+30', { size: 20, center: true, after: 40 }),
          makePara(`Дата: ${today}`, { size: 20, center: true, after: 300 }),
          makeSection('1. ОБЩИЕ СВЕДЕНИЯ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4000, 5354],
            rows: [
              new TableRow({ children: [makeCell('Наименование теста', { gray: true, bold: true }), makeCell(t.test_name)] }),
              new TableRow({ children: [makeCell('Дата', { gray: true, bold: true }), makeCell(today)] }),
              new TableRow({ children: [makeCell('Аналитик', { gray: true, bold: true }), makeCell(t.analyst_name || '—')] }),
              new TableRow({ children: [makeCell('Общий уровень риска', { gray: true, bold: true }), makeRiskCell(overallRisk)] }),
            ]
          }),
          makePara('', { after: 80 }),
          makeSection('2. РЕЗУЛЬТАТЫ СТРЕСС-ТЕСТА'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [3200, 2051, 2051, 2052],
            rows: [
              new TableRow({ children: [makeCell('Показатель', { gray: true, bold: true }), makeCell('T+1 (1 день)', { gray: true, bold: true, center: true }), makeCell('T+7 (7 дней)', { gray: true, bold: true, center: true }), makeCell('T+30 (30 дней)', { gray: true, bold: true, center: true })] }),
              new TableRow({ children: [makeCell('Отток обязательств (TJS)'), makeCell(fmt(t.outflow_t1), { center: true }), makeCell(fmt(t.outflow_t7), { center: true }), makeCell(fmt(t.outflow_t30), { center: true })] }),
              new TableRow({ children: [makeCell('Использование кредитных линий (TJS)'), makeCell(fmt(t.drawdown_t1), { center: true }), makeCell(fmt(t.drawdown_t7), { center: true }), makeCell(fmt(t.drawdown_t30), { center: true })] }),
              new TableRow({ children: [makeCell('Потребность в ликвидности (TJS)', { bold: true }), makeCell(fmt(t.need_t1), { center: true, bold: true }), makeCell(fmt(t.need_t7), { center: true, bold: true }), makeCell(fmt(t.need_t30), { center: true, bold: true })] }),
              new TableRow({ children: [makeCell('Cash & Equivalents (буфер, TJS)'), makeCell(fmt(t.cash_equivalents), { center: true }), makeCell(fmt(t.cash_equivalents), { center: true }), makeCell(fmt(t.cash_equivalents), { center: true })] }),
              new TableRow({ children: [makeCell('Покрытие (Cash & Eq)'), makeCovCell(t.coverage_cash_t1), makeCovCell(t.coverage_cash_t7), makeCovCell(t.coverage_cash_t30)] }),
              new TableRow({ children: [makeCell('Cash Only (буфер, TJS)'), makeCell(fmt(t.cash_only), { center: true }), makeCell(fmt(t.cash_only), { center: true }), makeCell(fmt(t.cash_only), { center: true })] }),
              new TableRow({ children: [makeCell('Покрытие (Cash Only)'), makeCovCell(t.coverage_only_t1), makeCovCell(t.coverage_only_t7), makeCovCell(t.coverage_only_t30)] }),
              new TableRow({ children: [makeCell('Уровень риска', { bold: true }), makeRiskCell(t.risk_t1), makeRiskCell(t.risk_t7), makeRiskCell(t.risk_t30)] }),
            ]
          }),
          makePara('', { after: 80 }),
          makeSection('3. ВХОДНЫЕ ДАННЫЕ И СТРЕСС-КОЭФФИЦИЕНТЫ'),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4200, 2577, 2577],
            rows: [
              new TableRow({ children: [makeCell('Статья', { gray: true, bold: true }), makeCell('Сумма (TJS)', { gray: true, bold: true, center: true }), makeCell('Стресс T+1/T+7/T+30', { gray: true, bold: true, center: true })] }),
              new TableRow({ children: [makeCell('Межбанковские обязательства'), makeCell(fmt(t.due_to_banks), { center: true }), makeCell('100% / 100% / 100%', { center: true })] }),
              new TableRow({ children: [makeCell('Текущие счета клиентов'), makeCell(fmt(t.current_accounts), { center: true }), makeCell('20% / 35% / 50%', { center: true })] }),
              new TableRow({ children: [makeCell('Электронный кошелёк'), makeCell(fmt(t.electronic_wallet), { center: true }), makeCell('10% / 15% / 20%', { center: true })] }),
              new TableRow({ children: [makeCell('Накопительные счета'), makeCell(fmt(t.savings), { center: true }), makeCell('3% / 7% / 10%', { center: true })] }),
              new TableRow({ children: [makeCell('Срочные депозиты'), makeCell(fmt(t.term_deposits), { center: true }), makeCell('5% / 20% / 35%', { center: true })] }),
              new TableRow({ children: [makeCell('Кредитная линия Salom'), makeCell(fmt(t.credit_line_salom), { center: true }), makeCell('5% / 7% / 10%', { center: true })] }),
              new TableRow({ children: [makeCell('Кредитная линия SME'), makeCell(fmt(t.credit_line_sme), { center: true }), makeCell('0% / 0% / 0%', { center: true })] }),
              new TableRow({ children: [makeCell('Cash & Cash Equivalents', { bold: true }), makeCell(fmt(t.cash_equivalents), { center: true, bold: true }), makeCell('Буфер', { center: true })] }),
              new TableRow({ children: [makeCell('Cash Only', { bold: true }), makeCell(fmt(t.cash_only), { center: true, bold: true }), makeCell('Буфер', { center: true })] }),
            ]
          }),
          makePara('', { after: 80 }),
          makeSection('4. ЗАКЛЮЧЕНИЕ И РЕКОМЕНДАЦИИ'),
          ...conclusionItems,
          makePara('', { after: 300 }),
          new Table({
            width: { size: 9354, type: WidthType.DXA }, columnWidths: [4677, 4677],
            rows: [new TableRow({ children: [
              new TableCell({ borders: noborders, children: [makePara('Аналитик: _________________', { after: 60 }), makePara(t.analyst_name ? `(${t.analyst_name})` : '(Ф.И.О.)', { size: 20, after: 0 })] }),
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
        'Content-Disposition': 'attachment; filename="StressTest.docx"',
      }
    })
  } catch (error) {
    console.error('Word error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

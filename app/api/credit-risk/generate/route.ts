import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'

export async function POST(request: Request) {
  try {
    const { formData } = await request.json()
    const fd = formData
    const f = (v: unknown) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(Number(v))) : '0'
    const pct = (v: number) => isFinite(v) && !isNaN(v) ? `${v.toFixed(1)}%` : 'н/д'
    const rat = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(2) : 'н/д'
    const div = (a: number, b: number) => b !== 0 ? a / b : 0
    const trend = (v1: number, v2: number) => {
      if (!v1 || !v2) return ''
      const chg = (v2 - v1) / Math.abs(v1) * 100
      return chg > 0 ? ` (+${chg.toFixed(1)}%)` : ` (${chg.toFixed(1)}%)`
    }

    // Balance components (sent from frontend via ...form spread)
    const p1_cash       = Number(fd.p1_cash       || 0)
    const p1_recv       = Number(fd.p1_receivables || 0)
    const p1_inv        = Number(fd.p1_inventory   || 0)
    const p2_cash       = Number(fd.p2_cash       || 0)
    const p2_recv       = Number(fd.p2_receivables || 0)
    const p2_inv        = Number(fd.p2_inventory   || 0)

    // Liquid (current) assets = Cash + Receivables + Inventory
    const p1_liquid = p1_cash + p1_recv + p1_inv
    const p2_liquid = p2_cash + p2_recv + p2_inv

    const p1_assets  = Number(fd.p1_total_assets      || 0)
    const p2_assets  = Number(fd.p2_total_assets      || 0)
    const p1_liab    = Number(fd.p1_total_liabilities || 0)
    const p2_liab    = Number(fd.p2_total_liabilities || 0)
    const p1_equity  = Number(fd.p1_equity_capital || 0) + Number(fd.p1_reserves || 0) + Number(fd.p1_retained_earnings || 0)
    const p2_equity  = Number(fd.p2_equity_capital || 0) + Number(fd.p2_reserves || 0) + Number(fd.p2_retained_earnings || 0)

    const p1_revenue = Number(fd.p1_revenue || 0)
    const p2_revenue = Number(fd.p2_revenue || 0)
    const p1_net     = Number(fd.p1_net || 0)
    const p2_net     = Number(fd.p2_net || 0)
    const p1_op_cf   = Number(fd.p1_op_inflow || 0) - Number(fd.p1_op_outflow || 0)
    const p2_op_cf   = Number(fd.p2_op_inflow || 0) - Number(fd.p2_op_outflow || 0)

    const monthly_payment   = Number(fd.monthly_payment || 0)
    const annual_payment    = monthly_payment * 12
    const loan_amount       = Number(fd.loan_amount || 0)
    const collateral_total  = (fd.collaterals || []).reduce((s: number, c: {value: number}) => s + (c.value || 0), 0)
    const conclusion_type   = fd.conclusion_type || 'Одобрение кредитной линии'
    const existing_balance  = Number(fd.existing_loan_balance || 0)
    const is_collateral_change = conclusion_type === 'Смена залога'

    // ── Pre-calculated ratios ──────────────────────────────────────────────────
    // 1. Текущая ликвидность = Ликвидные активы / Обязательства (≥1.5 — норма для МСБ)
    const p1_liq_cur = div(p1_liquid, p1_liab)
    const p2_liq_cur = div(p2_liquid, p2_liab)

    // 2. Абсолютная ликвидность = Денежные средства / Обязательства (≥0.2 — норма)
    const p1_liq_abs = div(p1_cash, p1_liab)
    const p2_liq_abs = div(p2_cash, p2_liab)

    // 3. Рентабельность продаж (ROS) = Чистая прибыль / Выручка × 100%
    const p1_ros = div(p1_net, p1_revenue) * 100
    const p2_ros = div(p2_net, p2_revenue) * 100

    // 4. Рентабельность активов (ROA) = Чистая прибыль / Активы × 100%
    const p1_roa = div(p1_net, p1_assets) * 100
    const p2_roa = div(p2_net, p2_assets) * 100

    // 5. Коэффициент автономии = Капитал / Активы × 100% (≥50% — норма)
    const p1_autonomy = div(p1_equity, p1_assets) * 100
    const p2_autonomy = div(p2_equity, p2_assets) * 100

    // 6. Долговая нагрузка = Обязательства / Активы × 100%
    const p1_debt_ratio = div(p1_liab, p1_assets) * 100
    const p2_debt_ratio = div(p2_liab, p2_assets) * 100

    // 7. DSC (покрытие долга) = Операционный ден. поток / Годовой платёж (≥1.2 — норма)
    const p1_dsc = annual_payment > 0 ? div(p1_op_cf, annual_payment) : 0
    const p2_dsc = annual_payment > 0 ? div(p2_op_cf, annual_payment) : 0

    // 8. Обеспеченность залогом = Залог / Кредит × 100%
    const collateral_coverage = div(collateral_total, loan_amount) * 100

    // ✅ Безопасность: AI не видит имя и ИНН заёмщика
    const collateral_coverage_existing = is_collateral_change && existing_balance > 0
      ? (collateral_total / existing_balance) * 100 : 0

    const prompt = `Ты старший кредитный риск-аналитик банка Алиф Банк (Таджикистон) с 15-летним опытом.

ВИД ЗАКЛЮЧЕНИЯ: ${conclusion_type}
${is_collateral_change ? '⚠️ Это заключение о СМЕНЕ ЗАЛОГА по действующему кредиту. Основной анализ — достаточность и качество нового залога.' : 'Твоя задача: дать КОНКРЕТНОЕ заключение с рекомендацией — одобрить или отклонить кредит.'}
Ты ОБЯЗАН дать рекомендацию даже если данных мало — на основе того что есть.

ВАЖНО: все финансовые коэффициенты уже рассчитаны системой — используй ТОЛЬКО эти значения, не пересчитывай самостоятельно.

═══ ДАННЫЕ ЗАЯВКИ ═══
Сектор бизнеса: ${fd.sector || 'не указан'}
Вид деятельности: ${fd.business_type || 'не указан'}
Лет в бизнесе: ${fd.years_in_business || 'не указано'}
Кредитная история: ${fd.credit_history}
${is_collateral_change
  ? `Остаток по действующему кредиту: ${f(existing_balance)} ${fd.loan_currency}
Причина смены залога: ${fd.loan_purpose}`
  : `Сумма кредита: ${f(fd.loan_amount)} ${fd.loan_currency}
Срок: ${fd.loan_term_months || '—'} мес.
Процентная ставка: ${fd.interest_rate || '—'}% годовых
Ежемесячное погашение: ${f(monthly_payment)} TJS
Цель: ${fd.loan_purpose}`}

═══ БАЛАНС (${fd.p1_label || 'П1'} → ${fd.p2_label || 'П2'}) ═══
Ликвидные активы (Деньги + Дебиторка + ТМЗ): ${f(p1_liquid)} → ${f(p2_liquid)}${trend(p1_liquid, p2_liquid)}
  Денежные средства:       ${f(p1_cash)} → ${f(p2_cash)}
  Дебиторская задолженность: ${f(p1_recv)} → ${f(p2_recv)}
  ТМЗ (запасы):            ${f(p1_inv)} → ${f(p2_inv)}
Итого активы:              ${f(p1_assets)} → ${f(p2_assets)}${trend(p1_assets, p2_assets)}
Итого обязательства:       ${f(p1_liab)} → ${f(p2_liab)}${trend(p1_liab, p2_liab)}
Собственный капитал:       ${f(p1_equity)} → ${f(p2_equity)}${trend(p1_equity, p2_equity)}

═══ ОПУ ═══
Выручка:         ${f(p1_revenue)} → ${f(p2_revenue)}${trend(p1_revenue, p2_revenue)}
Себестоимость:   ${f(fd.p1_cogs)} → ${f(fd.p2_cogs)}
Валовая прибыль: ${f(fd.p1_gross)} → ${f(fd.p2_gross)}
Операц. прибыль: ${f(fd.p1_op_profit)} → ${f(fd.p2_op_profit)}
Чистая прибыль:  ${f(p1_net)} → ${f(p2_net)}${trend(p1_net, p2_net)}

═══ ОДДС ═══
Операц. поток: ${f(p1_op_cf)} → ${f(p2_op_cf)}
Остаток конец: ${f(fd.p1_cash_end)} → ${f(fd.p2_cash_end)}

═══ ЗАЛОГ ═══
${(fd.collaterals||[]).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n') || 'Не указан'}
Общий залог: ${f(collateral_total)} TJS

═══ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ (рассчитаны системой, использовать точно) ═══

1. Коэффициент текущей ликвидности = (Деньги + Дебиторка + ТМЗ) / Обязательства [норма МСБ ≥1.5]
   П1: (${f(p1_cash)} + ${f(p1_recv)} + ${f(p1_inv)}) / ${f(p1_liab)} = ${rat(p1_liq_cur)} ${p1_liab > 0 ? (p1_liq_cur >= 1.5 ? '✓ норма' : p1_liq_cur >= 1.0 ? '⚠ допустимо' : '✗ низкая') : '(нет обязательств)'}
   П2: (${f(p2_cash)} + ${f(p2_recv)} + ${f(p2_inv)}) / ${f(p2_liab)} = ${rat(p2_liq_cur)} ${p2_liab > 0 ? (p2_liq_cur >= 1.5 ? '✓ норма' : p2_liq_cur >= 1.0 ? '⚠ допустимо' : '✗ низкая') : '(нет обязательств)'}

2. Коэффициент абсолютной ликвидности = Деньги / Обязательства [норма ≥0.2]
   П1: ${f(p1_cash)} / ${f(p1_liab)} = ${rat(p1_liq_abs)} ${p1_liab > 0 ? (p1_liq_abs >= 0.2 ? '✓ норма' : '✗ ниже нормы') : '(нет обязательств)'}
   П2: ${f(p2_cash)} / ${f(p2_liab)} = ${rat(p2_liq_abs)} ${p2_liab > 0 ? (p2_liq_abs >= 0.2 ? '✓ норма' : '✗ ниже нормы') : '(нет обязательств)'}

3. Рентабельность продаж (ROS) = Чистая прибыль / Выручка × 100%
   П1: ${f(p1_net)} / ${f(p1_revenue)} × 100% = ${pct(p1_ros)}
   П2: ${f(p2_net)} / ${f(p2_revenue)} × 100% = ${pct(p2_ros)}

4. Рентабельность активов (ROA) = Чистая прибыль / Активы × 100%
   П1: ${f(p1_net)} / ${f(p1_assets)} × 100% = ${pct(p1_roa)}
   П2: ${f(p2_net)} / ${f(p2_assets)} × 100% = ${pct(p2_roa)}

5. Коэффициент автономии = Капитал / Активы × 100% [норма ≥50%]
   П1: ${f(p1_equity)} / ${f(p1_assets)} × 100% = ${pct(p1_autonomy)} ${p1_autonomy >= 50 ? '✓ норма' : '✗ ниже нормы'}
   П2: ${f(p2_equity)} / ${f(p2_assets)} × 100% = ${pct(p2_autonomy)} ${p2_autonomy >= 50 ? '✓ норма' : '✗ ниже нормы'}

6. Долговая нагрузка = Обязательства / Активы × 100%
   П1: ${pct(p1_debt_ratio)}
   П2: ${pct(p2_debt_ratio)}

7. Покрытие долга (DSC) = Операц. ден. поток / Годовой платёж [норма ≥1.2]
   Годовой платёж: ${f(annual_payment)} TJS
   П1: ${f(p1_op_cf)} / ${f(annual_payment)} = ${annual_payment > 0 ? rat(p1_dsc) : 'н/д'} ${annual_payment > 0 ? (p1_dsc >= 1.2 ? '✓ норма' : p1_dsc >= 1.0 ? '⚠ допустимо' : '✗ недостаточно') : ''}
   П2: ${f(p2_op_cf)} / ${f(annual_payment)} = ${annual_payment > 0 ? rat(p2_dsc) : 'н/д'} ${annual_payment > 0 ? (p2_dsc >= 1.2 ? '✓ норма' : p2_dsc >= 1.0 ? '⚠ допустимо' : '✗ недостаточно') : ''}

8. Обеспеченность залогом = Залог / ${is_collateral_change ? 'Остаток кредита' : 'Кредит'} × 100%
   ${f(collateral_total)} / ${f(is_collateral_change ? existing_balance : loan_amount)} × 100% = ${pct(is_collateral_change ? collateral_coverage_existing : collateral_coverage)} ${(is_collateral_change ? collateral_coverage_existing : collateral_coverage) >= 150 ? '✓ достаточно (≥150%)' : (is_collateral_change ? collateral_coverage_existing : collateral_coverage) >= 100 ? '⚠ допустимо' : '✗ недостаточно'}

${is_collateral_change ? `
═══ ДОПОЛНИТЕЛЬНО ДЛЯ СМЕНЫ ЗАЛОГА ═══
Остаток кредита: ${f(existing_balance)} ${fd.loan_currency}
Новый залог: ${f(collateral_total)} TJS
Покрытие: ${collateral_coverage_existing.toFixed(1)}% ${collateral_coverage_existing >= 150 ? '✓ норма' : collateral_coverage_existing >= 100 ? '⚠ допустимо' : '✗ недостаточно'}
Норматив банка: ≥150%
` : ''}

Напиши краткое профессиональное заключение строго по этой структуре (не более 600 слов):

1. ХАРАКТЕРИСТИКА ЗАЁМЩИКА
2-3 предложения: сектор, опыт, кредитная история. Общая оценка.

2. ФИНАНСОВЫЙ АНАЛИЗ
- Ключевые тренды (рост/снижение в % с оценкой)
- Главные сильные стороны (1-2 пункта)
- Главные слабые стороны (1-2 пункта)

3. ${is_collateral_change ? 'АНАЛИЗ ЗАЛОГОВОГО ПОКРЫТИЯ (это основной раздел для данного типа заключения)' : 'КОЭФФИЦИЕНТЫ И ОЦЕНКА (используй ТОЧНО рассчитанные значения выше)'}
${is_collateral_change
  ? `Раскрой:
- Покрытие залогом: ${collateral_coverage_existing.toFixed(1)}% (норма ≥150%) — оценка достаточности
- Качество залога: тип, ликвидность, риски обесценения
- Сравнение с предыдущим залогом (если применимо)
- Коэффициент текущей ликвидности, Рентабельность продаж, DSC`
  : `Раскрой каждый по шаблону: «[название] = [значение] — [оценка]»
Обязательно: Текущая ликвидность, Абсолютная ликвидность, ROS, ROA, Автономия, DSC, Залог.`}

4. ОЦЕНКА РИСКОВ
Ровно 3 риска. Каждый: название + 1 предложение обоснования + оценка (высокий/средний/низкий).

5. РЕШЕНИЕ И ОБОСНОВАНИЕ
${is_collateral_change
  ? 'Чёткий ответ: одобрить смену залога или отклонить. 3-4 предложения с конкретными цифрами покрытия.'
  : 'Чёткий ответ: давать или не давать. 3-4 предложения с конкретными цифрами.'}
Если "Условно" — укажи конкретные условия.

Завершить ТОЧНО так:
РЕКОМЕНДАЦИЯ: [Одобрить / Условно одобрить / Отклонить]
УРОВЕНЬ РИСКА: [Низкий / Средний / Высокий]`

    const text = await aiGenerateText(prompt, 3000)

    const recommMatch = text.match(/РЕКОМЕНДАЦИЯ:\s*(.+)/i)
    const riskMatch = text.match(/УРОВЕНЬ РИСКА:\s*(.+)/i)

    const recommendation = recommMatch ? recommMatch[1].trim() : 'Требует анализа'
    const risk_level = riskMatch ? riskMatch[1].trim() : 'Средний'
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()

    return NextResponse.json({ conclusion, recommendation, risk_level })
  } catch (error) {
    console.error('Credit AI error:', error)
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 })
  }
}

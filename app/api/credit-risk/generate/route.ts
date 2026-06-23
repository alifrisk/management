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

    // Агрегированные данные из баланса (Форма №1 МФ РТ)
    const p1_cash    = Number(fd.p1_cash_desk || 0) + Number(fd.p1_cash_bank || 0)
    const p2_cash    = Number(fd.p2_cash_desk || 0) + Number(fd.p2_cash_bank || 0)
    const p1_liquid  = Number(fd.p1_total_ca || 0)   // краткосрочные активы итого
    const p2_liquid  = Number(fd.p2_total_ca || 0)
    const p1_nca     = Number(fd.p1_total_assets || 0) - p1_liquid  // долгосрочные активы
    const p2_nca     = Number(fd.p2_total_assets || 0) - p2_liquid
    const p1_cl      = Number(fd.p1_total_cl || 0)   // краткосрочные обязательства
    const p2_cl      = Number(fd.p2_total_cl || 0)
    const p1_assets  = Number(fd.p1_total_assets || 0)
    const p2_assets  = Number(fd.p2_total_assets || 0)
    const p1_liab    = Number(fd.p1_total_liabilities || 0)
    const p2_liab    = Number(fd.p2_total_liabilities || 0)
    const p1_equity  = Number(fd.p1_total_equity || 0)
    const p2_equity  = Number(fd.p2_total_equity || 0)

    const p1_revenue = Number(fd.p1_net_rev || 0)    // чистый доход от продаж (010)
    const p2_revenue = Number(fd.p2_net_rev || 0)
    const p1_net     = Number(fd.p1_net || 0)
    const p2_net     = Number(fd.p2_net || 0)
    const p1_op_cf   = Number(fd.p1_cf_net_op || 0)  // чистый поток от операционной деятельности
    const p2_op_cf   = Number(fd.p2_cf_net_op || 0)

    const monthly_payment   = Number(fd.monthly_payment || 0)
    const annual_payment    = monthly_payment * 12
    const loan_amount       = Number(fd.loan_amount || 0)
    const collateral_total  = (fd.collaterals || []).reduce((s: number, c: {value: number}) => s + (c.value || 0), 0)
    const conclusion_type      = fd.conclusion_type || 'Одобрение кредитной линии'
    const existing_balance     = Number(fd.existing_loan_balance || 0)
    const is_collateral_change = conclusion_type === 'Смена залога'
    const is_increase          = conclusion_type === 'Увеличение кредитной линии'

    // ── Pre-calculated ratios ──────────────────────────────────────────────────
    // 1. Текущая ликвидность = Краткосрочные активы / Краткосрочные обязательства (≥1.5 — норма для МСБ)
    const p1_liq_cur = div(p1_liquid, p1_cl)
    const p2_liq_cur = div(p2_liquid, p2_cl)

    // 2. Абсолютная ликвидность = Денежные средства / Краткосрочные обязательства (≥0.2 — норма)
    const p1_liq_abs = div(p1_cash, p1_cl)
    const p2_liq_abs = div(p2_cash, p2_cl)

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
  : is_increase
  ? `Действующий лимит кредитной линии: ${f(existing_balance)} ${fd.loan_currency}
Запрашиваемый (желаемый) лимит:    ${f(loan_amount)} ${fd.loan_currency}
Увеличение: +${f(loan_amount - existing_balance)} ${fd.loan_currency} (${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}%)
Срок линии: ${fd.loan_term_months || '—'} мес.
Процентная ставка: ${fd.interest_rate || '—'}% годовых
Обоснование: ${fd.loan_purpose}`
  : `Сумма открываемой кредитной линии: ${f(loan_amount)} ${fd.loan_currency}
Срок линии: ${fd.loan_term_months || '—'} мес.
Процентная ставка: ${fd.interest_rate || '—'}% годовых
Ежемесячное погашение: ${f(monthly_payment)} TJS
Цель линии: ${fd.loan_purpose}`}

═══ БАЛАНС (${fd.p1_label || 'П1'} → ${fd.p2_label || 'П2'}) ═══
Краткосрочные активы итого:  ${f(p1_liquid)} → ${f(p2_liquid)}${trend(p1_liquid, p2_liquid)}
  в т.ч. Денежные средства:  ${f(p1_cash)} → ${f(p2_cash)}
  в т.ч. ТМЗ:                ${f(Number(fd.p1_inventory||0))} → ${f(Number(fd.p2_inventory||0))}
Долгосрочные активы итого:   ${f(p1_nca)} → ${f(p2_nca)}${trend(p1_nca, p2_nca)}
Итого активы:                ${f(p1_assets)} → ${f(p2_assets)}${trend(p1_assets, p2_assets)}
Краткосрочные обязательства: ${f(p1_cl)} → ${f(p2_cl)}
Итого обязательства:         ${f(p1_liab)} → ${f(p2_liab)}${trend(p1_liab, p2_liab)}
Собственный капитал:         ${f(p1_equity)} → ${f(p2_equity)}${trend(p1_equity, p2_equity)}

═══ ОПУ (Форма №2) ═══
Чистый доход от продаж (010): ${f(p1_revenue)} → ${f(p2_revenue)}${trend(p1_revenue, p2_revenue)}
Себестоимость (020):          ${f(Number(fd.p1_cogs)||0)} → ${f(Number(fd.p2_cogs)||0)}
Валовая прибыль (030):        ${f(Number(fd.p1_gross)||0)} → ${f(Number(fd.p2_gross)||0)}
Операц. прибыль (080):        ${f(Number(fd.p1_op_profit)||0)} → ${f(Number(fd.p2_op_profit)||0)}
Чистая прибыль (230):         ${f(p1_net)} → ${f(p2_net)}${trend(p1_net, p2_net)}

═══ ОДДС (Форма №5) ═══
Чистый опер. поток (200): ${f(p1_op_cf)} → ${f(p2_op_cf)}
Остаток на конец:         ${f(Number(fd.p1_cf_cash_end)||0)} → ${f(Number(fd.p2_cf_cash_end)||0)}

═══ ЗАЛОГ ═══
${(fd.collaterals||[]).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n') || 'Не указан'}
Общий залог: ${f(collateral_total)} TJS

═══ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ (рассчитаны системой, использовать точно) ═══

1. Коэффициент текущей ликвидности = Краткоср. активы / Краткоср. обязательства [норма МСБ ≥1.5]
   П1: ${f(p1_liquid)} / ${f(p1_cl)} = ${rat(p1_liq_cur)} ${p1_cl > 0 ? (p1_liq_cur >= 1.5 ? '✓ норма' : p1_liq_cur >= 1.0 ? '⚠ допустимо' : '✗ низкая') : '(нет КО)'}
   П2: ${f(p2_liquid)} / ${f(p2_cl)} = ${rat(p2_liq_cur)} ${p2_cl > 0 ? (p2_liq_cur >= 1.5 ? '✓ норма' : p2_liq_cur >= 1.0 ? '⚠ допустимо' : '✗ низкая') : '(нет КО)'}

2. Коэффициент абсолютной ликвидности = Денежные средства / Краткоср. обязательства [норма ≥0.2]
   П1: ${f(p1_cash)} / ${f(p1_cl)} = ${rat(p1_liq_abs)} ${p1_cl > 0 ? (p1_liq_abs >= 0.2 ? '✓ норма' : '✗ ниже нормы') : '(нет КО)'}
   П2: ${f(p2_cash)} / ${f(p2_cl)} = ${rat(p2_liq_abs)} ${p2_cl > 0 ? (p2_liq_abs >= 0.2 ? '✓ норма' : '✗ ниже нормы') : '(нет КО)'}

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
` : is_increase ? `
═══ ДОПОЛНИТЕЛЬНО ДЛЯ УВЕЛИЧЕНИЯ ЛИМИТА ═══
Действующий лимит: ${f(existing_balance)} ${fd.loan_currency}
Запрашиваемый лимит: ${f(loan_amount)} ${fd.loan_currency}
Прирост: +${f(loan_amount - existing_balance)} (${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}%)
Залог / Новый лимит: ${pct(collateral_coverage)} ${collateral_coverage >= 150 ? '✓ норма' : collateral_coverage >= 100 ? '⚠ допустимо' : '✗ недостаточно'}
` : ''}

${fd.additional_info ? `═══ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОТ АНАЛИТИКА ═══
${fd.additional_info}
ВАЖНО: Учти эту информацию при составлении заключения — она может влиять на оценку рисков и рекомендацию.

` : ''}═══ ПРОВЕРКА КОРРЕКТНОСТИ ДАННЫХ (выполни перед написанием заключения) ═══
Баланс П1: Актив ${f(p1_assets)} vs Пассив (обяз. ${f(p1_liab)} + капитал ${f(p1_equity)} = ${f(p1_liab + p1_equity)}) → ${Math.abs(p1_assets - (p1_liab + p1_equity)) < 1 ? '✅ сходится' : `⚠️ РАСХОЖДЕНИЕ ${f(Math.abs(p1_assets - (p1_liab + p1_equity)))}`}
Баланс П2: Актив ${f(p2_assets)} vs Пассив (обяз. ${f(p2_liab)} + капитал ${f(p2_equity)} = ${f(p2_liab + p2_equity)}) → ${Math.abs(p2_assets - (p2_liab + p2_equity)) < 1 ? '✅ сходится' : `⚠️ РАСХОЖДЕНИЕ ${f(Math.abs(p2_assets - (p2_liab + p2_equity)))}`}
Выручка vs Опер.поток П2: ${p2_revenue > 0 && p2_op_cf !== 0 ? (Math.abs(p2_revenue - p2_op_cf) / p2_revenue > 0.5 ? `⚠️ выручка ${f(p2_revenue)} существенно ≠ опер.поток ${f(p2_op_cf)}` : '✅ приемлемо') : 'нет данных'}
${(is_increase && loan_amount <= existing_balance) ? `⚠️ ЛОГИКА: желаемый лимит (${f(loan_amount)}) ≤ действующему (${f(existing_balance)}) — не имеет смысла для увеличения` : ''}

Если есть расхождения — укажи их в разделе "ФИНАНСОВЫЙ АНАЛИЗ" с пометкой "⚠️ требует уточнения".

Напиши краткое профессиональное заключение строго по этой структуре (не более 600 слов):

1. ХАРАКТЕРИСТИКА ЗАЁМЩИКА
2-3 предложения: сектор, опыт, кредитная история. Общая оценка.

2. ФИНАНСОВЫЙ АНАЛИЗ
- Ключевые тренды (рост/снижение в % с оценкой)
- Главные сильные стороны (1-2 пункта)
- Главные слабые стороны (1-2 пункта)
- Если баланс не сходится или есть логические несоответствия — отметь здесь

3. ${is_collateral_change ? 'АНАЛИЗ ЗАЛОГОВОГО ПОКРЫТИЯ (это основной раздел для данного типа заключения)' : is_increase ? 'АНАЛИЗ ОБОСНОВАННОСТИ УВЕЛИЧЕНИЯ ЛИМИТА' : 'КОЭФФИЦИЕНТЫ И ОЦЕНКА (используй ТОЧНО рассчитанные значения выше)'}
${is_collateral_change
  ? `Раскрой:
- Покрытие залогом: ${collateral_coverage_existing.toFixed(1)}% (норма ≥150%) — оценка достаточности
- Качество залога: тип, ликвидность, риски обесценения
- Коэффициент текущей ликвидности, DSC`
  : is_increase
  ? `Раскрой:
- Обоснован ли запрос (+${f(loan_amount - existing_balance)}, ${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}% к действующему)?
- Способна ли выручка/прибыль обслужить новый лимит?
- Достаточно ли залога для нового лимита: ${pct(collateral_coverage)}?
- Коэффициент текущей ликвидности, ROS, DSC, Залог`
  : `Раскрой каждый по шаблону: «[название] = [значение] — [оценка]»
Обязательно: Текущая ликвидность, Абсолютная ликвидность, ROS, ROA, Автономия, DSC, Залог.`}

4. ОЦЕНКА РИСКОВ
Ровно 3 риска. Каждый: название + 1 предложение обоснования + оценка (высокий/средний/низкий).

5. РЕШЕНИЕ И ОБОСНОВАНИЕ
${is_collateral_change
  ? 'Чёткий ответ: одобрить смену залога или отклонить. 3-4 предложения с конкретными цифрами покрытия.'
  : is_increase
  ? 'Чёткий ответ: одобрить увеличение лимита или отклонить. 3-4 предложения: обоснованность, финансовая способность, залог.'
  : 'Чёткий ответ: открывать линию или нет. 3-4 предложения с конкретными цифрами.'}
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

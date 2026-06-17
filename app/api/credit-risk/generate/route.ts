import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'
import { requireAuth } from '@/lib/auth-check'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { formData } = await request.json()
    const f = (v: unknown) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(Number(v))) : '0'

    // ✅ Безопасность: AI не видит имя и ИНН заёмщика
    const prompt = `Ты старший кредитный риск-аналитик банка Алиф Банк (Таджикистон) с 15-летним опытом.

Твоя задача: дать КОНКРЕТНОЕ заключение с рекомендацией — одобрить или отклонить кредит. Ты ОБЯЗАН дать рекомендацию даже если данных мало — на основе того что есть.

═══ ДАННЫЕ ЗАЯВКИ ═══
Сектор бизнеса: ${formData.sector || 'не указан'}
Вид деятельности: ${formData.business_type || 'не указан'}
Лет в бизнесе: ${formData.years_in_business || 'не указано'}
Кредитная история: ${formData.credit_history}
Сумма кредита: ${f(formData.loan_amount)} ${formData.loan_currency}
Срок: ${formData.loan_term_months || '—'} мес.
Процентная ставка: ${formData.interest_rate || '—'}% годовых
Ежемесячное погашение: ${f(formData.monthly_payment)} TJS
Цель: ${formData.loan_purpose}

═══ БАЛАНС (${formData.p1_label || 'П1'} → ${formData.p2_label || 'П2'}) ═══
Активы:        ${f(formData.p1_total_assets)} → ${f(formData.p2_total_assets)}
Обязательства: ${f(formData.p1_total_liabilities)} → ${f(formData.p2_total_liabilities)}
Капитал:       ${f(Number(formData.p1_equity_capital||0)+Number(formData.p1_reserves||0)+Number(formData.p1_retained_earnings||0))} → ${f(Number(formData.p2_equity_capital||0)+Number(formData.p2_reserves||0)+Number(formData.p2_retained_earnings||0))}

═══ ОПУ ═══
Выручка:         ${f(formData.p1_revenue)} → ${f(formData.p2_revenue)}
Себестоимость:   ${f(formData.p1_cogs)} → ${f(formData.p2_cogs)}
Валовая прибыль: ${f(formData.p1_gross_profit)} → ${f(formData.p2_gross_profit)}
Операц. прибыль: ${f(formData.p1_op_profit)} → ${f(formData.p2_op_profit)}
Чистая прибыль:  ${f(formData.p1_net)} → ${f(formData.p2_net)}

═══ ОДДС ═══
Операц. поток: ${f(Number(formData.p1_op_inflow||0)-Number(formData.p1_op_outflow||0))} → ${f(Number(formData.p2_op_inflow||0)-Number(formData.p2_op_outflow||0))}
Остаток конец: ${f(formData.p1_cash_end)} → ${f(formData.p2_cash_end)}

═══ ЗАЛОГ ═══
${(formData.collaterals||[]).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n') || 'Не указан'}
Общий залог: ${f((formData.collaterals||[]).reduce((s: number, c: {value:number}) => s+(c.value||0), 0))} TJS

Напиши краткое профессиональное заключение строго по этой структуре (не более 600 слов):

1. ХАРАКТЕРИСТИКА ЗАЁМЩИКА
2-3 предложения: сектор, опыт, кредитная история. Общая оценка.

2. ФИНАНСОВЫЙ АНАЛИЗ
- Ключевые тренды (рост/снижение в % с оценкой)
- Главные сильные стороны (1-2 пункта)
- Главные слабые стороны (1-2 пункта)

3. ОЦЕНКА РИСКОВ
Ровно 3 риска. Каждый: название + 1 предложение обоснования + оценка (высокий/средний/низкий).

4. РЕШЕНИЕ И ОБОСНОВАНИЕ
Чёткий ответ: давать или не давать. 3-4 предложения с конкретными цифрами.
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

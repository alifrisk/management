import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { formData } = await request.json()
    const f = (v: unknown) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(Number(v))) : '0'

    const prompt = `Ты старший кредитный риск-аналитик банка Алиф Банк (Таджикистон) с 15-летним опытом.

Твоя задача: дать КОНКРЕТНОЕ заключение с рекомендацией — одобрить или отклонить кредит. Ты ОБЯЗАН дать рекомендацию даже если данных мало — на основе того что есть.

═══ ДАННЫЕ ЗАЯВКИ ═══
Заёмщик: ${formData.borrower_name}
ИНН: ${formData.borrower_inn || 'не указан'}
Вид бизнеса: ${formData.business_type || 'не указан'}
Лет в бизнесе: ${formData.years_in_business || 'не указано'}
Кредитная история: ${formData.credit_history}
Сумма кредита: ${f(formData.loan_amount)} ${formData.loan_currency}
Срок: ${formData.loan_term_months || '—'} мес.
Процентная ставка: ${formData.interest_rate || '—'}% годовых
Ежемесячное погашение: ${f(formData.monthly_payment)} TJS
Цель: ${formData.loan_purpose}

═══ БАЛАНС (${formData.p1_label || 'П1'} → ${formData.p2_label || 'П2'}) ═══
Активы:      ${f(formData.p1_total_assets)} → ${f(formData.p2_total_assets)}
Обязательства: ${f(formData.p1_total_liabilities)} → ${f(formData.p2_total_liabilities)}
Капитал:     ${f(Number(formData.p1_equity_capital||0)+Number(formData.p1_reserves||0)+Number(formData.p1_retained_earnings||0))} → ${f(Number(formData.p2_equity_capital||0)+Number(formData.p2_reserves||0)+Number(formData.p2_retained_earnings||0))}

═══ ОПУ ═══
Выручка:       ${f(formData.p1_revenue)} → ${f(formData.p2_revenue)}
Себестоимость: ${f(formData.p1_cogs)} → ${f(formData.p2_cogs)}
Валовая прибыль: ${f(formData.p1_gross_profit)} → ${f(formData.p2_gross_profit)}
Операц. прибыль: ${f(formData.p1_op_profit)} → ${f(formData.p2_op_profit)}
Чистая прибыль:  ${f(formData.p1_net)} → ${f(formData.p2_net)}

═══ ОДДС ═══
Операц. поток: ${f(Number(formData.p1_op_inflow||0)-Number(formData.p1_op_outflow||0))} → ${f(Number(formData.p2_op_inflow||0)-Number(formData.p2_op_outflow||0))}
Остаток конец: ${f(formData.p1_cash_end)} → ${f(formData.p2_cash_end)}

═══ ЗАЛОГ ═══
${(formData.collaterals||[]).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n') || 'Не указан'}
Общий залог: ${f((formData.collaterals||[]).reduce((s: number, c: {value:number}) => s+(c.value||0), 0))} TJS

Напиши заключение строго по этой структуре:

1. АНАЛИЗ ИМЕЮЩИХСЯ ДАННЫХ
Проанализируй все предоставленные данные. Для каждого показателя укажи:
- конкретное значение и динамику между периодами (рост/снижение в %)
- является ли это позитивным или негативным сигналом и почему
Если какие-то данные нулевые или отсутствуют — отметь это отдельно в конце раздела как "Отсутствующие данные: ..."

2. КЛЮЧЕВЫЕ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ
Рассчитай все возможные коэффициенты из имеющихся данных:
- Рентабельность продаж = Чистая прибыль / Выручка × 100% (норма >5%)
- Долговая нагрузка = Обязательства / Активы × 100% (норма <70%)  
- Коэффициент автономии = Капитал / Активы × 100% (норма >30%)
- Покрытие залогом = Залог / Сумма кредита × 100% (норма >120%)
- Долговая нагрузка по платежу = Ежемес.платёж × 12 / Годовой операц.поток × 100% (норма <40%)
Если данных для расчёта нет — так и напиши: "Нет данных для расчёта"

3. ОЦЕНКА РИСКОВ
Перечисли конкретно 3 основных риска этого заёмщика с обоснованием.

4. ИТОГОВОЕ ЗАКЛЮЧЕНИЕ И РЕКОМЕНДАЦИЯ
Дай чёткий ответ: давать или не давать кредит. Обоснуй решение конкретными цифрами из анализа. Если "Условно одобрить" — укажи конкретные условия (например: дополнительный залог, снижение суммы, поручитель).

РЕКОМЕНДАЦИЯ: [Одобрить / Условно одобрить / Отклонить]
УРОВЕНЬ РИСКА: [Низкий / Средний / Высокий]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('Anthropic API error:', data)
      throw new Error(`Anthropic API: ${data?.error?.message || response.status}`)
    }
    const text = data.content?.[0]?.text || ''
    if (!text) throw new Error('AI вернул пустой ответ')

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

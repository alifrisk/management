import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { formData } = await request.json()
    const f = (v: unknown) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(Number(v))) : '0'

    const prompt = `Ты опытный кредитный риск-аналитик банка Алиф Банк (Таджикистан).
Проанализируй финансовую отчётность заёмщика за два периода и составь профессиональное заключение.

═══ ДАННЫЕ ЗАЁМЩИКА ═══
Наименование: ${formData.borrower_name}
ИНН: ${formData.borrower_inn || '—'}
Вид деятельности: ${formData.business_type || '—'}
Лет в бизнесе: ${formData.years_in_business || '—'}
Кредитная история: ${formData.credit_history}
Сумма кредита: ${f(formData.loan_amount)} ${formData.loan_currency}
Срок: ${formData.loan_term || '—'}
Цель: ${formData.loan_purpose}

═══ БАЛАНС ═══
                          ${formData.p1_label || 'Период 1'}    ${formData.p2_label || 'Период 2'}
АКТИВ
Денежные средства:        ${f(formData.p1_cash)}    ${f(formData.p2_cash)}
Дебиторская задолж.:      ${f(formData.p1_receivables)}    ${f(formData.p2_receivables)}
ТМЗ:                      ${f(formData.p1_inventory)}    ${f(formData.p2_inventory)}
Основные средства:        ${f(formData.p1_fixed_assets)}    ${f(formData.p2_fixed_assets)}
Прочие активы:            ${f(formData.p1_other_assets)}    ${f(formData.p2_other_assets)}
ИТОГО АКТИВ:              ${f(formData.p1_total_assets)}    ${f(formData.p2_total_assets)}

ПАССИВ
Долги поставщикам:        ${f(formData.p1_supplier_debt)}    ${f(formData.p2_supplier_debt)}
Долги банкам:             ${f(formData.p1_bank_debt)}    ${f(formData.p2_bank_debt)}
Прочие обязательства:     ${f(formData.p1_other_liabilities)}    ${f(formData.p2_other_liabilities)}
ИТОГО ОБЯЗАТЕЛЬСТВА:      ${f(formData.p1_total_liabilities)}    ${f(formData.p2_total_liabilities)}
ИТОГО КАПИТАЛ:            ${f(Number(formData.p1_equity_capital || 0) + Number(formData.p1_reserves || 0) + Number(formData.p1_retained_earnings || 0))}    ${f(Number(formData.p2_equity_capital || 0) + Number(formData.p2_reserves || 0) + Number(formData.p2_retained_earnings || 0))}

═══ ОПУ ═══
Выручка:                  ${f(formData.p1_revenue)}    ${f(formData.p2_revenue)}
Себестоимость:            ${f(formData.p1_cogs)}    ${f(formData.p2_cogs)}
Валовой доход:            ${f(formData.p1_gross_profit)}    ${f(formData.p2_gross_profit)}
Адм. расходы:             ${f(formData.p1_admin_expense)}    ${f(formData.p2_admin_expense)}
Торг. расходы:            ${f(formData.p1_sales_expense)}    ${f(formData.p2_sales_expense)}
Чистая прибыль:           ${f(formData.p1_net_profit)}    ${f(formData.p2_net_profit)}

═══ ОДДС (КЕШ ФЛОУ) ═══
Остаток начало:           ${f(formData.p1_cash_begin)}    ${f(formData.p2_cash_begin)}
Операц. деятельность:     ${f(Number(formData.p1_op_inflow || 0) - Number(formData.p1_op_outflow || 0))}    ${f(Number(formData.p2_op_inflow || 0) - Number(formData.p2_op_outflow || 0))}
Финансовая деятельность:  ${f(Number(formData.p1_fin_inflow || 0) - Number(formData.p1_fin_outflow || 0))}    ${f(Number(formData.p2_fin_inflow || 0) - Number(formData.p2_fin_outflow || 0))}
Инвест. деятельность:     ${f(Number(formData.p1_inv_inflow || 0) - Number(formData.p1_inv_outflow || 0))}    ${f(Number(formData.p2_inv_inflow || 0) - Number(formData.p2_inv_outflow || 0))}
Остаток конец:            ${f(formData.p1_cash_end)}    ${f(formData.p2_cash_end)}

═══ ЗАЛОГИ ═══
${(formData.collaterals || []).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n')}
Общая стоимость залога: ${f((formData.collaterals || []).reduce((s: number, c: {value: number}) => s + (c.value || 0), 0))} TJS

Составь профессиональное заключение строго по этой структуре:

1. ОБЩАЯ ХАРАКТЕРИСТИКА ЗАЁМЩИКА
Краткое описание бизнеса, опыт работы, кредитная история.

2. АНАЛИЗ ФИНАНСОВОГО ПОЛОЖЕНИЯ (БАЛАНС)
Динамика активов, обязательств и капитала. Рассчитай и прокомментируй:
- Долговая нагрузка = Обязательства / Активы (норма <70%)
- Коэффициент автономии = Капитал / Активы (норма >30%)

3. АНАЛИЗ ФИНАНСОВЫХ РЕЗУЛЬТАТОВ (ОПУ)
Динамика выручки и прибыли. Рассчитай:
- Рентабельность продаж = Прибыль / Выручка (норма >5%)
- Темп роста выручки между периодами

4. АНАЛИЗ ДЕНЕЖНЫХ ПОТОКОВ (ОДДС)
Операционный, финансовый и инвестиционный потоки. Рассчитай:
- Коэффициент покрытия долга = Операц. поток / Обязательства (норма >1)
- Долговая нагрузка по платежу = Годовой платёж / Операц. поток (норма <40%)

5. ОЦЕНКА ОБЕСПЕЧЕНИЯ
Анализ залогов. Рассчитай:
- Коэффициент покрытия залогом = Стоимость залога / Сумма кредита (норма >120%)

6. ОСНОВНЫЕ РИСКИ И ЗАКЛЮЧЕНИЕ
Перечисли 2-3 ключевых риска. Итоговый вывод.

РЕКОМЕНДАЦИЯ: [Одобрить / Условно одобрить / Отклонить]
УРОВЕНЬ РИСКА: [Низкий / Средний / Высокий]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

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

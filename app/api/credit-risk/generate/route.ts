import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { formData } = await request.json()

    const prompt = `Ты опытный кредитный риск-аналитик банка Алиф Банк (Таджикистан). 
Проанализируй заявку на кредит и составь профессиональное заключение на русском языке.

ДАННЫЕ ЗАЁМЩИКА:
- Наименование: ${formData.borrower_name}
- ИНН: ${formData.borrower_inn || 'не указан'}
- Вид деятельности: ${formData.business_type || 'не указан'}
- Лет в бизнесе: ${formData.years_in_business || 'не указано'}
- Кредитная история: ${formData.credit_history}

ПАРАМЕТРЫ КРЕДИТА:
- Сумма: ${formData.loan_amount} ${formData.loan_currency}
- Срок: ${formData.loan_term || 'не указан'}
- Цель: ${formData.loan_purpose}

ФИНАНСОВЫЕ ПОКАЗАТЕЛИ:
- Годовая выручка: ${formData.annual_revenue || 0} TJS
- Чистая прибыль: ${formData.net_profit || 0} TJS
- Активы: ${formData.total_assets || 0} TJS
- Обязательства: ${formData.total_liabilities || 0} TJS
- Существующие кредиты: ${formData.existing_loans || 0} TJS

ОБЕСПЕЧЕНИЕ:
- Тип залога: ${formData.collateral_type || 'не указан'}
- Стоимость залога: ${formData.collateral_value || 0} TJS
- Поручители: ${formData.guarantors || 'отсутствуют'}

Составь заключение строго по этой структуре:

1. ОБЩАЯ ХАРАКТЕРИСТИКА ЗАЁМЩИКА
[2-3 предложения]

2. АНАЛИЗ ФИНАНСОВОГО СОСТОЯНИЯ
[Рентабельность, долговая нагрузка, ликвидность]

3. ОЦЕНКА КРЕДИТНЫХ РИСКОВ
[Основные риски]

4. ОЦЕНКА ОБЕСПЕЧЕНИЯ
[Анализ залога]

5. ЗАКЛЮЧЕНИЕ

РЕКОМЕНДАЦИЯ: [Одобрить / Условно одобрить / Отклонить]
УРОВЕНЬ РИСКА: [Низкий / Средний / Высокий]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    const recommMatch = text.match(/РЕКОМЕНДАЦИЯ:\s*(.+)/i)
    const riskMatch = text.match(/УРОВЕНЬ РИСКА:\s*(.+)/i)

    const recommendation = recommMatch ? recommMatch[1].trim() : 'Требует дополнительного анализа'
    const risk_level = riskMatch ? riskMatch[1].trim() : 'Средний'
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()

    return NextResponse.json({ conclusion, recommendation, risk_level })
  } catch (error) {
    console.error('Credit AI error:', error)
    return NextResponse.json({ error: 'Ошибка генерации заключения' }, { status: 500 })
  }
}

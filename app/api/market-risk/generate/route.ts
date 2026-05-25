import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  try {
    const d = await request.json()
    const counterpartyType = d.counterparty_type || 'Банк'
    const scoreRows = [
      ['Международный рейтинг', d.score_intl_rating],
      ['Национальный рейтинг', d.score_national_rating],
      ['История банка', d.score_bank_history],
      ['Состав собственников', d.score_ownership],
      ['Отзыв лицензии', d.score_license],
      ['Отзыв рейтинга', d.score_rating_revocation],
      ['Санкционные списки', d.score_sanctions],
      ['Негативные СМИ', d.score_negative_media],
      ['Объём активов', d.score_asset_volume],
      ['Достаточность капитала (CAR)', d.score_capital_adequacy],
      ['Рентабельность (ROE)', d.score_profitability],
      ['Ликвидность (LCR)', d.score_liquidity],
    ].map(([l, v]) => `${l}: ${v}/4`).join('\n')

    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан) с 15-летним опытом оценки контрагентов.
Напиши профессиональное заключение об оценке надёжности контрагента. Стиль: чёткий, аналитический, с конкретными цифрами и выводами. Не более 450 слов.
═══ КОНТРАГЕНТ ═══
Наименование: ${d.bank_name}
Тип контрагента: ${counterpartyType}
Страна: ${d.country || 'не указана'}
Стаж на рынке: ${d.bank_history_years} лет
Международный рейтинг: ${d.intl_rating_value || 'отсутствует'}
Национальный рейтинг: ${d.national_rating_value || 'отсутствует'}
Санкции: ${d.sanctions_status}
Репутация в СМИ: ${d.negative_media_status}
═══ ФИНАНСОВЫЕ ПОКАЗАТЕЛИ ═══
CAR (достаточность капитала): ${d.car}% ${d.car >= 13 ? '✓' : d.car >= 10 ? '~' : '✗'} (норма ≥13%)
ROE (рентабельность капитала): ${d.roe}% ${d.roe >= 10 ? '✓' : d.roe >= 5 ? '~' : '✗'} (норма ≥10%)
Коэффициент ликвидности: ${d.lcr}% ${d.lcr >= 100 ? '✓' : d.lcr >= 80 ? '~' : '✗'} (норма ≥100%)
═══ МАТРИЦА НАДЁЖНОСТИ ═══
${scoreRows}
ИТОГ: ${d.total}/60 баллов → ${d.category.label}
Рекомендуемый лимит по матрице: ${d.category.limit}
Структура заключения (строго):
1. ХАРАКТЕРИСТИКА КОНТРАГЕНТА
Краткая оценка ${counterpartyType}: история, рейтинги, репутация. 2-3 предложения.
2. ФИНАНСОВЫЙ АНАЛИЗ
Прокомментируй CAR, ROE и ликвидность с учётом типа (${counterpartyType}). Укажи что в норме, что вызывает опасения.
3. РИСКИ
Конкретно 2-3 ключевых риска работы с данным ${counterpartyType.toLowerCase()}.
4. РЕКОМЕНДАЦИЯ И ЛИМИТ
Чёткое решение с обоснованием. Лимит: ${d.category.limit}. Условия для пересмотра.
Завершить ТОЧНО так:
РЕКОМЕНДАЦИЯ: Установить лимит ${d.category.limit}
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(`API: ${data?.error?.message || response.status}`)
    const text = data.content?.[0]?.text || ''
    if (!text) throw new Error('Пустой ответ AI')
    const recommMatch = text.match(/РЕКОМЕНДАЦИЯ:\s*(.+)/i)
    const recommendation = recommMatch ? recommMatch[1].trim() : `Установить лимит ${d.category.limit}`
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()
    return NextResponse.json({ conclusion, recommendation })
  } catch (error) {
    console.error('Market risk error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

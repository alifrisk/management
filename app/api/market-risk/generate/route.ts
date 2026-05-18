import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const d = await request.json()

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

    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан), специализирующийся на оценке рисков контрагентов.

Составь краткое профессиональное заключение (не более 400 слов).

═══ ДАННЫЕ БАНКА ═══
Банк: ${d.bank_name}
Страна: ${d.country || 'не указана'}
Стаж: ${d.bank_history_years} лет
Рейтинг: ${d.intl_rating_value || 'не указан'} / Национальный: ${d.national_rating_value || 'не указан'}
Санкции: ${d.sanctions_status}
СМИ: ${d.negative_media_status}

═══ ФИНАНСОВЫЕ ПОКАЗАТЕЛИ ═══
CAR (достаточность капитала): ${d.car}% (норма ≥13%)
ROE (рентабельность): ${d.roe}% (норма ≥10%)
LCR (ликвидность): ${d.lcr}% (норма ≥100%)

═══ МАТРИЦА ОЦЕНОК ═══
${scoreRows}

Итоговый балл: ${d.total} / 60
Категория: ${d.category.label}
Рекомендуемый лимит: ${d.category.limit}

Структура заключения:

1. ОБЩАЯ ОЦЕНКА
Итоговый балл, категория, краткий вывод о надёжности.

2. СИЛЬНЫЕ СТОРОНЫ
Показатели с оценкой 3-4 — почему это важно.

3. ФАКТОРЫ РИСКА
Показатели с оценкой 1-2 — конкретные риски.

4. РЕКОМЕНДАЦИЯ
Чёткий вывод по лимиту с обоснованием. Условия пересмотра.

РЕКОМЕНДАЦИЯ: [Установить лимит ${d.category.limit} / Ограниченное сотрудничество / Отказать в сотрудничестве]
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
    const recommendation = recommMatch ? recommMatch[1].trim() : 'Требует анализа'
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()

    return NextResponse.json({ conclusion, recommendation })
  } catch (error) {
    console.error('Market risk error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

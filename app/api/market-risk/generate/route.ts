import { NextResponse } from 'next/server'

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

export async function POST(request: Request) {
  try {
    const { bankName, country, analystName, scores, totalScore, category } = await request.json()

    const criteriaText = Object.entries(CRITERIA_LABELS)
      .map(([key, label]) => `- ${label}: ${scores[key]}/4`)
      .join('\n')

    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан), специализирующийся на оценке рисков контрагентов.

Составь краткое профессиональное заключение об оценке надёжности банка-контрагента (не более 400 слов).

═══ ДАННЫЕ ОЦЕНКИ ═══
Банк: ${bankName}
Страна: ${country || 'не указана'}
Итоговый балл: ${Math.round(totalScore)} из 60
Категория надёжности: ${category.category}
Рекомендуемый лимит: ${category.limit}

═══ ОЦЕНКА ПО КРИТЕРИЯМ (1=высокий риск, 4=отлично) ═══
${criteriaText}

Напиши заключение строго по структуре:

1. ОБЩАЯ ОЦЕНКА
2-3 предложения: итоговый балл, категория, общий вывод о надёжности.

2. СИЛЬНЫЕ СТОРОНЫ
Перечисли показатели с оценкой 3-4, объясни почему это важно.

3. ФАКТОРЫ РИСКА
Перечисли показатели с оценкой 1-2, объясни риски.

4. РЕКОМЕНДАЦИЯ ПО ЛИМИТУ
Конкретная рекомендация по лимиту с обоснованием. Условия пересмотра.

РЕКОМЕНДАЦИЯ: [Установить лимит ${category.limit} / Ограниченное сотрудничество / Отказать в сотрудничестве]
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
    const riskMatch = text.match(/УРОВЕНЬ РИСКА:\s*(.+)/i)
    const recommendation = recommMatch ? recommMatch[1].trim() : 'Требует анализа'
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()

    return NextResponse.json({ conclusion, recommendation })
  } catch (error) {
    console.error('Market risk AI error:', error)
    return NextResponse.json({ error: 'Ошибка генерации: ' + String(error) }, { status: 500 })
  }
}

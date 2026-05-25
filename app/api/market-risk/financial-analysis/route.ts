import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  try {
    const d = await request.json()
    const f = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '0'
    const pct = (v: number) => `${v.toFixed(1)}%`
    const trend = (v1: number, v2: number) => {
      if (!v1 || !v2) return ''
      const chg = ((v2 - v1) / Math.abs(v1) * 100)
      return chg > 0 ? ` (+${chg.toFixed(1)}%)` : ` (${chg.toFixed(1)}%)`
    }
    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан) с 15-летним опытом анализа банков-контрагентов.
Напиши профессиональный финансовый анализ контрагента на основе данных за два периода. Стиль: чёткий, аналитический, с конкретными цифрами, трендами и выводами. Не более 500 слов.
═══ ДАННЫЕ КОНТРАГЕНТА ═══
Код: ${d.code}
Периоды: ${d.p1_label} → ${d.p2_label}
Валюта: ${d.currency || 'USD'} (данные в тысячах)
═══ БАЛАНС (тыс. USD) ═══
Общие активы:        ${f(d.p1_total_assets)} → ${f(d.p2_total_assets)}${trend(d.p1_total_assets, d.p2_total_assets)}
Обязательства:       ${f(d.p1_total_liab)} → ${f(d.p2_total_liab)}${trend(d.p1_total_liab, d.p2_total_liab)}
Собственный капитал: ${f(d.p1_equity)} → ${f(d.p2_equity)}${trend(d.p1_equity, d.p2_equity)}
═══ ОПУ (тыс. USD) ═══
Чистый процентный доход (NIM): ${f(d.p1_nim)} → ${f(d.p2_nim)}${trend(d.p1_nim, d.p2_nim)}
Доход от FX операций:          ${f(d.p1_fx_income || 0)} → ${f(d.p2_fx_income || 0)}${trend(d.p1_fx_income || 0, d.p2_fx_income || 0)}
Прочие доходы:                 ${f(d.p1_other_income || 0)} → ${f(d.p2_other_income || 0)}${trend(d.p1_other_income || 0, d.p2_other_income || 0)}
Операционный доход:            ${f(d.p1_op_income)} → ${f(d.p2_op_income)}${trend(d.p1_op_income, d.p2_op_income)}
Резервы на потери:             ${f(d.p1_provisions)} → ${f(d.p2_provisions)}${trend(d.p1_provisions, d.p2_provisions)}
Чистая прибыль:                ${f(d.p1_net_profit)} → ${f(d.p2_net_profit)}${trend(d.p1_net_profit, d.p2_net_profit)}
═══ КОЭФФИЦИЕНТЫ ═══
CAR (достаточность капитала): ${pct(d.p1_car)} → ${pct(d.p2_car)} (норма ≥13%)
ROE (рентабельность):         ${pct(d.p1_roe)} → ${pct(d.p2_roe)} (норма ≥10%)
Структура анализа (строго):
1. ДИНАМИКА АКТИВОВ И БАЛАНСА
Прокомментируй рост/снижение активов, структуру обязательств и капитала. 2-3 предложения с цифрами.
2. АНАЛИЗ ДОХОДНОСТИ
Оцени NIM, FX доход, прочие доходы и чистую прибыль. Тренды и причины изменений. 2-3 предложения.
3. КАЧЕСТВО АКТИВОВ И РИСКИ
Оцени уровень резервов относительно портфеля. Ключевые риски. 2-3 предложения.
4. ДОСТАТОЧНОСТЬ КАПИТАЛА
Прокомментируй CAR и ROE с оценкой устойчивости банка. 1-2 предложения.
5. ОБЩИЙ ВЫВОД
Краткий итог: финансовое состояние улучшилось/ухудшилось/стабильно. Рекомендация по взаимодействию.`

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
    if (!response.ok) throw new Error(`API: ${data?.error?.message || response.status}`)
    const text = data.content?.[0]?.text || ''
    if (!text) throw new Error('Пустой ответ AI')
    return NextResponse.json({ conclusion: text })
  } catch (error) {
    console.error('Financial analysis error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'

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

    const counterpartyType = d.counterparty_type || 'Банк'
    const typeContext = counterpartyType === 'Банк'
      ? 'Нормативы НБТ: CAR ≥13%, ROE ≥10%, Ликвидность ≥30%.'
      : counterpartyType === 'Брокерская компания'
      ? 'Ключевые показатели: ликвидность портфеля, комиссионные доходы, рыночный риск.'
      : 'Ключевые показатели: доходность портфеля, диверсификация активов, рыночный риск.'

    const p1_nim_pct = d.p1_total_assets > 0 ? (d.p1_nim / d.p1_total_assets * 100) : 0
    const p2_nim_pct = d.p2_total_assets > 0 ? (d.p2_nim / d.p2_total_assets * 100) : 0

    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан) с 15-летним опытом анализа контрагентов.
Напиши профессиональный финансовый анализ контрагента. Стиль: чёткий, аналитический, с конкретными цифрами. Не более 650 слов.

═══ ДАННЫЕ КОНТРАГЕНТА ═══
Код: ${d.code}
Тип контрагента: ${counterpartyType}
Периоды: ${d.p1_label} → ${d.p2_label}
Валюта: ${d.currency || 'USD'} (данные в тысячах)
Специфика: ${typeContext}

═══ БАЛАНС (тыс. USD) ═══
Общие активы:        ${f(d.p1_total_assets)} → ${f(d.p2_total_assets)}${trend(d.p1_total_assets, d.p2_total_assets)}
Обязательства:       ${f(d.p1_total_liab)} → ${f(d.p2_total_liab)}${trend(d.p1_total_liab, d.p2_total_liab)}
Собственный капитал: ${f(d.p1_equity)} → ${f(d.p2_equity)}${trend(d.p1_equity, d.p2_equity)}
  из них: Денежные средства: ${f(d.p1_cash_usd || 0)} → ${f(d.p2_cash_usd || 0)}
          Средства в банках:    ${f(d.p1_receivables_usd || 0)} → ${f(d.p2_receivables_usd || 0)}
          Инвест. ценные бумаги: ${f(d.p1_investments_usd || 0)} → ${f(d.p2_investments_usd || 0)}

═══ ОПУ (тыс. USD) ═══
Чистый процентный доход (NIM): ${f(d.p1_nim)} → ${f(d.p2_nim)}${trend(d.p1_nim, d.p2_nim)}
Доход от FX операций:          ${f(d.p1_fx_income || 0)} → ${f(d.p2_fx_income || 0)}${trend(d.p1_fx_income || 0, d.p2_fx_income || 0)}
Прочие доходы:                 ${f(d.p1_other_income || 0)} → ${f(d.p2_other_income || 0)}${trend(d.p1_other_income || 0, d.p2_other_income || 0)}
Операционный доход:            ${f(d.p1_op_income)} → ${f(d.p2_op_income)}${trend(d.p1_op_income, d.p2_op_income)}
Резервы на потери:             ${f(d.p1_provisions)} → ${f(d.p2_provisions)}${trend(d.p1_provisions, d.p2_provisions)}
Чистая прибыль:                ${f(d.p1_net_profit)} → ${f(d.p2_net_profit)}${trend(d.p1_net_profit, d.p2_net_profit)}

═══ РАСЧЁТ КОЭФФИЦИЕНТОВ (используй в заключении) ═══
1. CAR = Собственный капитал / Общие активы × 100%
   П1: ${f(d.p1_equity)} / ${f(d.p1_total_assets)} × 100% = ${pct(d.p1_car)} ${d.p1_car >= 13 ? '✓ норма' : '✗ ниже нормы'} (норма НБТ ≥13%)
   П2: ${f(d.p2_equity)} / ${f(d.p2_total_assets)} × 100% = ${pct(d.p2_car)} ${d.p2_car >= 13 ? '✓ норма' : '✗ ниже нормы'}

2. ROE = Чистая прибыль / Собственный капитал × 100%
   П1: ${f(d.p1_net_profit)} / ${f(d.p1_equity)} × 100% = ${pct(d.p1_roe)} ${d.p1_roe >= 10 ? '✓ норма' : '✗ ниже нормы'} (норма ≥10%)
   П2: ${f(d.p2_net_profit)} / ${f(d.p2_equity)} × 100% = ${pct(d.p2_roe)} ${d.p2_roe >= 10 ? '✓ норма' : '✗ ниже нормы'}

3. Ликвидность (коэфф. текущей ликвидности НБТ) = Ликвидные активы / Обязательства × 100%
   где Ликвидные активы = Денежные средства + Средства в банках + Инвест. ценные бумаги
   П1: (${f(d.p1_cash_usd || 0)} + ${f(d.p1_receivables_usd || 0)} + ${f(d.p1_investments_usd || 0)}) / ${f(d.p1_total_liab)} × 100% = ${pct(d.p1_liquidity || 0)} ${(d.p1_liquidity || 0) >= 30 ? '✓ норма' : '✗ ниже нормы'} (норма НБТ ≥30%)
   П2: (${f(d.p2_cash_usd || 0)} + ${f(d.p2_receivables_usd || 0)} + ${f(d.p2_investments_usd || 0)}) / ${f(d.p2_total_liab)} × 100% = ${pct(d.p2_liquidity || 0)} ${(d.p2_liquidity || 0) >= 30 ? '✓ норма' : '✗ ниже нормы'}

4. NIM% = Чистый процентный доход / Общие активы × 100%
   П1: ${f(d.p1_nim)} / ${f(d.p1_total_assets)} × 100% = ${pct(p1_nim_pct)}
   П2: ${f(d.p2_nim)} / ${f(d.p2_total_assets)} × 100% = ${pct(p2_nim_pct)}

Структура заключения (строго):
1. ДИНАМИКА АКТИВОВ И БАЛАНСА
Прокомментируй рост/снижение активов. 2-3 предложения.

2. АНАЛИЗ ДОХОДНОСТИ
Оцени NIM% (${pct(p1_nim_pct)} → ${pct(p2_nim_pct)}), FX доход, чистую прибыль. 2-3 предложения.

3. КАЧЕСТВО АКТИВОВ И РИСКИ
Оцени резервы и ключевые риски. 2-3 предложения.

4. КОЭФФИЦИЕНТЫ — РАСЧЁТ И ОЦЕНКА
Обязательно раскрой каждый коэффициент по этому шаблону:
• CAR: [формула] = [П1 значение] → [П2 значение] — [оценка соответствия норме]
• ROE: [формула] = [П1 значение] → [П2 значение] — [оценка]
• Ликвидность: [формула] = [П1 значение] → [П2 значение] — [оценка]
• NIM%: [формула] = [П1 значение] → [П2 значение] — [оценка]

5. ОБЩИЙ ВЫВОД
Финансовое состояние: улучшилось/ухудшилось/стабильно. Рекомендация по взаимодействию. 2-3 предложения.`

    const text = await aiGenerateText(prompt, 2500)
    return NextResponse.json({ conclusion: text })
  } catch (error) {
    console.error('Financial analysis error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

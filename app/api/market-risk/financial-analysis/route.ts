import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'

const TYPE_LOGIC = {
  'Банк': {
    carNorm: 13, roeNorm: 10, liqNorm: 30,
    carLabel: 'норма НБТ ≥13%',
    roeLabel: 'норма ≥10%',
    liqLabel: 'норма НБТ ≥30%',
    nimInterpret: 'NIM — главный источник дохода банка. Норма NIM% ≥3% считается здоровым уровнем для банков РТ.',
    incomeLogic: 'Основной доход — процентный (NIM). FX доход важен для банков с валютными операциями. Рост комиссионных снижает зависимость от процентного риска.',
    riskFocus: 'Кредитный риск (резервы/портфель), риск ликвидности (LCR), процентный риск (NIM), операционный риск.',
    capitalLogic: 'CAR по НБТ ≥13% (выше Базельского минимума 8%). Снижение CAR ниже 13% — нарушение норматива. ROE ≥10% — приемлемая рентабельность.',
    liqLogic: 'Ликвидность (ликв. активы / обязательства) ≥30% — обязательный норматив НБТ. Средний показатель по банкам РТ ~81%. Значение ниже 30% — критично.',
    conclusion: 'Дай рекомендацию: продолжить/ограничить/прекратить сотрудничество с указанием допустимых лимитов межбанковских операций.',
  },
  'Брокерская компания': {
    carNorm: 8, roeNorm: 12, liqNorm: 20,
    carLabel: 'ориентир ≥8% (Базель, нет жёсткого норматива НБТ для брокеров)',
    roeLabel: 'ориентир ≥12% (брокеры должны показывать высокую рентабельность)',
    liqLabel: 'ориентир ≥20% (нет жёсткого норматива, но важно для покрытия маржин-коллов)',
    nimInterpret: 'NIM у брокеров минимален или отсутствует — основной доход комиссионный и от FX операций.',
    incomeLogic: 'Основной доход — комиссионный и FX. Высокий FX доход нормален. NIM низкий — это норма для брокера. Оцени диверсификацию дохода.',
    riskFocus: 'Рыночный риск (позиции портфеля), риск контрагента, операционный риск, риск ликвидности при маржин-коллах.',
    capitalLogic: 'Для брокеров жёсткого норматива НБТ по CAR нет. Ориентир ≥8% (Базельский минимум). ROE ≥12% — брокер должен генерировать высокую рентабельность за счёт комиссий.',
    liqLogic: 'Ликвидность критична при маржин-коллах. Ориентир ≥20%. Оцени способность покрыть обязательства в стрессовых условиях рынка.',
    conclusion: 'Дай рекомендацию: открыть/ограничить лимиты на брокерские операции (РЕПО, конверсионные сделки). Укажи максимальный размер позиции.',
  },
  'Инвестиционная компания': {
    carNorm: 10, roeNorm: 15, liqNorm: 15,
    carLabel: 'ориентир ≥10% (нет жёсткого норматива, но капитализация важна)',
    roeLabel: 'ориентир ≥15% (инвест. компании должны показывать высокий доход на капитал)',
    liqLabel: 'ориентир ≥15% (ликвидность менее критична, но нужна для redemptions)',
    nimInterpret: 'NIM у инвест. компаний не ключевой показатель — основной доход от инвестиционной деятельности.',
    incomeLogic: 'Основной доход — инвестиционный (прирост капитала, дивиденды). FX доход возможен при международных позициях. Оцени стабильность дохода.',
    riskFocus: 'Рыночный риск (оценка портфеля), риск концентрации, риск ликвидности при redemptions, валютный риск.',
    capitalLogic: 'CAR для инвест. компаний — ориентировочный показатель. Ключевой метрик — ROE ≥15%. Инвест. компании привлекают капитал инвесторов, поэтому высокая рентабельность критична.',
    liqLogic: 'Ликвидность менее критична чем у банков. Ориентир ≥15%. Важно оценить соответствие ликвидности активов срокам обязательств перед инвесторами.',
    conclusion: 'Дай рекомендацию по инвестиционному сотрудничеству: совместные сделки, размещение средств, доверительное управление. Укажи уровень риска.',
  },
}

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
    const check = (v: number, norm: number) => v >= norm ? '✓ соответствует' : '✗ ниже ориентира'

    const counterpartyType = d.counterparty_type || 'Банк'
    const tl = TYPE_LOGIC[counterpartyType as keyof typeof TYPE_LOGIC] || TYPE_LOGIC['Банк']

    const p1_nim_pct = d.p1_total_assets > 0 ? (d.p1_nim / d.p1_total_assets * 100) : 0
    const p2_nim_pct = d.p2_total_assets > 0 ? (d.p2_nim / d.p2_total_assets * 100) : 0

    const prompt = `Ты старший риск-аналитик банка Алиф Банк (Таджикистан) с 15-летним опытом анализа контрагентов.
Тип анализируемого контрагента: ${counterpartyType}. Применяй логику и нормативы СТРОГО для этого типа.
Стиль: чёткий, аналитический, с конкретными цифрами. Не более 700 слов.

═══ ДАННЫЕ КОНТРАГЕНТА ═══
Код: ${d.code}
Тип: ${counterpartyType}
Периоды: ${d.p1_label} → ${d.p2_label}
Валюта: ${d.currency || 'USD'} (данные в тысячах USD)

═══ БАЛАНС (тыс. USD) ═══
Общие активы:          ${f(d.p1_total_assets)} → ${f(d.p2_total_assets)}${trend(d.p1_total_assets, d.p2_total_assets)}
  Денежные средства:   ${f(d.p1_cash_usd || 0)} → ${f(d.p2_cash_usd || 0)}
  Средства в банках:   ${f(d.p1_receivables_usd || 0)} → ${f(d.p2_receivables_usd || 0)}
  Инвест. ценные бумаги: ${f(d.p1_investments_usd || 0)} → ${f(d.p2_investments_usd || 0)}
Обязательства:         ${f(d.p1_total_liab)} → ${f(d.p2_total_liab)}${trend(d.p1_total_liab, d.p2_total_liab)}
Собственный капитал:   ${f(d.p1_equity)} → ${f(d.p2_equity)}${trend(d.p1_equity, d.p2_equity)}

═══ ОПУ (тыс. USD) ═══
Чистый проц. доход (NIM): ${f(d.p1_nim)} → ${f(d.p2_nim)}${trend(d.p1_nim, d.p2_nim)}
Доход от FX операций:     ${f(d.p1_fx_income || 0)} → ${f(d.p2_fx_income || 0)}${trend(d.p1_fx_income || 0, d.p2_fx_income || 0)}
Прочие доходы:            ${f(d.p1_other_income || 0)} → ${f(d.p2_other_income || 0)}${trend(d.p1_other_income || 0, d.p2_other_income || 0)}
Операционный доход:       ${f(d.p1_op_income)} → ${f(d.p2_op_income)}${trend(d.p1_op_income, d.p2_op_income)}
Резервы на потери:        ${f(d.p1_provisions)} → ${f(d.p2_provisions)}${trend(d.p1_provisions, d.p2_provisions)}
Чистая прибыль:           ${f(d.p1_net_profit)} → ${f(d.p2_net_profit)}${trend(d.p1_net_profit, d.p2_net_profit)}

═══ РАСЧЁТ КОЭФФИЦИЕНТОВ ═══
1. CAR = Капитал / Активы × 100% [${tl.carLabel}]
   П1: ${f(d.p1_equity)} / ${f(d.p1_total_assets)} × 100% = ${pct(d.p1_car)} — ${check(d.p1_car, tl.carNorm)}
   П2: ${f(d.p2_equity)} / ${f(d.p2_total_assets)} × 100% = ${pct(d.p2_car)} — ${check(d.p2_car, tl.carNorm)}
   Логика: ${tl.capitalLogic}

2. ROE = Чистая прибыль / Капитал × 100% [${tl.roeLabel}]
   П1: ${f(d.p1_net_profit)} / ${f(d.p1_equity)} × 100% = ${pct(d.p1_roe)} — ${check(d.p1_roe, tl.roeNorm)}
   П2: ${f(d.p2_net_profit)} / ${f(d.p2_equity)} × 100% = ${pct(d.p2_roe)} — ${check(d.p2_roe, tl.roeNorm)}

3. Ликвидность = Ликв. активы / Обязательства × 100% [${tl.liqLabel}]
   где Ликв. активы = Денежные ср-ва + Средства в банках + Инвест. ценные бумаги
   П1: (${f(d.p1_cash_usd || 0)} + ${f(d.p1_receivables_usd || 0)} + ${f(d.p1_investments_usd || 0)}) / ${f(d.p1_total_liab)} × 100% = ${pct(d.p1_liquidity || 0)} — ${check(d.p1_liquidity || 0, tl.liqNorm)}
   П2: (${f(d.p2_cash_usd || 0)} + ${f(d.p2_receivables_usd || 0)} + ${f(d.p2_investments_usd || 0)}) / ${f(d.p2_total_liab)} × 100% = ${pct(d.p2_liquidity || 0)} — ${check(d.p2_liquidity || 0, tl.liqNorm)}
   Логика: ${tl.liqLogic}

4. NIM% = Чистый проц. доход / Активы × 100%
   П1: ${f(d.p1_nim)} / ${f(d.p1_total_assets)} × 100% = ${pct(p1_nim_pct)}
   П2: ${f(d.p2_nim)} / ${f(d.p2_total_assets)} × 100% = ${pct(p2_nim_pct)}
   Логика: ${tl.nimInterpret}

═══ СПЕЦИФИКА АНАЛИЗА ДЛЯ ТИПА «${counterpartyType}» ═══
Доходная логика: ${tl.incomeLogic}
Профиль рисков: ${tl.riskFocus}

═══ СТРУКТУРА ЗАКЛЮЧЕНИЯ (строго) ═══
1. ДИНАМИКА АКТИВОВ И БАЛАНСА
Рост/снижение активов с учётом специфики ${counterpartyType}. 2-3 предложения.

2. АНАЛИЗ ДОХОДНОСТИ
${tl.incomeLogic} Оцени тренды. 2-3 предложения.

3. КАЧЕСТВО АКТИВОВ И РИСКИ
${tl.riskFocus} 2-3 предложения.

4. КОЭФФИЦИЕНТЫ — РАСЧЁТ И ОЦЕНКА
Раскрой каждый по шаблону: «[название] = [формула] → П1: [X]% → П2: [Y]% — [оценка с учётом норм для ${counterpartyType}]»
Обязательно: CAR, ROE, Ликвидность, NIM%.

5. ОБЩИЙ ВЫВОД
${tl.conclusion} 2-3 предложения.`

    const text = await aiGenerateText(prompt, 2500)
    return NextResponse.json({ conclusion: text })
  } catch (error) {
    console.error('Financial analysis error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

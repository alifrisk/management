import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'

const TYPE_LOGIC = {
  'Банк': {
    carNorm: 13, roeNorm: 10, roaNorm: 1, nimNorm: 3, liqNorm: 30, nplNorm: 5, cirNorm: 60,
    carLabel: 'норма НБТ ≥13%',
    roeLabel: 'норма ≥10%',
    roaLabel: 'норма ≥1%',
    nimLabel: 'норма ≥3% (NIM%)',
    liqLabel: 'норма НБТ ≥30% (ликв. активы / обязательства)',
    nplLabel: 'норма <5% (NPL proxy = ОКУ / валовые кредиты)',
    cirLabel: 'норма <60% (Cost-to-Income)',
    nimInterpret: 'NIM — главный источник дохода банка. Норма NIM% ≥3% — здоровый уровень для банков РТ.',
    incomeLogic: 'Основной доход — процентный (NIM). Комиссионный доход снижает зависимость от процентного риска. Торговый и FX доход — дополнительные источники.',
    riskFocus: 'Кредитный риск (NPL proxy / ОКУ / кач-во портфеля), риск ликвидности (≥30% НБТ), процентный риск (NIM тренд), операционный риск (CIR).',
    capitalLogic: 'CAR по НБТ ≥13% (выше Базельского минимума 8%). Снижение CAR ниже 13% — нарушение норматива НБТ. ROA ≥1%, ROE ≥10% — приемлемая рентабельность.',
    liqLogic: 'Ликвидность = (Деньги+ЦБ + МБК размещённые + FVTPL + FVOCI) / Итого обязательства × 100%. Норматив НБТ ≥30%. Значение ниже 30% — критично.',
    conclusion: 'Дай рекомендацию: продолжить/ограничить/прекратить сотрудничество с указанием допустимых лимитов межбанковских операций.',
  },
  'Брокерская компания': {
    carNorm: 8, roeNorm: 12, roaNorm: 0.5, nimNorm: 0, liqNorm: 20, nplNorm: 999, cirNorm: 70,
    carLabel: 'ориентир ≥8% (Базель, нет жёсткого норматива НБТ для брокеров)',
    roeLabel: 'ориентир ≥12% (брокеры должны показывать высокую рентабельность)',
    roaLabel: 'ориентир ≥0.5%',
    nimLabel: 'NIM не ключевой показатель для брокеров',
    liqLabel: 'ориентир ≥20% (покрытие маржин-коллов)',
    nplLabel: 'NPL proxy не применим для брокеров',
    cirLabel: 'норма <70% для брокеров',
    nimInterpret: 'NIM у брокеров минимален или отсутствует — основной доход комиссионный и от FX операций.',
    incomeLogic: 'Основной доход — комиссионный и FX. Высокий FX доход нормален. NIM низкий — норма для брокера. Оцени диверсификацию дохода.',
    riskFocus: 'Рыночный риск (позиции портфеля), риск контрагента, операционный риск, риск ликвидности при маржин-коллах.',
    capitalLogic: 'Для брокеров жёсткого норматива НБТ по CAR нет. Ориентир ≥8%. ROE ≥12% — брокер должен генерировать высокую рентабельность за счёт комиссий.',
    liqLogic: 'Ликвидность критична при маржин-коллах. Ориентир ≥20%. Оцени способность покрыть обязательства в стрессовых условиях рынка.',
    conclusion: 'Дай рекомендацию: открыть/ограничить лимиты на брокерские операции (РЕПО, конверсионные сделки). Укажи максимальный размер позиции.',
  },
  'Инвестиционная компания': {
    carNorm: 10, roeNorm: 15, roaNorm: 1, nimNorm: 0, liqNorm: 15, nplNorm: 999, cirNorm: 65,
    carLabel: 'ориентир ≥10% (нет жёсткого норматива)',
    roeLabel: 'ориентир ≥15% (инвест. компании должны показывать высокий доход на капитал)',
    roaLabel: 'ориентир ≥1%',
    nimLabel: 'NIM не ключевой показатель для инвест. компаний',
    liqLabel: 'ориентир ≥15% (redemptions)',
    nplLabel: 'NPL proxy не применим',
    cirLabel: 'норма <65% для инвест. компаний',
    nimInterpret: 'NIM у инвест. компаний не ключевой — основной доход от инвестиционной деятельности.',
    incomeLogic: 'Основной доход — инвестиционный (прирост капитала, дивиденды, торговый). FX доход возможен при международных позициях. Оцени стабильность дохода.',
    riskFocus: 'Рыночный риск (оценка портфеля по СС), риск концентрации, риск ликвидности при redemptions, валютный риск.',
    capitalLogic: 'CAR для инвест. компаний — ориентировочный. Ключевой метрик — ROE ≥15%. Инвест. компании привлекают капитал инвесторов, поэтому высокая рентабельность критична.',
    liqLogic: 'Ликвидность менее критична чем у банков. Ориентир ≥15%. Важно соответствие ликвидности активов срокам обязательств перед инвесторами.',
    conclusion: 'Дай рекомендацию по инвестиционному сотрудничеству: совместные сделки, размещение средств, доверительное управление. Укажи уровень риска.',
  },
}

export async function POST(request: Request) {
  try {
    const d = await request.json()
    const f = (v: number) => (v || v === 0) ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '0'
    const pct = (v: number) => isFinite(v) && !isNaN(v) ? `${v.toFixed(1)}%` : 'н/д'
    const trend = (v1: number, v2: number) => {
      if (!v1 || !v2) return ''
      const chg = (v2 - v1) / Math.abs(v1) * 100
      return chg > 0 ? ` (+${chg.toFixed(1)}%)` : ` (${chg.toFixed(1)}%)`
    }
    const checkGe = (v: number, norm: number, inv = false) => {
      if (inv) return v <= norm ? '✓ соответствует' : '✗ превышает ориентир'
      return v >= norm ? '✓ соответствует' : '✗ ниже ориентира'
    }

    const counterpartyType = d.counterparty_type || 'Банк'
    const tl = TYPE_LOGIC[counterpartyType as keyof typeof TYPE_LOGIC] || TYPE_LOGIC['Банк']
    const isBank = counterpartyType === 'Банк'

    const prompt = `Ты старший риск-аналитик банка с 15-летним опытом анализа контрагентов по МСФО (IFRS).
Тип анализируемого контрагента: ${counterpartyType}. Применяй логику и нормативы СТРОГО для этого типа.
Стиль: чёткий, аналитический, с конкретными цифрами. Не более 800 слов.

ВАЖНО: Используй ТОЛЬКО нижеприведённые значения коэффициентов — они рассчитаны системой на основе МСФО-данных. НЕ пересчитывай самостоятельно.

═══ ДАННЫЕ КОНТРАГЕНТА ═══
Код: ${d.code}
Тип: ${counterpartyType}
Периоды: ${d.p1_label} → ${d.p2_label}
Валюта: ${d.currency || 'USD'} (данные пересчитаны в тыс. USD)

═══ БАЛАНС МСФО (тыс. USD) ═══
Итого активы:              П1: ${f(d.p1_total_assets)}  →  П2: ${f(d.p2_total_assets)}${trend(d.p1_total_assets, d.p2_total_assets)}
  Денежные ср-ва (своб.):  П1: ${f(d.p1_cash_cb)}  →  П2: ${f(d.p2_cash_cb)}
${(d.p1_restricted || 0) + (d.p2_restricted || 0) > 0 ? `  Огр. доступ (обяз. рез.): П1: ${f(d.p1_restricted)}  →  П2: ${f(d.p2_restricted)}` : ''}
  МБК размещённые:         П1: ${f(d.p1_due_banks)}  →  П2: ${f(d.p2_due_banks)}
  FVTPL (торг. ценные бум.): П1: ${f(d.p1_fvtpl)}  →  П2: ${f(d.p2_fvtpl)}
  FVOCI (цен. бум. по ПСД): П1: ${f(d.p1_fvoci)}  →  П2: ${f(d.p2_fvoci)}
  Ценные бум. по аморт. ст.: П1: ${f(d.p1_inv_ac)}  →  П2: ${f(d.p2_inv_ac)}
  Кредиты клиентам, брутто: П1: ${f(d.p1_gross_loans)}  →  П2: ${f(d.p2_gross_loans)}
  Резерв ОКУ (ECL):        П1: (${f(d.p1_ecl_reserve)})  →  П2: (${f(d.p2_ecl_reserve)})
  Кредиты нетто:           П1: ${f(d.p1_net_loans)}  →  П2: ${f(d.p2_net_loans)}
Итого обязательства:       П1: ${f(d.p1_total_liab)}  →  П2: ${f(d.p2_total_liab)}${trend(d.p1_total_liab, d.p2_total_liab)}
  Средства клиентов/депоз.: П1: ${f(d.p1_cust_dep)}  →  П2: ${f(d.p2_cust_dep)}
Собственный капитал:       П1: ${f(d.p1_equity)}  →  П2: ${f(d.p2_equity)}${trend(d.p1_equity, d.p2_equity)}

═══ ОТЧЁТ О СОВОКУПНОМ ДОХОДЕ МСФО (тыс. USD) ═══
Чистый проц. доход (NIM):  П1: ${f(d.p1_nim)}  →  П2: ${f(d.p2_nim)}${trend(d.p1_nim, d.p2_nim)}
Чистый комис. доход:       П1: ${f(d.p1_net_fee)}  →  П2: ${f(d.p2_net_fee)}${trend(d.p1_net_fee, d.p2_net_fee)}
Торговый доход (FVTPL/FX): П1: ${f((d.p1_trading || 0) + (d.p1_fx_income || 0))}  →  П2: ${f((d.p2_trading || 0) + (d.p2_fx_income || 0))}
Итого операц. доход:       П1: ${f(d.p1_op_income)}  →  П2: ${f(d.p2_op_income)}${trend(d.p1_op_income, d.p2_op_income)}
Расходы на ОКУ (ECL charge): П1: ${f(d.p1_ecl_charge)}  →  П2: ${f(d.p2_ecl_charge)}${trend(d.p1_ecl_charge, d.p2_ecl_charge)}
Расходы на персонал:       П1: ${f(d.p1_personnel)}  →  П2: ${f(d.p2_personnel)}
Итого операц. расходы:     П1: ${f(d.p1_total_opex)}  →  П2: ${f(d.p2_total_opex)}${trend(d.p1_total_opex, d.p2_total_opex)}
Чистая прибыль:            П1: ${f(d.p1_net_profit)}  →  П2: ${f(d.p2_net_profit)}${trend(d.p1_net_profit, d.p2_net_profit)}

═══ КОЭФФИЦИЕНТЫ МСФО — рассчитаны системой, использовать ТОЧНО ═══

1. CAR (Коэффициент достаточности капитала) [${tl.carLabel}]
   Формула: Капитал / Активы × 100%
   П1: ${pct(d.p1_car)} — ${checkGe(d.p1_car, tl.carNorm)}
   П2: ${pct(d.p2_car)} — ${checkGe(d.p2_car, tl.carNorm)}
   Логика: ${tl.capitalLogic}

2. ROE (Рентабельность капитала) [${tl.roeLabel}]
   Формула: Чистая прибыль / Капитал × 100%
   П1: ${pct(d.p1_roe)} — ${checkGe(d.p1_roe, tl.roeNorm)}
   П2: ${pct(d.p2_roe)} — ${checkGe(d.p2_roe, tl.roeNorm)}

3. ROA (Рентабельность активов) [${tl.roaLabel}]
   Формула: Чистая прибыль / Активы × 100%
   П1: ${pct(d.p1_roa)} — ${checkGe(d.p1_roa, tl.roaNorm)}
   П2: ${pct(d.p2_roa)} — ${checkGe(d.p2_roa, tl.roaNorm)}

4. NIM% (Чистая процентная маржа) [${tl.nimLabel}]
   Формула: Чистый проц. доход / Активы × 100%
   П1: ${pct(d.p1_nim_pct)}
   П2: ${pct(d.p2_nim_pct)}
   Логика: ${tl.nimInterpret}

5. Ликвидность [${tl.liqLabel}]
   Формула: (Деньги/ЦБ + МБК разм. + FVTPL + FVOCI) / Обязательства × 100%
   П1: ${pct(d.p1_liquidity)} — ${checkGe(d.p1_liquidity, tl.liqNorm)}
   П2: ${pct(d.p2_liquidity)} — ${checkGe(d.p2_liquidity, tl.liqNorm)}
   Логика: ${tl.liqLogic}

${isBank ? `6. NPL proxy (Качество кредитного портфеля) [${tl.nplLabel}]
   Формула: Резерв ОКУ / Кредиты брутто × 100%
   П1: ${pct(d.p1_npl)} — ${checkGe(d.p1_npl, tl.nplNorm, true)}
   П2: ${pct(d.p2_npl)} — ${checkGe(d.p2_npl, tl.nplNorm, true)}
   (Рост NPL proxy = ухудшение качества портфеля. Снижение = улучшение.)

7. Cost-to-Income (Эффективность операций) [${tl.cirLabel}]
   Формула: Операц. расходы / Операц. доход × 100%
   П1: ${pct(d.p1_cir)} — ${checkGe(d.p1_cir, tl.cirNorm, true)}
   П2: ${pct(d.p2_cir)} — ${checkGe(d.p2_cir, tl.cirNorm, true)}` : `6. Cost-to-Income (Эффективность) [${tl.cirLabel}]
   П1: ${pct(d.p1_cir)} — ${checkGe(d.p1_cir, tl.cirNorm, true)}
   П2: ${pct(d.p2_cir)} — ${checkGe(d.p2_cir, tl.cirNorm, true)}`}

═══ СПЕЦИФИКА АНАЛИЗА ДЛЯ ТИПА «${counterpartyType}» ═══
Доходная логика: ${tl.incomeLogic}
Профиль рисков: ${tl.riskFocus}

═══ СТРУКТУРА ЗАКЛЮЧЕНИЯ (строго) ═══

1. ДИНАМИКА АКТИВОВ И БАЛАНСА МСФО
Рост/снижение активов, изменение структуры кредитного портфеля, качество активов. 2-3 предложения.

2. АНАЛИЗ ДОХОДНОСТИ
Тренды NIM, комиссионного и прочего дохода. ROA, ROE. 2-3 предложения.

3. КАЧЕСТВО АКТИВОВ И РИСКИ
${isBank ? 'NPL proxy, ОКУ, тренд резервов. Ликвидность.' : 'Ликвидность и операционная устойчивость.'} 2-3 предложения.

4. КОЭФФИЦИЕНТЫ МСФО — РАСЧЁТ И ОЦЕНКА
Используй ТОЧНО значения из раздела выше. По каждому: «[название] = [формула] → П1: X% → П2: Y% — [оценка с учётом норм ${counterpartyType}]»
Обязательно: CAR, ROE, ROA, NIM%, Ликвидность${isBank ? ', NPL proxy, Cost-to-Income' : ', Cost-to-Income'}.

5. ОБЩИЙ ВЫВОД И РЕКОМЕНДАЦИЯ
${tl.conclusion} 2-3 предложения.`

    const text = await aiGenerateText(prompt, 2800)
    return NextResponse.json({ conclusion: text })
  } catch (error) {
    console.error('Financial analysis error:', error)
    return NextResponse.json({ error: 'Ошибка: ' + String(error) }, { status: 500 })
  }
}

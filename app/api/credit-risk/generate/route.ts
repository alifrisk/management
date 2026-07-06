import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'

export async function POST(request: Request) {
  try {
    const { formData } = await request.json()
    const fd = formData
    const f = (v: unknown) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(Number(v))) : '0'
    const pct = (v: number) => isFinite(v) && !isNaN(v) ? `${v.toFixed(1)}%` : 'н/д'
    const rat = (v: number) => isFinite(v) && !isNaN(v) ? v.toFixed(2) : 'н/д'
    const div = (a: number, b: number) => b !== 0 ? a / b : 0
    const getMonths = (label: string) => {
      const m = label?.match(/\d{2}\.(\d{2})\.\d{4}/)
      if (m) return parseInt(m[1]) || 12
      if (/март|mar/i.test(label)) return 3
      if (/июн|jun/i.test(label)) return 6
      if (/сент|sep/i.test(label)) return 9
      if (/дек|dec/i.test(label)) return 12
      return 12
    }
    const trend = (v1: number, v2: number) => {
      if (!v1 || !v2) return ''
      const chg = (v2 - v1) / Math.abs(v1) * 100
      return chg > 0 ? ` (+${chg.toFixed(1)}%)` : ` (${chg.toFixed(1)}%)`
    }

    // Агрегированные данные из баланса (Форма №1 МФ РТ)
    const p1_cash    = Number(fd.p1_cash_desk || 0) + Number(fd.p1_cash_bank || 0)
    const p2_cash    = Number(fd.p2_cash_desk || 0) + Number(fd.p2_cash_bank || 0)
    const p1_liquid  = Number(fd.p1_total_ca || 0)   // краткосрочные активы итого
    const p2_liquid  = Number(fd.p2_total_ca || 0)
    const p1_nca     = Number(fd.p1_total_assets || 0) - p1_liquid  // долгосрочные активы
    const p2_nca     = Number(fd.p2_total_assets || 0) - p2_liquid
    const p1_cl      = Number(fd.p1_total_cl || 0)   // краткосрочные обязательства
    const p2_cl      = Number(fd.p2_total_cl || 0)
    const p1_assets  = Number(fd.p1_total_assets || 0)
    const p2_assets  = Number(fd.p2_total_assets || 0)
    const p1_liab    = Number(fd.p1_total_liabilities || 0)
    const p2_liab    = Number(fd.p2_total_liabilities || 0)
    const p1_equity  = Number(fd.p1_total_equity || 0)
    const p2_equity  = Number(fd.p2_total_equity || 0)

    const p1_revenue = Number(fd.p1_net_rev || 0)    // чистый доход от продаж (010)
    const p2_revenue = Number(fd.p2_net_rev || 0)
    const p1_net     = Number(fd.p1_net || 0)
    const p2_net     = Number(fd.p2_net || 0)
    const p1_op_cf   = Number(fd.p1_cf_net_op || 0)
    const p2_op_cf   = Number(fd.p2_cf_net_op || 0)
    const p1_inv_cf  = Number(fd.p1_cf_net_inv || 0)
    const p2_inv_cf  = Number(fd.p2_cf_net_inv || 0)
    const p1_fin_cf  = Number(fd.p1_cf_net_fin || 0)
    const p2_fin_cf  = Number(fd.p2_cf_net_fin || 0)

    const p1_months = getMonths(fd.p1_label || '')
    const p2_months = getMonths(fd.p2_label || '')

    const monthly_payment   = Number(fd.monthly_payment || 0)
    const loan_amount       = Number(fd.loan_amount || 0)
    const collateral_total  = (fd.collaterals || []).reduce((s: number, c: {value: number}) => s + (c.value || 0), 0)
    const conclusion_type      = fd.conclusion_type || 'Одобрение кредитной линии'
    const existing_balance     = Number(fd.existing_loan_balance || 0)
    const is_collateral_change = conclusion_type === 'Смена залога'
    const is_increase          = conclusion_type === 'Увеличение кредитной линии'

    // ── Pre-calculated ratios ──────────────────────────────────────────────────
    // 1. Текущая ликвидность = Краткосрочные активы / Краткосрочные обязательства (≥1.5 — норма для МСБ)
    const p1_liq_cur = div(p1_liquid, p1_cl)
    const p2_liq_cur = div(p2_liquid, p2_cl)

    // 2. Быстрая ликвидность = (КА - ТМЗ) / Краткоср. обязательства (>1.0 = >100% — норма)
    const p1_liq_quick = div(p1_liquid - Number(fd.p1_inventory || 0), p1_cl)
    const p2_liq_quick = div(p2_liquid - Number(fd.p2_inventory || 0), p2_cl)

    // 3. ROA аннуализировано = (Чистая прибыль / Активы × 100%) / мес.периода × 12
    const p1_roa = div(p1_net, p1_assets) * 100 / p1_months * 12
    const p2_roa = div(p2_net, p2_assets) * 100 / p2_months * 12

    // 4. ROE аннуализировано = (Чистая прибыль / Капитал × 100%) / мес.периода × 12
    const p1_roe = div(p1_net, p1_equity) * 100 / p1_months * 12
    const p2_roe = div(p2_net, p2_equity) * 100 / p2_months * 12

    // 5. Коэффициент финансирования (леверидж) = Капитал / Обязательства (норма ≤0.5)
    const p1_financing = div(p1_equity, p1_liab)
    const p2_financing = div(p2_equity, p2_liab)

    // 6. DSCR = (Опер+Инв+Фин поток) / мес.периода / Ежемес.платёж (>1.0 — норма)
    const p1_total_cf = p1_op_cf + p1_inv_cf + p1_fin_cf
    const p2_total_cf = p2_op_cf + p2_inv_cf + p2_fin_cf
    const p1_dsc = monthly_payment > 0 ? div(p1_total_cf / p1_months, monthly_payment) : 0
    const p2_dsc = monthly_payment > 0 ? div(p2_total_cf / p2_months, monthly_payment) : 0

    // 8. Обеспеченность залогом = Залог / Кредит × 100%
    const collateral_coverage = div(collateral_total, loan_amount) * 100

    // ✅ Безопасность: AI не видит имя и ИНН заёмщика
    const collateral_coverage_existing = is_collateral_change && existing_balance > 0
      ? (collateral_total / existing_balance) * 100 : 0

    // ── Вердикт (вычисляется системой, передаётся в промт как обязательный) ──
    // «Не рекомендуется» ТОЛЬКО при нарушении ≥1 из двух условий:
    // 1. Нарушение риск-аппетита по PAR30 ОБЩЕГО портфеля банка
    // 2. Покрытие залогом < 100%
    const par30AfterBank    = Number(fd.par30_after_pct || 0)
    const raBankLimit       = Number(fd.risk_appetite_par30_pct || 0)
    const bankPar30Violated = raBankLimit > 0 && par30AfterBank > 0 && par30AfterBank > raBankLimit

    const effectiveCovPct    = is_collateral_change ? collateral_coverage_existing : collateral_coverage
    const effectiveLoanAmt   = is_collateral_change ? existing_balance : loan_amount
    const collateralViolated = effectiveLoanAmt > 0 && effectiveCovPct < 100

    const finalVerdict = (bankPar30Violated || collateralViolated) ? 'Не рекомендуется' : 'Рекомендуется'

    const prompt = `Ты старший кредитный риск-аналитик банка с 15-летним опытом.

ВИД ЗАКЛЮЧЕНИЯ: ${conclusion_type}
${is_collateral_change ? '⚠️ Это заключение о СМЕНЕ ЗАЛОГА по действующему кредиту. Основной анализ — достаточность и качество нового залога.' : 'Твоя задача: дать профессиональное заключение с рекомендацией.'}
Ты ОБЯЗАН дать рекомендацию даже если данных мало — на основе того что есть.

СИСТЕМА ВЕРДИКТА (строго соблюдать — отклонение недопустимо):
Допустимые значения РЕКОМЕНДАЦИИ: «Рекомендуется» или «Не рекомендуется».
«Не рекомендуется» — ТОЛЬКО при нарушении хотя бы одного из двух условий:
  Условие 1 — нарушение риск-аппетита по PAR30 ОБЩЕГО портфеля банка: ${bankPar30Violated ? `❌ ДА (PAR30 после выдачи ${par30AfterBank.toFixed(2)}% > лимит ${raBankLimit}%)` : '✅ НЕТ'}
  Условие 2 — покрытие залогом менее 100%: ${collateralViolated ? `❌ ДА (покрытие ${effectiveCovPct.toFixed(1)}% < 100%)` : '✅ НЕТ'}
Все прочие нарушения (концентрация МСБ, PAR30 МСБ, леверидж, ликвидность, ROA, ROE) → вердикт НЕ МЕНЯЮТ, но ОБЯЗАТЕЛЬНО упоминаются в тексте как риски и замечания.
ВЕРДИКТ СИСТЕМЫ: ${finalVerdict} — ты ОБЯЗАН указать именно это значение без изменений.

ВАЖНО: все финансовые коэффициенты уже рассчитаны системой — используй ТОЛЬКО эти значения, не пересчитывай самостоятельно.

═══ ДАННЫЕ ЗАЯВКИ ═══
Сектор бизнеса: ${fd.sector || 'не указан'}
Вид деятельности: ${fd.business_type || 'не указан'}
Лет в бизнесе: ${fd.years_in_business || 'не указано'}
Кредитная история: ${fd.credit_history}
${is_collateral_change
  ? `Остаток по действующему кредиту: ${f(existing_balance)} ${fd.loan_currency}
Причина смены залога: ${fd.loan_purpose}`
  : is_increase
  ? `Действующий лимит кредитной линии: ${f(existing_balance)} ${fd.loan_currency}
Запрашиваемый (желаемый) лимит:    ${f(loan_amount)} ${fd.loan_currency}
Увеличение: +${f(loan_amount - existing_balance)} ${fd.loan_currency} (${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}%)
Срок линии: ${fd.loan_term_months || '—'} мес.
Процентная ставка: ${fd.interest_rate || '—'}% годовых
Обоснование: ${fd.loan_purpose}`
  : `Сумма открываемой кредитной линии: ${f(loan_amount)} ${fd.loan_currency}
Срок линии: ${fd.loan_term_months || '—'} мес.
Процентная ставка: ${fd.interest_rate || '—'}% годовых
Ежемесячное погашение: ${f(monthly_payment)} TJS
Цель линии: ${fd.loan_purpose}`}

═══ БАЛАНС (${fd.p1_label || 'П1'} → ${fd.p2_label || 'П2'}) ═══
Краткосрочные активы итого:  ${f(p1_liquid)} → ${f(p2_liquid)}${trend(p1_liquid, p2_liquid)}
  в т.ч. Денежные средства:  ${f(p1_cash)} → ${f(p2_cash)}
  в т.ч. ТМЗ:                ${f(Number(fd.p1_inventory||0))} → ${f(Number(fd.p2_inventory||0))}
Долгосрочные активы итого:   ${f(p1_nca)} → ${f(p2_nca)}${trend(p1_nca, p2_nca)}
Итого активы:                ${f(p1_assets)} → ${f(p2_assets)}${trend(p1_assets, p2_assets)}
Краткосрочные обязательства: ${f(p1_cl)} → ${f(p2_cl)}
Итого обязательства:         ${f(p1_liab)} → ${f(p2_liab)}${trend(p1_liab, p2_liab)}
Собственный капитал:         ${f(p1_equity)} → ${f(p2_equity)}${trend(p1_equity, p2_equity)}

═══ ОПУ (Форма №2) ═══
Чистый доход от продаж (010): ${f(p1_revenue)} → ${f(p2_revenue)}${trend(p1_revenue, p2_revenue)}
Себестоимость (020):          ${f(Number(fd.p1_cogs)||0)} → ${f(Number(fd.p2_cogs)||0)}
Валовая прибыль (030):        ${f(Number(fd.p1_gross)||0)} → ${f(Number(fd.p2_gross)||0)}
Операц. прибыль (080):        ${f(Number(fd.p1_op_profit)||0)} → ${f(Number(fd.p2_op_profit)||0)}
Чистая прибыль (230):         ${f(p1_net)} → ${f(p2_net)}${trend(p1_net, p2_net)}

═══ ОДДС (Форма №5) ═══
Чистый опер. поток (200): ${f(p1_op_cf)} → ${f(p2_op_cf)}
Остаток на конец:         ${f(Number(fd.p1_cf_cash_end)||0)} → ${f(Number(fd.p2_cf_cash_end)||0)}

═══ ЗАЛОГ ═══
${(fd.collaterals||[]).map((c: {type:string;description:string;value:number}, i: number) => `${i+1}. ${c.type}: ${c.description} — ${f(c.value)} TJS`).join('\n') || 'Не указан'}
Общий залог: ${f(collateral_total)} TJS

═══ ФИНАНСОВЫЕ КОЭФФИЦИЕНТЫ (рассчитаны системой, использовать точно) ═══

ПОКАЗАТЕЛИ ЛИКВИДНОСТИ:
1. Коэффициент текущей ликвидности = Краткоср. активы / Краткоср. обязательства [норма >2.0 (>200%)]
   П1: ${f(p1_liquid)} / ${f(p1_cl)} = ${rat(p1_liq_cur)} ${p1_cl > 0 ? (p1_liq_cur > 2.0 ? '✓ норма' : p1_liq_cur >= 1.5 ? '⚠ допустимо' : '✗ ниже нормы') : '(нет КО)'}
   П2: ${f(p2_liquid)} / ${f(p2_cl)} = ${rat(p2_liq_cur)} ${p2_cl > 0 ? (p2_liq_cur > 2.0 ? '✓ норма' : p2_liq_cur >= 1.5 ? '⚠ допустимо' : '✗ ниже нормы') : '(нет КО)'}

2. Коэффициент быстрой ликвидности = (Краткоср. активы - ТМЗ) / Краткоср. обязательства [норма >1.0 (>100%)]
   П1: (${f(p1_liquid)} - ${f(Number(fd.p1_inventory||0))}) / ${f(p1_cl)} = ${rat(p1_liq_quick)} ${p1_cl > 0 ? (p1_liq_quick > 1.0 ? '✓ норма' : p1_liq_quick >= 0.7 ? '⚠ допустимо' : '✗ ниже нормы') : '(нет КО)'}
   П2: (${f(p2_liquid)} - ${f(Number(fd.p2_inventory||0))}) / ${f(p2_cl)} = ${rat(p2_liq_quick)} ${p2_cl > 0 ? (p2_liq_quick > 1.0 ? '✓ норма' : p2_liq_quick >= 0.7 ? '⚠ допустимо' : '✗ ниже нормы') : '(нет КО)'}

ПОКАЗАТЕЛИ РЕНТАБЕЛЬНОСТИ:
3. Рентабельность активов (ROA) = (Чистая прибыль / Активы × 100%) / мес.периода × 12 [норма >6%]
   П1 (${p1_months}м.): (${f(p1_net)} / ${f(p1_assets)} × 100%) / ${p1_months} × 12 = ${pct(p1_roa)} ${p1_roa > 6 ? '✓ норма' : '✗ ниже нормы'}
   П2 (${p2_months}м.): (${f(p2_net)} / ${f(p2_assets)} × 100%) / ${p2_months} × 12 = ${pct(p2_roa)} ${p2_roa > 6 ? '✓ норма' : '✗ ниже нормы'}

4. Рентабельность собственных средств (ROE) = (Чистая прибыль / Капитал × 100%) / мес.периода × 12 [норма >20%]
   П1 (${p1_months}м.): (${f(p1_net)} / ${f(p1_equity)} × 100%) / ${p1_months} × 12 = ${pct(p1_roe)} ${p1_roe > 20 ? '✓ норма' : '✗ ниже нормы'}
   П2 (${p2_months}м.): (${f(p2_net)} / ${f(p2_equity)} × 100%) / ${p2_months} × 12 = ${pct(p2_roe)} ${p2_roe > 20 ? '✓ норма' : '✗ ниже нормы'}

ПОКАЗАТЕЛИ ФИНАНСОВОЙ УСТОЙЧИВОСТИ:
5. Коэффициент финансирования (леверидж) = Капитал / Обязательства [норма ≤0.5]
   П1: ${f(p1_equity)} / ${f(p1_liab)} = ${rat(p1_financing)} ${p1_liab > 0 ? (p1_financing <= 0.5 ? '✓ норма' : '✗ выше нормы') : '(нет обяз.)'}
   П2: ${f(p2_equity)} / ${f(p2_liab)} = ${rat(p2_financing)} ${p2_liab > 0 ? (p2_financing <= 0.5 ? '✓ норма' : '✗ выше нормы') : '(нет обяз.)'}

ПОКАЗАТЕЛИ КРЕДИТОСПОСОБНОСТИ:
6. Покрытие долга (DSCR) = (Опер+Инв+Фин поток) / мес.периода / Ежемес.платёж [норма >1.0]
   Ежемесячный платёж: ${f(monthly_payment)} TJS
   П1 (${p1_months}м.): (${f(p1_op_cf)}+${f(p1_inv_cf)}+${f(p1_fin_cf)}) / ${p1_months} / ${f(monthly_payment)} = ${monthly_payment > 0 ? rat(p1_dsc) : 'н/д'} ${monthly_payment > 0 ? (p1_dsc > 1.0 ? '✓ норма' : p1_dsc >= 0.8 ? '⚠ допустимо' : '✗ недостаточно') : ''}
   П2 (${p2_months}м.): (${f(p2_op_cf)}+${f(p2_inv_cf)}+${f(p2_fin_cf)}) / ${p2_months} / ${f(monthly_payment)} = ${monthly_payment > 0 ? rat(p2_dsc) : 'н/д'} ${monthly_payment > 0 ? (p2_dsc > 1.0 ? '✓ норма' : p2_dsc >= 0.8 ? '⚠ допустимо' : '✗ недостаточно') : ''}

7. Покрытие залогом = Залог / ${is_collateral_change ? 'Остаток кредита' : 'Кредит'} × 100% [норма >120%]
   ${f(collateral_total)} / ${f(is_collateral_change ? existing_balance : loan_amount)} × 100% = ${pct(is_collateral_change ? collateral_coverage_existing : collateral_coverage)} ${(is_collateral_change ? collateral_coverage_existing : collateral_coverage) > 120 ? '✓ норма' : (is_collateral_change ? collateral_coverage_existing : collateral_coverage) >= 100 ? '⚠ допустимо' : '✗ ниже нормы'}

${is_collateral_change ? `
═══ ДОПОЛНИТЕЛЬНО ДЛЯ СМЕНЫ ЗАЛОГА ═══
Остаток кредита: ${f(existing_balance)} ${fd.loan_currency}
Новый залог: ${f(collateral_total)} TJS
Покрытие: ${collateral_coverage_existing.toFixed(1)}% ${collateral_coverage_existing > 120 ? '✓ норма' : collateral_coverage_existing >= 100 ? '⚠ допустимо' : '✗ ниже нормы'}
Норматив банка: >120%
` : is_increase ? `
═══ ДОПОЛНИТЕЛЬНО ДЛЯ УВЕЛИЧЕНИЯ ЛИМИТА ═══
Действующий лимит: ${f(existing_balance)} ${fd.loan_currency}
Запрашиваемый лимит: ${f(loan_amount)} ${fd.loan_currency}
Прирост: +${f(loan_amount - existing_balance)} (${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}%)
Залог / Новый лимит: ${pct(collateral_coverage)} ${collateral_coverage > 120 ? '✓ норма' : collateral_coverage >= 100 ? '⚠ допустимо' : '✗ ниже нормы'}
` : ''}

${(() => {
      const sme  = Number(fd.sme_sector_portfolio  || 0)
      const bank = Number(fd.bank_total_portfolio   || 0)
      const la   = loan_amount
      const rcl  = Number(fd.risk_appetite_conc_pct || 0)
      const cNow   = sme > 0 && bank > 0 ? (sme / bank * 100) : 0
      const cAfter = bank > 0 ? ((sme + la) / bank * 100) : 0
      const cVio   = rcl > 0 && cAfter > rcl
      const bInSme = sme > 0 && la > 0 ? (la / sme * 100) : 0
      // PAR30 MSB
      const msbPar30Now   = Number(fd.current_msb_par30_pct || 0)
      const raMsb         = Number(fd.risk_appetite_msb_par30_pct || 0)
      const msbDelta      = sme > 0 && la > 0 ? (la / sme * 100) : 0
      const msbAfter      = msbPar30Now + msbDelta
      const msbVio        = raMsb > 0 && msbAfter > raMsb
      // PAR30 bank total
      const bankPar30Now  = Number(fd.current_par30_pct || 0)
      const raBank        = Number(fd.risk_appetite_par30_pct || 0)
      const bankDelta     = bank > 0 && la > 0 ? (la / bank * 100) : 0
      const bankAfter     = bankPar30Now + bankDelta
      const bankVio       = raBank > 0 && bankAfter > raBank
      if (!sme && !bank && !msbPar30Now && !bankPar30Now) return ''
      return `═══ КОНЦЕНТРАЦИЯ И РИСК-АППЕТИТ (ВЫСОКИЙ ПРИОРИТЕТ) ═══
${sme > 0 && bank > 0 ? `КОНЦЕНТРАЦИЯ МСБ В ПОРТФЕЛЕ БАНКА:
  Портфель МСБ сейчас: ${f(sme)} TJS | Портфель банка: ${f(bank)} TJS
  Доля МСБ до выдачи:  ${cNow.toFixed(2)}%
  Доля МСБ после выдачи: ${cAfter.toFixed(2)}% ${rcl > 0 ? `(лимит: ${rcl}%)` : ''}
  Статус: ${cVio ? `❌ НАРУШАЕТ лимит концентрации (${cAfter.toFixed(2)}% > ${rcl}%)` : `✅ В пределах лимита`}
  Доля заёмщика в МСБ-портфеле (справочно): ${bInSme.toFixed(2)}%
` : ''}${msbPar30Now > 0 || raMsb > 0 ? `РИСК-АППЕТИТ PAR30 — ПОРТФЕЛЬ МСБ:
  PAR30 МСБ сейчас: ${msbPar30Now > 0 ? msbPar30Now.toFixed(2)+'%' : 'не указан'}
  Прирост при дефолте заёмщика: +${msbDelta.toFixed(2)}%
  PAR30 МСБ после: ${msbAfter.toFixed(2)}% ${raMsb > 0 ? `(лимит: ${raMsb}%)` : ''}
  Статус: ${msbVio ? `❌ НАРУШАЕТ лимит PAR30 МСБ (${msbAfter.toFixed(2)}% > ${raMsb}%)` : raMsb > 0 ? `✅ В пределах лимита PAR30 МСБ` : 'лимит не задан'}
` : ''}${bankPar30Now > 0 || raBank > 0 ? `РИСК-АППЕТИТ PAR30 — ОБЩИЙ ПОРТФЕЛЬ БАНКА:
  PAR30 банка сейчас: ${bankPar30Now > 0 ? bankPar30Now.toFixed(2)+'%' : 'не указан'}
  Прирост при дефолте заёмщика: +${bankDelta.toFixed(2)}%
  PAR30 банка после: ${bankAfter.toFixed(2)}% ${raBank > 0 ? `(лимит: ${raBank}%)` : ''}
  Статус: ${bankVio ? `❌ НАРУШАЕТ лимит PAR30 банка (${bankAfter.toFixed(2)}% > ${raBank}%)` : raBank > 0 ? `✅ В пределах лимита PAR30 банка` : 'лимит не задан'}
` : ''}ОБЯЗАТЕЛЬНО упомяни концентрацию и PAR30 в разделе "4. ОЦЕНКА РИСКОВ".
${cVio ? '⚠️ Нарушение лимита концентрации МСБ — отрази в тексте как замечание, вердикт НЕ МЕНЯЕТ.' : ''}${msbVio ? '⚠️ Нарушение PAR30 МСБ-портфеля — отрази в тексте как риск, вердикт НЕ МЕНЯЕТ.' : ''}${bankVio ? '❌ Нарушение PAR30 ОБЩЕГО портфеля банка — это условие для «Не рекомендуется», вердикт уже определён системой.' : ''}
`
    })()}${fd.additional_info ? `═══ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОТ АНАЛИТИКА ═══
${fd.additional_info}
ВАЖНО: Учти эту информацию при составлении заключения — она может влиять на оценку рисков и рекомендацию.

` : ''}═══ ПРОВЕРКА КОРРЕКТНОСТИ ДАННЫХ (выполни перед написанием заключения) ═══
Баланс П1: Актив ${f(p1_assets)} vs Пассив (обяз. ${f(p1_liab)} + капитал ${f(p1_equity)} = ${f(p1_liab + p1_equity)}) → ${Math.abs(p1_assets - (p1_liab + p1_equity)) < 1 ? '✅ сходится' : `⚠️ РАСХОЖДЕНИЕ ${f(Math.abs(p1_assets - (p1_liab + p1_equity)))}`}
Баланс П2: Актив ${f(p2_assets)} vs Пассив (обяз. ${f(p2_liab)} + капитал ${f(p2_equity)} = ${f(p2_liab + p2_equity)}) → ${Math.abs(p2_assets - (p2_liab + p2_equity)) < 1 ? '✅ сходится' : `⚠️ РАСХОЖДЕНИЕ ${f(Math.abs(p2_assets - (p2_liab + p2_equity)))}`}
Выручка vs Опер.поток П2: ${p2_revenue > 0 && p2_op_cf !== 0 ? (Math.abs(p2_revenue - p2_op_cf) / p2_revenue > 0.5 ? `⚠️ выручка ${f(p2_revenue)} существенно ≠ опер.поток ${f(p2_op_cf)}` : '✅ приемлемо') : 'нет данных'}
${(is_increase && loan_amount <= existing_balance) ? `⚠️ ЛОГИКА: желаемый лимит (${f(loan_amount)}) ≤ действующему (${f(existing_balance)}) — не имеет смысла для увеличения` : ''}

Если есть расхождения — укажи их в разделе "ФИНАНСОВЫЙ АНАЛИЗ" с пометкой "⚠️ требует уточнения".

Напиши краткое профессиональное заключение строго по этой структуре (не более 600 слов):

1. ХАРАКТЕРИСТИКА ЗАЁМЩИКА
2-3 предложения: сектор, опыт, кредитная история. Общая оценка.

2. ФИНАНСОВЫЙ АНАЛИЗ
- Ключевые тренды (рост/снижение в % с оценкой)
- Главные сильные стороны (1-2 пункта)
- Главные слабые стороны (1-2 пункта)
- Если баланс не сходится или есть логические несоответствия — отметь здесь

3. ${is_collateral_change ? 'АНАЛИЗ ЗАЛОГОВОГО ПОКРЫТИЯ (это основной раздел для данного типа заключения)' : is_increase ? 'АНАЛИЗ ОБОСНОВАННОСТИ УВЕЛИЧЕНИЯ ЛИМИТА' : 'КОЭФФИЦИЕНТЫ И ОЦЕНКА (используй ТОЧНО рассчитанные значения выше)'}
${is_collateral_change
  ? `Раскрой:
- Покрытие залогом: ${collateral_coverage_existing.toFixed(1)}% (норма >120%) — оценка достаточности
- Качество залога: тип, ликвидность, риски обесценения
- Коэффициент текущей ликвидности, DSC`
  : is_increase
  ? `Раскрой:
- Обоснован ли запрос (+${f(loan_amount - existing_balance)}, ${existing_balance > 0 ? (((loan_amount - existing_balance) / existing_balance) * 100).toFixed(1) : '—'}% к действующему)?
- Способна ли выручка/прибыль обслужить новый лимит?
- Достаточно ли залога для нового лимита: ${pct(collateral_coverage)}?
- Текущая ликвидность, Быстрая ликвидность, ROA, ROE, DSC, Залог`
  : `Раскрой каждый по шаблону: «[название] = [значение] — [оценка]»
Обязательно: Текущая ликвидность, Быстрая ликвидность, ROA, ROE, Коэффициент финансирования, DSC, Залог.`}

4. ОЦЕНКА РИСКОВ
Ровно 3 риска. Каждый: название + 1 предложение обоснования + оценка (высокий/средний/низкий).

5. РЕШЕНИЕ И ОБОСНОВАНИЕ
Вердикт системы: ${finalVerdict}.
${is_collateral_change
  ? `3-4 предложения с конкретными цифрами залогового покрытия (${effectiveCovPct.toFixed(1)}%). Обязательно укажи, нарушено ли покрытие залога (норма >100%) и PAR30 общего портфеля банка.`
  : `3-4 предложения. Обязательно укажи прямо: PAR30 общего портфеля банка ${bankPar30Violated ? `нарушается (${par30AfterBank.toFixed(2)}% > ${raBankLimit}%)` : 'не нарушается'} и покрытие залогом ${collateralViolated ? `ниже нормы (${effectiveCovPct.toFixed(1)}% < 100%)` : `в норме (${effectiveCovPct.toFixed(1)}%)`}. Если есть иные нарушения — перечисли их как замечания, но не как основание для отказа.`}

ВАЖНЫЕ ПРАВИЛА ОФОРМЛЕНИЯ:
- НЕ указывай конкретные даты (числа, месяцы, годы) в тексте заключения — дата оформления проставляется системой отдельно
- НЕ используй никакой markdown-разметки: запрещены символы решётки (#), тире в начале строк как маркеры (- текст), звёздочки (*, **), подчёркивание (_) и любое другое форматирование. Текст должен быть чистым — только абзацы, нумерованные пункты цифрами и числа.

Завершить ТОЧНО так:
Руководитель СУР — Сангинова Ф.
РЕКОМЕНДАЦИЯ: ${finalVerdict}
УРОВЕНЬ РИСКА: [Низкий / Средний / Высокий]`

    const text = await aiGenerateText(prompt, 3000)

    const recommMatch = text.match(/РЕКОМЕНДАЦИЯ:\s*(.+)/i)
    const riskMatch = text.match(/УРОВЕНЬ РИСКА:\s*(.+)/i)

    // Вердикт всегда определяется системой; парсим AI-вывод только как проверку
    const rawRec = recommMatch ? recommMatch[1].trim() : ''
    const recommendation = rawRec.includes('Не рекомендуется') ? 'Не рекомендуется'
      : rawRec.includes('Рекомендуется') ? 'Рекомендуется'
      : finalVerdict  // если AI вдруг использовал другую формулировку — берём системный вердикт
    const risk_level = riskMatch ? riskMatch[1].trim() : 'Средний'
    const conclusion = text.replace(/РЕКОМЕНДАЦИЯ:.*$/gim, '').replace(/УРОВЕНЬ РИСКА:.*$/gim, '').trim()

    return NextResponse.json({ conclusion, recommendation, risk_level })
  } catch (error) {
    console.error('Credit AI error:', error)
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 })
  }
}

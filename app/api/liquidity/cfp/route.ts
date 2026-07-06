import { NextResponse } from 'next/server'
import { createServerClient } from '@/supabase/server'
import { aiGenerateText } from '@/lib/ai-provider'
import { statusCar11, statusCar12, statusCar13, statusK21, normLabel } from '@/lib/cfpCalculations'

export async function POST(req: Request) {
  try {
    const d = await req.json()

    const car11 = Number(d.car11) || 0
    const car12 = Number(d.car12) || 0
    const car13 = Number(d.car13) || 0
    const k21   = Number(d.k21)   || 0

    const s11  = statusCar11(car11)
    const s12  = statusCar12(car12)
    const s13  = statusCar13(car13)
    const sk21 = statusK21(k21)

    const allNormsMet = s11 === 'green' && s12 === 'green' && s13 === 'green' && sk21 === 'green'
    const anyRed      = s11 === 'red'   || s12 === 'red'   || s13 === 'red'   || sk21 === 'red'

    // ── GAP data ──────────────────────────────────────────────────────────────
    const gapRows: number[][] = d.gap_data?.rows || Array(6).fill([0,0,0,0,0,0])
    const assetRows = gapRows.slice(0, 3)
    const liabRows  = gapRows.slice(3, 6)
    const assetTotals = Array(6).fill(0).map((_, mi) => assetRows.reduce((s: number, r: number[]) => s + (r[mi] || 0), 0))
    const liabTotals  = Array(6).fill(0).map((_, mi) => liabRows.reduce((s: number, r: number[]) => s + (r[mi] || 0), 0))
    const gapByMonth  = assetTotals.map((a, i) => a - liabTotals[i])
    const negGapMonths = gapByMonth.filter(g => g < 0).length
    const hasDeficit   = negGapMonths > 0
    const maxDeficit   = Math.abs(Math.min(...gapByMonth))
    const totalGap     = gapByMonth.reduce((s, g) => s + g, 0)

    // ── GAP month labels ──────────────────────────────────────────────────────
    const planDate = d.plan_date || ''
    const gapStart = planDate ? (new Date(planDate + 'T00:00:00').getMonth() + 1) % 12 : 6
    const MONTHS_FULL  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
    const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
    const gapMonthsFull  = Array.from({ length: 6 }, (_, i) => MONTHS_FULL[( gapStart + i) % 12])
    const gapMonthsShort = Array.from({ length: 6 }, (_, i) => MONTHS_SHORT[(gapStart + i) % 12])

    // ── Financing sources ─────────────────────────────────────────────────────
    const sources: { priority: number; source: string; status: string; currency: string; amount: string; cost: string; term: string }[] =
      d.financing_sources || []

    const BANK_PATTERN = /алиф|alif|бонк|банк\s+алиф|alif\s+bank/gi
    const sanitize = (name: string) => name.replace(BANK_PATTERN, '[Банк]').trim()

    const totalAvail   = sources.filter(s => s.status === 'available').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalCond    = sources.filter(s => s.status === 'conditional').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalSources = totalAvail + totalCond

    // ── Buffer ────────────────────────────────────────────────────────────────
    const bufferCashEq   = Number(d.liquidity_buffer?.cash_equivalents) || 0
    const bufferCash     = Number(d.liquidity_buffer?.cash_only)        || 0
    const avgMonthlyLiab = liabTotals.reduce((s, v) => s + v, 0) / 6 || 1
    const avgDailyOut    = Math.round(avgMonthlyLiab / 30) || 1
    const horizonDays    = bufferCashEq > 0 ? Math.round(bufferCashEq / avgDailyOut) : 0

    // ── Last liquidity stress test from Supabase ──────────────────────────────
    interface StressHorizon { need?: number; cov_cash?: number; cov_only?: number; risk?: string }
    let stressMeta = ''
    let stressNeeds: { t1: StressHorizon; t7: StressHorizon; t30: StressHorizon } | null = null
    let stressScenario = ''

    try {
      const sb = createServerClient()
      const { data: stRow } = await sb
        .from('stress_test_registry')
        .select('period, conclusion, results, created_at')
        .eq('risk_type', 'Риск ликвидности')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (stRow) {
        const res  = stRow.results as Record<string, unknown> | null
        const tot  = (res?.total  as Record<string, unknown>) || {}
        const t1d  = (tot.t1  as StressHorizon) || {}
        const t7d  = (tot.t7  as StressHorizon) || {}
        const t30d = (tot.t30 as StressHorizon) || {}
        stressScenario = (res?.scenario as string) || ''
        stressNeeds = { t1: t1d, t7: t7d, t30: t30d }

        const pct = (v?: number) => v != null ? `${Math.round(v * 100)}%` : '—'
        const mln = (v?: number) => v != null ? Math.round(v).toLocaleString('ru-RU') : '—'
        stressMeta = [
          `Тест: ${stRow.period || '—'} (${new Date(stRow.created_at).toLocaleDateString('ru-RU')})`,
          stressScenario ? `Сценарий: ${stressScenario}` : '',
          t1d.need  != null && t1d.need  > 0 ? `T+1:  потребность ${mln(t1d.need)} млн TJS, покрытие ДС+экв: ${pct(t1d.cov_cash)}, только ДС: ${pct(t1d.cov_only)}, риск: ${t1d.risk || '—'}` : '',
          t7d.need  != null && t7d.need  > 0 ? `T+7:  потребность ${mln(t7d.need)} млн TJS, покрытие ДС+экв: ${pct(t7d.cov_cash)}, только ДС: ${pct(t7d.cov_only)}, риск: ${t7d.risk || '—'}` : '',
          t30d.need != null && t30d.need > 0 ? `T+30: потребность ${mln(t30d.need)} млн TJS, покрытие ДС+экв: ${pct(t30d.cov_cash)}, только ДС: ${pct(t30d.cov_only)}, риск: ${t30d.risk || '—'}` : '',
        ].filter(Boolean).join('\n')
      }
    } catch { /* no stress data — proceed with CFP inputs */ }

    // ── Pre-format GAP table ──────────────────────────────────────────────────
    const gapTableLines = gapMonthsShort.map((m, i) => {
      const g = gapByMonth[i]
      return `  ${m.padEnd(4)} | ${assetTotals[i].toLocaleString('ru-RU').padStart(10)} | ${liabTotals[i].toLocaleString('ru-RU').padStart(10)} | ${(g >= 0 ? '+' : '') + g.toLocaleString('ru-RU')} (${g >= 0 ? 'профицит' : 'ДЕФИЦИТ'})`
    })

    // ── Sources table ─────────────────────────────────────────────────────────
    const sourcesTableLines = sources.length === 0
      ? ['  Источники не указаны']
      : sources.map(s => {
          const st = s.status === 'available' ? 'Доступен' : s.status === 'conditional' ? 'Условный' : 'Недоступен'
          return `  ${s.priority}. ${sanitize(s.source).padEnd(20)} | ${s.currency} ${(s.amount || '0').padStart(6)} млн | ${st.padEnd(10)} | ${s.cost.padEnd(6)} | ${s.term}`
        })

    // ── Section 3: deficiency basis ───────────────────────────────────────────
    let s3NeedBlock: string
    if (stressNeeds && (stressNeeds.t1.need || stressNeeds.t7.need || stressNeeds.t30.need)) {
      const n1  = stressNeeds.t1.need  ?? 0
      const n7  = stressNeeds.t7.need  ?? 0
      const n30 = stressNeeds.t30.need ?? 0
      const c1  = stressNeeds.t1.cov_cash  ?? 0
      const c7  = stressNeeds.t7.cov_cash  ?? 0
      const c30 = stressNeeds.t30.cov_cash ?? 0
      const covPct = (c: number) => `${Math.round(c * 100)}%`
      s3NeedBlock = `Потребность в ликвидности по стресс-тесту (${stressScenario}):
  T+1  (1 день):  ${Math.round(n1).toLocaleString('ru-RU')} млн TJS | покрытие буфером: ${covPct(c1)}${c1 < 1 ? ' — НЕДОСТАТОЧНО' : ' — достаточно'}
  T+7  (7 дней):  ${Math.round(n7).toLocaleString('ru-RU')} млн TJS | покрытие буфером: ${covPct(c7)}${c7 < 1 ? ' — НЕДОСТАТОЧНО' : ' — достаточно'}
  T+30 (30 дней): ${Math.round(n30).toLocaleString('ru-RU')} млн TJS | покрытие буфером: ${covPct(c30)}${c30 < 1 ? ' — НЕДОСТАТОЧНО' : ' — достаточно'}
  Буфер ликвидности: ${bufferCashEq.toLocaleString('ru-RU')} млн TJS (ДС и эквиваленты), горизонт покрытия ~${horizonDays} дней`
    } else {
      const baseOut = liabTotals[0] || avgMonthlyLiab
      const pess    = Math.round(baseOut * 0.20)
      const cat     = Math.round(baseOut * 0.40)
      const pessCov = pess > 0 ? Math.round((totalSources / pess) * 100) : 0
      const catCov  = cat  > 0 ? Math.round((totalAvail   / cat)  * 100) : 0
      s3NeedBlock = `Потребность в ликвидности (расчёт по данным CFP, стресс-тест отсутствует):
  Пессимистический сценарий (отток 20% обязательств = ${pess.toLocaleString('ru-RU')} млн TJS):
    источники ${totalSources.toLocaleString('ru-RU')} млн TJS | покрытие: ${pessCov}%${pessCov < 100 ? ' — НЕДОСТАТОЧНО' : ' — достаточно'}
  Катастрофический сценарий (отток 40% = ${cat.toLocaleString('ru-RU')} млн TJS):
    доступные источники ${totalAvail.toLocaleString('ru-RU')} млн TJS | покрытие: ${catCov}%${catCov < 100 ? ' — НЕДОСТАТОЧНО' : ' — достаточно'}
  Буфер ликвидности: ${bufferCashEq.toLocaleString('ru-RU')} млн TJS, горизонт покрытия ~${horizonDays} дней`
    }

    const planPeriod = d.plan_period || 'II полугодие 2026'

    // ── Prompt ────────────────────────────────────────────────────────────────
    const prompt = `Ты риск-менеджер банка. Составь ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ (CFP) по Инструкции №247 НБТ РТ. Только НБТ РТ — запрещено ссылаться на Базель, LCR, NSFR, ISO, международные стандарты.

ПЕРИОД: ${planPeriod}${planDate ? ' | Дата составления: ' + planDate : ''}

=== НОРМАТИВНЫЕ ЗНАЧЕНИЯ ===
CAR 1.1 = ${car11}%  (норма ≥ 12%)  → ${normLabel(s11)}
CAR 1.2 = ${car12}%  (норма ≥ 10%)  → ${normLabel(s12)}
CAR 1.3 = ${car13}%  (норма ≥ 10%)  → ${normLabel(s13)}
К2-1    = ${k21}%  (норма ≥ 30%)  → ${normLabel(sk21)}

=== ГЭП-ТАБЛИЦА (млн TJS) — ${gapMonthsFull[0]}–${gapMonthsFull[5]} ===
Месяц  |      Активы  | Обязательства | ГЭП
${gapTableLines.join('\n')}
Итого за период: активы ${assetTotals.reduce((s,v)=>s+v,0).toLocaleString('ru-RU')} — обяз. ${liabTotals.reduce((s,v)=>s+v,0).toLocaleString('ru-RU')} = ${(totalGap >= 0 ? '+' : '') + totalGap.toLocaleString('ru-RU')} (${hasDeficit ? `дефицит в ${negGapMonths} из 6 мес., макс. ${maxDeficit.toLocaleString('ru-RU')} млн TJS` : 'профицит во всех месяцах'})

=== ИСТОЧНИКИ ФИНАНСИРОВАНИЯ ===
№  | Источник             | Валюта/Объём | Статус     | Стоимость | Срок
${sourcesTableLines.join('\n')}
Доступные: ${totalAvail.toLocaleString('ru-RU')} млн | Условные: ${totalCond.toLocaleString('ru-RU')} млн | Итого: ${totalSources.toLocaleString('ru-RU')} млн TJS${stressMeta ? `

=== ДАННЫЕ ПОСЛЕДНЕГО СТРЕСС-ТЕСТА ЛИКВИДНОСТИ ===
${stressMeta}` : ''}

---
ИНСТРУКЦИЯ: Составь документ из РОВНО 6 разделов в официальном банковском стиле. Конкретные цифры из данных выше — никаких обобщений. Запрещены: markdown (**, *, #), ссылки на международные стандарты, расплывчатые формулировки. Не указывай конкретные даты.

РАЗДЕЛ 1. КРАТКАЯ СВОДКА ТЕКУЩЕЙ СИТУАЦИИ
Напиши ровно 2–3 предложения:
  Предл. 1: Назови текущие значения CAR 1.1 = ${car11}%, CAR 1.2 = ${car12}%, CAR 1.3 = ${car13}%, К2-1 = ${k21}% и их соответствие нормативам Инструкции №247 НБТ РТ (${allNormsMet ? 'все нормативы соблюдены' : anyRed ? 'выявлены нарушения нормативов' : 'нормативы в зоне наблюдения'}).
  Предл. 2: Охарактеризуй ГЭП-позицию: ${hasDeficit ? `выявлен дефицит в ${negGapMonths} из 6 месяцев, максимальный разрыв — ${maxDeficit.toLocaleString('ru-RU')} млн TJS` : 'позиция ликвидности характеризуется профицитом во всех рассматриваемых месяцах'}.
  Предл. 3: Краткий вывод о необходимости поддержания CFP и степени готовности источников (${totalSources.toLocaleString('ru-RU')} млн TJS).

РАЗДЕЛ 2. ПЛАН РОСТА АКТИВОВ — ГЭП ПО МЕСЯЦАМ
Воспроизведи каждый месяц строкой: "МЕС: активы X млн TJS, обязательства Y млн TJS, ГЭП ±Z млн TJS (профицит/дефицит)" — данные строго из ГЭП-таблицы выше.
После таблицы — вывод (2–3 предложения): ${hasDeficit ? `в каких месяцах дефицит наиболее выражен и покрывает ли буфер (${bufferCashEq.toLocaleString('ru-RU')} млн TJS, ~${horizonDays} дней) критический разрыв` : `достаточность профицита и буфера ликвидности (${bufferCashEq.toLocaleString('ru-RU')} млн TJS) для управления разрывами`}.${stressMeta ? ` Подкрепи вывод данными стресс-теста.` : ''}

РАЗДЕЛ 3. ИСТОЧНИКИ ФИНАНСИРОВАНИЯ
Подраздел 3.1. Потребность в ликвидности:
${s3NeedBlock}
Воспроизведи эти данные точно, затем 1–2 предложения об адекватности покрытия.

Подраздел 3.2. Источники финансирования (воспроизведи таблицу из данных выше, каждая строка: "N. Источник | Валюта Объём млн | Статус | Стоимость | Срок"):
Порядок активации: нумерованный список по приоритету — сначала доступные, затем условные.
Итоговая строка: доступные ${totalAvail.toLocaleString('ru-RU')} млн TJS + условные ${totalCond.toLocaleString('ru-RU')} млн TJS = ${totalSources.toLocaleString('ru-RU')} млн TJS.
1–2 предложения о покрытии потребности.

РАЗДЕЛ 4. МЕРЫ ПО ОБЕСПЕЧЕНИЮ ЛИКВИДНОСТИ
Воспроизведи дословно:
  1. Мониторинг нормативов: К2-1 — ежедневно; CAR 1.1, CAR 1.2, CAR 1.3 — ежемесячно. Ответственный: Казначейство / СУР. Основание: Инструкция №247 НБТ РТ.
  2. Стресс-тестирование ликвидности: не реже 1 раза в 6 месяцев; сценарии — пессимистический (отток 20% обязательств) и катастрофический (отток 40%). Ответственный: СУР.
  3. Прогнозирование денежных потоков: ежемесячно на горизонте 6 месяцев. Ответственный: Казначейство.
  4. Актуализация резервных источников финансирования: подтверждение лимитов — не реже 1 раза в квартал. Ответственный: Казначейство.
  5. Обновление CFP: не реже 1 раза в полугодие. Основание: Инструкция №247 НБТ РТ.

РАЗДЕЛ 5. ДЕЙСТВИЯ НА СЛУЧАЙ АКТИВАЦИИ ПЛАНА
Воспроизведи дословно — 8 шагов (формат каждого: "N. Действие — Ответственный — Срок"):
  1. Фиксация сигналов ухудшения ликвидности и уведомление ответственных лиц — Операционный департамент — немедленно
  2. Созыв внеочередного заседания КУАП — КУАП — в течение 1 рабочего дня
  3. Официальная активация CFP решением КУАП — КУАП — не позднее 24 часов с момента сигнала
  4. Формирование рабочей группы по управлению ликвидностью — КУАП / Казначейство — в день активации
  5. Поддержание корреспондентских счетов на максимально возможном уровне — Казначейство — немедленно после активации
  6. Приостановка новых кредитных выдач и ограничение необязательных расходов — СУР / Операционный департамент — в день активации
  7. Ускорение взыскания дебиторской задолженности и расчётов с контрагентами — Операционный департамент — в течение 3 рабочих дней
  8. Активация резервных источников финансирования в порядке приоритетности из раздела 3 — Казначейство — в течение 2 рабочих дней

РАЗДЕЛ 6. ПЛАН КОММУНИКАЦИИ
Воспроизведи дословно:
  1. Инициатор: Операционный департамент выявляет сигналы ухудшения ликвидности и инициирует процедуру уведомления руководства.
  2. Рассмотрение: КУАП оценивает масштаб угрозы и принимает решение о необходимости активации CFP.
  3. Утверждение активации: исключительно решением КУАП, оформляется протоколом заседания.
  4. Уведомление: Правление банка — незамедлительно; НБТ РТ — в сроки, установленные Инструкцией №247 НБТ РТ; ключевые контрагенты — по решению КУАП.
  5. Режим отчётности в период активации: ежедневный отчёт Казначейства в КУАП; еженедельный отчёт КУАП в Правление.
  6. Документирование: все решения КУАП оформляются протоколами и хранятся в соответствии с регламентом документооборота банка.`

    const text = await aiGenerateText(prompt, 4500)
    return NextResponse.json({ sections: text })

  } catch (err) {
    console.error('CFP generate error:', err)
    return NextResponse.json({ error: 'Ошибка генерации CFP' }, { status: 500 })
  }
}

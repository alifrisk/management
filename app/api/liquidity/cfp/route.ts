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

    // ── GAP data ──────────────────────────────────────────────────────────────
    const gapRows: number[][] = d.gap_data?.rows || Array(6).fill([0,0,0,0,0,0])
    const assetRows = gapRows.slice(0, 3)
    const liabRows  = gapRows.slice(3, 6)
    const assetTotals = Array(6).fill(0).map((_, mi) => assetRows.reduce((s: number, r: number[]) => s + (r[mi] || 0), 0))
    const liabTotals  = Array(6).fill(0).map((_, mi) => liabRows.reduce((s: number, r: number[]) => s + (r[mi] || 0), 0))
    const gapByMonth  = assetTotals.map((a, i) => a - liabTotals[i])
    const totLiab     = liabTotals

    // ── GAP month labels ──────────────────────────────────────────────────────
    const planDate = d.plan_date || ''
    const gapStart = planDate ? (new Date(planDate + 'T00:00:00').getMonth() + 1) % 12 : 6
    const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
    const gapMonths = Array.from({ length: 6 }, (_, i) => MONTHS[(gapStart + i) % 12])

    // ── Financing sources ─────────────────────────────────────────────────────
    const sources: { priority: number; source: string; status: string; currency: string; amount: string; cost: string; term: string }[] =
      d.financing_sources || []

    const BANK_PATTERN = /алиф|alif|бонк|банк\s+алиф|alif\s+bank/gi
    const sanitizeSource = (name: string) => name.replace(BANK_PATTERN, '[Банк]').trim()

    const totalAvail   = sources.filter(s => s.status === 'available').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalCond    = sources.filter(s => s.status === 'conditional').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalSources = totalAvail + totalCond

    const sourcesLines = sources.length === 0
      ? ['  Источники не указаны']
      : sources.map(s => {
          const stLabel = s.status === 'available' ? 'Доступен' : s.status === 'conditional' ? 'Условный' : 'Недоступен'
          return `  ${s.priority}. ${sanitizeSource(s.source)} | ${s.currency} ${s.amount} млн | ${stLabel} | Стоимость: ${s.cost} | Срок: ${s.term}`
        })

    // ── Buffer ────────────────────────────────────────────────────────────────
    const bufferCashEq    = Number(d.liquidity_buffer?.cash_equivalents) || 0
    const bufferCash      = Number(d.liquidity_buffer?.cash_only)         || 0
    const avgMonthlyLiab  = totLiab.reduce((s, v) => s + v, 0) / 6 || 1
    const avgDailyOutflow = Math.round(avgMonthlyLiab / 30) || 1
    const horizonDays     = bufferCashEq > 0 ? Math.round(bufferCashEq / avgDailyOutflow) : 0

    // ── Stress amounts ────────────────────────────────────────────────────────
    const baseMonthLiab = totLiab[0] || 0
    const pessOutflow   = Math.round(baseMonthLiab * 0.20)
    const catOutflow    = Math.round(baseMonthLiab * 0.40)
    const pessCovPct    = pessOutflow > 0 ? Math.round((totalSources / pessOutflow) * 100) : 0
    const catCovPct     = catOutflow  > 0 ? Math.round((totalAvail    / catOutflow)  * 100) : 0

    // ── GAP lines for section 2 ───────────────────────────────────────────────
    const gapLines = gapMonths.map((m, i) => {
      const gap = gapByMonth[i]
      return `  ${m}: активы ${assetTotals[i].toLocaleString('ru-RU')} — обяз. ${liabTotals[i].toLocaleString('ru-RU')} = ГЭП ${gap >= 0 ? '+' : ''}${gap.toLocaleString('ru-RU')} (${gap >= 0 ? 'профицит' : 'дефицит'})`
    }).join('\n')

    // ── Last liquidity stress test from Supabase ──────────────────────────────
    let stressBlock = ''
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
        const res = stRow.results as Record<string, unknown> | null
        const tot = (res?.total as Record<string, unknown>) || {}
        const t1  = (tot.t1  as Record<string, number>) || {}
        const t7  = (tot.t7  as Record<string, number>) || {}
        const t30 = (tot.t30 as Record<string, number>) || {}
        const sc  = (res?.scenario as string) || ''
        const lines = [
          `Название: ${stRow.period || '—'} (${new Date(stRow.created_at).toLocaleDateString('ru-RU')})`,
          sc ? `Сценарий: ${sc}` : '',
          t1.need  > 0 ? `  T+1  — потребность: ${Math.round(t1.need).toLocaleString('ru-RU')} млн TJS, покрытие: ${Math.round((t1.cov_cash  || 0) * 100)}%` : '',
          t7.need  > 0 ? `  T+7  — потребность: ${Math.round(t7.need).toLocaleString('ru-RU')} млн TJS, покрытие: ${Math.round((t7.cov_cash  || 0) * 100)}%` : '',
          t30.need > 0 ? `  T+30 — потребность: ${Math.round(t30.need).toLocaleString('ru-RU')} млн TJS, покрытие: ${Math.round((t30.cov_cash || 0) * 100)}%` : '',
        ].filter(Boolean).join('\n')
        stressBlock = `ДАННЫЕ ПОСЛЕДНЕГО СТРЕСС-ТЕСТА ЛИКВИДНОСТИ:\n${lines}\n\n`
      }
    } catch { /* no registry row — proceed without stress data */ }

    const planPeriod = d.plan_period || 'II полугодие 2026'

    const prompt = `Ты риск-менеджер банка. Составь ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ (CFP) строго в соответствии с Инструкцией №247 НБТ РТ. Запрещено упоминать международные стандарты (Базель, LCR, NSFR, ISO и пр.) — ТОЛЬКО Инструкция №247 НБТ РТ.

ПЕРИОД ПЛАНА: ${planPeriod}

НОРМАТИВЫ:
  CAR 1.1 = ${car11}% (норма ≥ 12%): ${normLabel(s11)}
  CAR 1.2 = ${car12}% (норма ≥ 10%): ${normLabel(s12)}
  CAR 1.3 = ${car13}% (норма ≥ 10%): ${normLabel(s13)}
  К2-1 = ${k21}% (норма ≥ 30%): ${normLabel(sk21)}

ГЭП-ТАБЛИЦА (млн TJS) — ${gapMonths[0]}–${gapMonths[5]}:
${gapLines}
  Буфер ликвидности: ДС и эквиваленты ${bufferCashEq} млн TJS | Только ДС ${bufferCash} млн TJS
  Горизонт покрытия (среднедневной отток ~${avgDailyOutflow} млн TJS): ~${horizonDays} дней

ИСТОЧНИКИ ФИНАНСИРОВАНИЯ:
${sourcesLines.join('\n')}
  Итого доступные: ${totalAvail} млн TJS | Условные: ${totalCond} млн TJS | Всего: ${totalSources} млн TJS

${stressBlock}---

Составь документ из РОВНО 6 разделов. Официальный банковский стиль, конкретные цифры из данных выше. Без общих фраз. Не используй markdown (**, *, #, _). Не указывай конкретные даты.

РАЗДЕЛ 1. КРАТКАЯ СВОДКА ТЕКУЩЕЙ СИТУАЦИИ
Строго 2-3 предложения: текущие значения CAR 1.1 = ${car11}% (${normLabel(s11)}) и К2-1 = ${k21}% (${normLabel(sk21)}), общая оценка достаточности капитала и ликвидности банка, краткий вывод о необходимости мер в рамках CFP.

РАЗДЕЛ 2. ПЛАН РОСТА АКТИВОВ — ГЭП ПО МЕСЯЦАМ
Таблица ГЭП за 6 месяцев (${gapMonths[0]}–${gapMonths[5]}): для каждого месяца — итого активы, итого обязательства, ГЭП (профицит/дефицит). Данные брать строго из ГЭП-таблицы выше.${stressBlock ? `\nДля обоснования использовать данные последнего стресс-теста ликвидности (потребности по горизонтам T+1/T+7/T+30) из блока выше.` : ''}
Вывод о достаточности: покрывает ли буфер ликвидности (${bufferCashEq} млн TJS, горизонт ~${horizonDays} дней) выявленный дефицит; достаточна ли позиция на горизонте плана.

РАЗДЕЛ 3. ИСТОЧНИКИ ФИНАНСИРОВАНИЯ
Сколько нужно:
  Пессимистический сценарий (отток 20% обязательств базового месяца = ${pessOutflow} млн TJS): совокупные источники ${totalSources} млн TJS покрывают ${pessCovPct}% оттока.
  Катастрофический сценарий (отток 40% = ${catOutflow} млн TJS): только доступные источники ${totalAvail} млн TJS покрывают ${catCovPct}% оттока.
Откуда берём: таблица источников (Источник | Статус | Валюта | Объём млн TJS | Стоимость | Срок) по данным блока выше.
Приоритизация: нумерованный порядок активации источников, начиная с наиболее ликвидных и наименее затратных. Вывод об адекватности покрытия по каждому сценарию.

РАЗДЕЛ 4. МЕРЫ ПО ОБЕСПЕЧЕНИЮ ЛИКВИДНОСТИ
Конкретные меры на постоянной основе (независимо от активации CFP):
1. Мониторинг: К2-1 — ежедневно; CAR 1.1/1.2/1.3 — ежемесячно (требование Инструкции №247 НБТ РТ).
2. Стресс-тестирование: не реже 1 раза в 6 месяцев; сценарии — пессимистический (отток 20%) и катастрофический (отток 40%).
3. Прогнозирование денежных потоков: ежемесячно на горизонте 6 месяцев.
4. Поддержание резервных источников: актуализация перечня и подтверждение лимитов не реже 1 раза в квартал.
5. Обновление CFP: не реже 1 раза в полугодие в соответствии с Инструкцией №247 НБТ РТ.

РАЗДЕЛ 5. ДЕЙСТВИЯ НА СЛУЧАЙ АКТИВАЦИИ
Перечисли РОВНО 8 шагов в указанном порядке. Для каждого шага: порядковый номер, содержание действия, ответственное подразделение (только из КУАП / Казначейство / СУР / Операционный департамент), срок исполнения:
1. Фиксация сигналов ухудшения ликвидности и уведомление ответственных лиц — Операционный департамент — немедленно
2. Созыв внеочередного заседания КУАП — КУАП — в течение 1 рабочего дня
3. Официальная активация CFP решением КУАП — КУАП — не позднее 24 часов с момента сигнала
4. Формирование рабочей группы по управлению ликвидностью — КУАП / Казначейство — в день активации
5. Поддержание корреспондентских счетов на максимальном уровне — Казначейство — немедленно после активации
6. Приостановка новых кредитных выдач и ограничение необязательных расходов — СУР / Операционный департамент — в день активации
7. Ускорение взыскания дебиторской задолженности и расчётов с контрагентами — Операционный департамент — в течение 3 рабочих дней
8. Активация резервных источников финансирования в порядке приоритетности — Казначейство — в течение 2 рабочих дней

РАЗДЕЛ 6. ПЛАН КОММУНИКАЦИИ
Порядок уведомлений (обязателен по Инструкции №247 НБТ РТ):
1. Кто инициирует: Операционный департамент выявляет сигналы ухудшения ликвидности и инициирует процедуру уведомления
2. Кто рассматривает: КУАП оценивает масштаб угрозы и принимает решение об активации CFP
3. Кто утверждает: активация CFP — исключительно решением КУАП, оформляется протоколом
4. Кто уведомляется: Правление банка — незамедлительно; НБТ РТ — в сроки, установленные Инструкцией №247; ключевые контрагенты — по решению КУАП
5. Режим отчётности: ежедневный отчёт Казначейства в КУАП; еженедельный отчёт КУАП в Правление банка
6. Документирование: все решения оформляются протоколами КУАП и хранятся в соответствии с регламентом документооборота банка`

    const text = await aiGenerateText(prompt, 4000)
    return NextResponse.json({ sections: text })

  } catch (err) {
    console.error('CFP generate error:', err)
    return NextResponse.json({ error: 'Ошибка генерации CFP' }, { status: 500 })
  }
}

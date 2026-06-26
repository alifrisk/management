import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'
import { statusCar11, statusCar12, statusCar13, statusK21, normLabel } from '@/lib/cfpCalculations'

const GAP_MONTHS = ['Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const GAP_ASSETS = ['Денежные средства', 'Ограниченные ден. ср-ва', 'Кредиты выданные']
const GAP_LIAB   = ['Счета клиентов', 'Привлечённые займы', 'Субординированный займ']

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
    const assetsRows = gapRows.slice(0, 3)
    const liabRows   = gapRows.slice(3, 6)

    const totAssets = GAP_MONTHS.map((_, mi) => assetsRows.reduce((s, r) => s + (r[mi] || 0), 0))
    const totLiab   = GAP_MONTHS.map((_, mi) => liabRows.reduce((s, r) => s + (r[mi] || 0), 0))
    const gaps      = GAP_MONTHS.map((_, mi) => totAssets[mi] - totLiab[mi])

    const gapLines = [
      'АКТИВЫ:',
      ...GAP_ASSETS.map((name, ri) =>
        `  ${name}: ${GAP_MONTHS.map((m, mi) => `${m}=${assetsRows[ri]?.[mi] ?? 0}`).join(', ')}`
      ),
      `  Итого активы: ${GAP_MONTHS.map((m, mi) => `${m}=${totAssets[mi]}`).join(', ')}`,
      'ОБЯЗАТЕЛЬСТВА:',
      ...GAP_LIAB.map((name, ri) =>
        `  ${name}: ${GAP_MONTHS.map((m, mi) => `${m}=${liabRows[ri]?.[mi] ?? 0}`).join(', ')}`
      ),
      `  Итого обязательства: ${GAP_MONTHS.map((m, mi) => `${m}=${totLiab[mi]}`).join(', ')}`,
      `ГЭП: ${GAP_MONTHS.map((m, mi) => `${m}=${gaps[mi] >= 0 ? '+' : ''}${gaps[mi]}`).join(', ')}`,
    ]

    // ── Financing sources ─────────────────────────────────────────────────────
    const sources: { priority: number; source: string; status: string; currency: string; amount: string; cost: string; term: string }[] =
      d.financing_sources || []

    const totalAvail   = sources.filter(s => s.status === 'available').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalCond    = sources.filter(s => s.status === 'conditional').reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const totalSources = totalAvail + totalCond

    const sourcesLines = sources.length === 0
      ? ['  Источники не указаны']
      : sources.map(s => {
          const stLabel = s.status === 'available' ? 'Доступен' : s.status === 'conditional' ? 'Условный' : 'Недоступен'
          return `  ${s.priority}. ${s.source} | ${s.currency} ${s.amount} млн | ${stLabel} | Стоимость: ${s.cost} | Срок: ${s.term}`
        })

    // ── Stress amounts ────────────────────────────────────────────────────────
    const baseMonthLiab = totLiab[0] || 0
    const pessOutflow   = Math.round(baseMonthLiab * 0.20)
    const catOutflow    = Math.round(baseMonthLiab * 0.40)
    const pessCovPct    = pessOutflow > 0 ? Math.round((totalSources / pessOutflow) * 100) : 0
    const catCovPct     = catOutflow  > 0 ? Math.round((totalAvail    / catOutflow)  * 100) : 0

    // ── Buffer ────────────────────────────────────────────────────────────────
    const bufferCashEq   = Number(d.liquidity_buffer?.cash_equivalents) || 0
    const bufferCash     = Number(d.liquidity_buffer?.cash_only)         || 0
    const avgMonthlyLiab = totLiab.reduce((s, v) => s + v, 0) / 6 || 1
    const avgDailyOutflow = Math.round(avgMonthlyLiab / 30) || 1
    const horizonDays     = bufferCashEq > 0 ? Math.round(bufferCashEq / avgDailyOutflow) : 0

    const planPeriod = d.plan_period || 'II полугодие 2026'

    const prompt = `Ты риск-менеджер банка. Составь ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ (CFP) строго в соответствии с Инструкцией №247 НБТ РТ. Запрещено упоминать международные стандарты (Базель, LCR, НSFR, ISO и пр.) — ТОЛЬКО Инструкция №247 НБТ РТ.

ПЕРИОД ПЛАНА: ${planPeriod}

НОРМАТИВЫ:
  CAR 1.1 = ${car11}% (норма ≥ 12%): ${normLabel(s11)}
  CAR 1.2 = ${car12}% (норма ≥ 10%): ${normLabel(s12)}
  CAR 1.3 = ${car13}% (норма ≥ 10%): ${normLabel(s13)}
  К2-1 = ${k21}% (норма ≥ 30%): ${normLabel(sk21)}

ГЭП-АНАЛИЗ (млн TJS):
${gapLines.join('\n')}

ИСТОЧНИКИ ФИНАНСИРОВАНИЯ:
${sourcesLines.join('\n')}
  Итого доступные: ${totalAvail} млн TJS | Условные: ${totalCond} млн TJS | Всего: ${totalSources} млн TJS

БУФЕР ЛИКВИДНОСТИ:
  Денежные средства и эквиваленты: ${bufferCashEq} млн TJS
  Только денежные средства: ${bufferCash} млн TJS
  Расчётный горизонт покрытия (среднедневной отток ~${avgDailyOutflow} млн): ~${horizonDays} дней

---

Составь документ из РОВНО 6 разделов. Официальный банковский стиль, конкретные цифры из данных выше. Без общих фраз. Не используй markdown (**, *, #, _). Не указывай конкретные даты.

РАЗДЕЛ 1. ПЛАН РОСТА АКТИВОВ
На основе ГЭП-анализа оцени позицию каждого месяца. Для каждого из 6 месяцев (${GAP_MONTHS.join(', ')}):
- Укажи значение ГЭПа и статус (профицит / дефицит)
- При отрицательном ГЭПе — конкретные меры по наращиванию ликвидных активов
- При положительном ГЭПе — меры по оптимальному размещению
Итог: сводная таблица (Месяц | ГЭП млн TJS | Статус | Плановые меры).

РАЗДЕЛ 2. ПОТЕНЦИАЛЬНЫЕ ИСТОЧНИКИ ФИНАНСИРОВАНИЯ
Таблица источников из данных выше (Источник | Статус | Валюта | Объём млн TJS | Стоимость | Срок).
Стресс-анализ по двум сценариям Инструкции №247:
Пессимистический (отток 20% обязательств базового месяца = ${pessOutflow} млн TJS):
  Совокупные источники ${totalSources} млн TJS покрывают ${pessCovPct}% оттока. Вывод об адекватности.
Катастрофический (отток 40% = ${catOutflow} млн TJS):
  Только доступные источники ${totalAvail} млн TJS покрывают ${catCovPct}% оттока. Вывод об адекватности и дополнительных мерах.

РАЗДЕЛ 3. МЕРЫ ПО ПОДДЕРЖАНИЮ ЛИКВИДНОСТИ
Блок А — Мониторинг (в соответствии с Инструкцией №247 НБТ РТ):
  ГЭП-позиция: не реже 1 раза в месяц
  Норматив К2-1: ежедневно
  Нормативы CAR 1.1/1.2/1.3: ежемесячно
Блок Б — Стресс-тестирование:
  Периодичность: не реже 1 раза в 6 месяцев (требование Инструкции №247)
  Сценарии: пессимистический (отток 20%) и катастрофический (отток 40%)
Блок В — Прогнозирование:
  Ежемесячный прогноз денежных потоков на горизонте 6 месяцев
Блок Г — Резервные источники:
  Нумерованный перечень источников из введённых данных с указанием порядка активации.

РАЗДЕЛ 4. БУФЕР ЛИКВИДНОСТИ
Параметры буфера: ДС и эквиваленты ${bufferCashEq} млн TJS | Только ДС ${bufferCash} млн TJS.
Коэффициент покрытия оттоков буфером (среднедневной отток ~${avgDailyOutflow} млн TJS):
  T+1 (1 день): оценка покрытия
  T+7 (7 дней): оценка покрытия
  T+30 (30 дней): горизонт ~${horizonDays} дней
Три зоны риска:
  Целевая зона: горизонт покрытия T+30 и более
  Зона риска: горизонт T+7 — T+30
  Регуляторный минимум (НБТ №247): горизонт T+1 — T+7
Пессимистический сценарий: буфер снижается на 20% → пересчёт горизонта
Катастрофический сценарий: буфер снижается на 40% → пересчёт горизонта
Итоговый вывод: в какой зоне находится банк и какие действия требуются.

РАЗДЕЛ 5. ЭКСТРЕННЫЕ МЕРЫ
Перечисли РОВНО 8 мер в указанном порядке — для каждой: ответственное подразделение, срок реализации и конкретное содержание:
1. Созыв заседания КУАП в экстренном режиме
2. Создание рабочей группы по управлению ликвидностью
3. Активация Плана финансирования на случай ЧС (CFP)
4. Поддержание остатков на корреспондентских счетах на максимальном уровне
5. Снижение кредитной активности — приостановка новых выдач
6. Ограничение выплат дивидендов, бонусов и прочих необязательных расходов
7. Ускорение расчётов с партнёрами и дебиторами
8. Реализация высоколиквидных активов (ценных бумаг, РЕПО)

РАЗДЕЛ 6. ПЛАН КОММУНИКАЦИИ
Зафиксируй следующий порядок (обязателен по Инструкции №247 НБТ РТ):
1. Отдел операций фиксирует сигналы ухудшения ликвидности и инициирует уведомление ответственных лиц
2. КУАП рассматривает ситуацию, оценивает масштаб угрозы и принимает решение о необходимости активации CFP
3. Активация CFP осуществляется исключительно решением КУАП
Дополнительно: порядок уведомления НБТ РТ, контрагентов и Правления; сроки уведомления; каналы коммуникации; режим отчётности в период действия CFP.`

    const text = await aiGenerateText(prompt, 4000)
    return NextResponse.json({ sections: text })

  } catch (err) {
    console.error('CFP generate error:', err)
    return NextResponse.json({ error: 'Ошибка генерации CFP' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'
import {
  statusCar11, statusCar12, statusCar13, statusK21, normLabel,
  ewiN1, ewiLcr, ewiOutflow, ewiTop5, overallEwi,
  calcSurvivalHorizon, calcReserveCoverage,
  EWI_EMOJI, EWI_LABEL, READINESS_LEVELS,
} from '@/lib/cfpCalculations'

export async function POST(req: Request) {
  try {
    const d = await req.json()

    // ── Определяем формат данных (новый vs старый) ────────────────────────────
    const isNewFormat = d.car11 != null || d.car12 != null || d.car13 != null

    if (isNewFormat) {
      // ── НОВЫЙ ФОРМАТ: нормативы НБТ №176 и №247 ─────────────────────────────
      const car11 = Number(d.car11) || 0
      const car12 = Number(d.car12) || 0
      const car13 = Number(d.car13) || 0
      const k21   = Number(d.k21)   || 0

      const s11  = statusCar11(car11)
      const s12  = statusCar12(car12)
      const s13  = statusCar13(car13)
      const sk21 = statusK21(k21)

      const liab          = d.liabilities || {}
      const termDeposits  = Number(liab.term_deposits)   || 0
      const currentAccs   = Number(liab.current_accounts) || 0
      const interbank     = Number(liab.interbank)        || 0
      const other         = Number(liab.other)            || 0
      const totalLiab     = termDeposits + currentAccs + interbank + other

      const fundingSources: { name: string; amount: number; access_term: string; status: string }[] = d.funding_sources || []
      const totalFunding = fundingSources.reduce((s, r) => s + (Number(r.amount) || 0), 0)

      const planPeriod = d.plan_period || ''
      const planDate   = d.plan_date   || ''

      const anyBreach  = [s11, s12, s13, sk21].includes('red')
      const anyWarning = [s11, s12, s13, sk21].includes('yellow')
      const overallComplianceLabel = anyBreach ? '🔴 ЕСТЬ НАРУШЕНИЯ НОРМАТИВОВ' : anyWarning ? '⚠️ НОРМАТИВЫ БЛИЗКО К НАРУШЕНИЮ' : '🟢 ВСЕ НОРМАТИВЫ СОБЛЮДЕНЫ'

      const sourcesBlock = fundingSources.length === 0
        ? 'Источники не указаны'
        : fundingSources.map((r, i) =>
            `  ${i + 1}. ${r.name} — ${r.amount} млн TJS | Доступность: ${r.access_term} | Статус: ${r.status}`
          ).join('\n')

      // Рассчитываем стресс-сценарии для запаса ликвидности
      const k21Gap  = k21 > 0 ? k21 - 30 : 0   // запас до минимума НБТ
      const k21Mild = Math.max(k21 - 5, 0)       // умеренный стресс
      const k21Mod  = Math.max(k21 - 10, 0)      // средний стресс
      const k21Sev  = Math.max(k21 - 15, 0)      // жёсткий стресс

      const prompt = `Ты опытный риск-менеджер банка. Составь ОПЕРАТИВНЫЙ ПЛАН — не аналитическую справку, а конкретный документ «что делать и кто делает» в случае кризиса ликвидности.

ИСХОДНЫЕ ДАННЫЕ БАНКА:
Нормативы достаточности капитала (Инструкция НБТ №176):
  CAR 1.1 = ${car11}% (норма >= 12%, ${normLabel(s11)}, запас ${car11 > 12 ? (car11 - 12).toFixed(1) : '—'} п.п.)
  CAR 1.2 = ${car12}% (норма >= 10%, ${normLabel(s12)}, запас ${car12 > 10 ? (car12 - 10).toFixed(1) : '—'} п.п.)
  CAR 1.3 = ${car13}% (норма >= 10%, ${normLabel(s13)}, запас ${car13 > 10 ? (car13 - 10).toFixed(1) : '—'} п.п.)
Норматив ликвидности (Инструкция НБТ №247):
  К2-1 = ${k21}% (норма >= 30%, ${normLabel(sk21)}, запас ${k21Gap > 0 ? k21Gap.toFixed(1) + ' п.п.' : 'нет — нарушение'})
Структура обязательств:
  Срочные депозиты физлиц: ${termDeposits} млн TJS
  Текущие счета: ${currentAccs} млн TJS
  МБК: ${interbank} млн TJS
  Прочие: ${other} млн TJS
  Итого обязательства: ${totalLiab} млн TJS
Заявленные источники финансирования:
${sourcesBlock}
  Итого доступно: ${totalFunding} млн TJS
${planPeriod ? `Период плана: ${planPeriod}` : ''}

СТРУКТУРА ДОКУМЕНТА — составь каждый раздел как оперативный план, не как аналитику:

РАЗДЕЛ 1. ОЦЕНКА ТЕКУЩЕЙ ПОЗИЦИИ ЛИКВИДНОСТИ
Таблица нормативов: для каждого из 4 показателей — значение, норма НБТ, отклонение (+/-), статус (Норма/Нарушение).
Итоговый вывод: есть ли нарушения, каков запас прочности по К2-1, критические риски.

РАЗДЕЛ 2. ПЛАН РОСТА ЛИКВИДНЫХ АКТИВОВ
Перечень конкретных мер по наращиванию ликвидности при стрессе. Для каждой меры в формате строки:
Мера — Плановый объём (млн TJS) — Горизонт (T+1 / T+7 / T+30) — Ответственный
Включить минимум 6 мер: сокращение новых выдач кредитов, продажа/РЕПО ценных бумаг, привлечение срочных депозитов, рефинансирование НБТ, пролонгация МБК, субординированный займ от акционеров, приостановка дивидендов.

РАЗДЕЛ 3. ЗАПАС ЛИКВИДНОСТИ (СТРЕСС-ТЕСТ)
На основе текущего К2-1 = ${k21}% рассчитай три сценария:
Сценарий 1 (умеренный): К2-1 снижается до ${k21Mild.toFixed(1)}% (−5 п.п.) — оцени достаточность ликвидности
Сценарий 2 (средний): К2-1 снижается до ${k21Mod.toFixed(1)}% (−10 п.п.) — оцени дефицит/профицит
Сценарий 3 (жёсткий): К2-1 снижается до ${k21Sev.toFixed(1)}% (−15 п.п.) — экстренные меры
Для каждого сценария: статус норматива, оценочный дефицит ликвидности (млн TJS), какие источники активировать.

РАЗДЕЛ 4. ИСТОЧНИКИ ЭКСТРЕННОГО ФИНАНСИРОВАНИЯ
Полная таблица в формате строк:
Источник — Объём (млн TJS, оценочно) — Срок активации — Ответственный — Статус
Сначала заявленные источники банка, затем стандартные по НБТ №247.

РАЗДЕЛ 5. ШАГИ РЕАГИРОВАНИЯ И ОТВЕТСТВЕННЫЕ ЛИЦА
Таблица действий при активации CFP (минимум 10 шагов), каждый шаг в формате:
Шаг N. [Описание действия] | Триггер: К2-1 < X% или CAR < Y% | Срок: [часы/дни] | Ответственный: [подразделение]
Охватить весь цикл: от обнаружения сигнала → уведомление КУАП → экстренное заседание → активация источников → коммуникация с НБТ → мониторинг → стабилизация → выход из кризиса.
Отдельным блоком — матрица ответственности:
КУАП: [конкретные полномочия и решения]
Казначейство: [конкретные оперативные действия]
СУР: [мониторинг, отчётность, триггеры]
Правление: [стратегические решения, коммуникация]
Наблюдательный совет: [надзор, утверждение экстренных мер]

РАЗДЕЛ 6. ПЛАН ПО ВРЕМЕННЫМ ГОРИЗОНТАМ
T+1 (первые 24 часа): нумерованный список конкретных первоочередных действий
T+7 (первая неделя): нумерованный список мер краткосрочной стабилизации
T+30 (первый месяц): нумерованный список мер восстановления нормативов

НЕ пиши общие слова и информационные параграфы — только конкретные действия, цифры, ответственных.
НЕ используй markdown (**, *, #, _).
НЕ указывай конкретные даты.
Стиль: официальный внутренний документ банка.`

      const text = await aiGenerateText(prompt, 3500)
      return NextResponse.json({ conclusion: text })

    } else {
      // ── СТАРЫЙ ФОРМАТ: EWI + HQLA (обратная совместимость) ─────────────────
      const n1      = Number(d.n1) || 0
      const lcr     = Number(d.lcr) || 0
      const outflow7d = Number(d.deposit_outflow_7d) || 0
      const top5    = Number(d.top5_share) || 0
      const hqlaL1  = Number(d.hqla_l1) || 0
      const hqlaL2a = Number(d.hqla_l2a) || 0
      const hqlaL2b = Number(d.hqla_l2b) || 0
      const hqlaTotal = hqlaL1 + hqlaL2a + hqlaL2b
      const obInterbank = Number(d.ob_interbank) || 0
      const obCurrent   = Number(d.ob_current) || 0
      const obSavings   = Number(d.ob_savings) || 0
      const obTerm      = Number(d.ob_term) || 0
      const obCreditLines = Number(d.ob_credit_lines) || 0
      const totalDeposits   = obCurrent + obSavings + obTerm
      const totalObligations = obInterbank + totalDeposits + obCreditLines
      const reserveSources: { name: string; amount: number; status: string; access_term: string }[] = d.reserve_sources || []
      const reserveTotal        = reserveSources.reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const pessimisticOutflow  = totalDeposits * (outflow7d / 100)
      const readinessLevel      = Number(d.readiness_level) || 1

      const s_n1   = ewiN1(n1)
      const s_lcr  = ewiLcr(lcr)
      const s_out  = ewiOutflow(outflow7d)
      const s_top5 = ewiTop5(top5)
      const overall = overallEwi([s_n1, s_lcr, s_out, s_top5])

      const survivalHorizon = calcSurvivalHorizon(hqlaTotal, totalDeposits, outflow7d)
      const reserveCoverage = calcReserveCoverage(reserveTotal, pessimisticOutflow)
      const rl = READINESS_LEVELS[readinessLevel]

      const prompt = `Ты эксперт по управлению ликвидностью банка.
Составь CFP-заключение для ОАО «Алиф Банк».

EWI: Н1=${n1}% ${EWI_EMOJI[s_n1]} | LCR=${lcr}% ${EWI_EMOJI[s_lcr]} | Отток 7д=${outflow7d}% ${EWI_EMOJI[s_out]} | Топ-5=${top5}% ${EWI_EMOJI[s_top5]}
Общий EWI: ${EWI_EMOJI[overall]} ${EWI_LABEL[overall]}
HQLA: ${hqlaTotal} млн TJS (после haircut: ${(hqlaTotal * 0.65).toFixed(1)} млн)
Survival Horizon: ${survivalHorizon === 999 ? '∞' : survivalHorizon + ' дней'}
Резервные источники: ${reserveTotal} млн TJS | Покрытие: ${reserveCoverage}%
Уровень готовности: ${readinessLevel} — ${rl.label}
Обязательства: МБК=${obInterbank} | Текущие=${obCurrent} | Накопит.=${obSavings} | Срочные=${obTerm} | Кред.линии=${obCreditLines} млн TJS

Разделы: 1.EWI-СТАТУС 2.SURVIVAL HORIZON 3.УРОВЕНЬ КРИЗИСНОЙ ГОТОВНОСТИ 4.ПОКРЫТИЕ РЕЗЕРВНЫМИ ИСТОЧНИКАМИ 5.ПЛАН ДЕЙСТВИЙ 6.НАРРАТИВ ДЛЯ КУАП
Без markdown, без конкретных дат.`

      const text = await aiGenerateText(prompt, 2000)
      return NextResponse.json({
        conclusion: text,
        survival_horizon: survivalHorizon,
        reserve_coverage: reserveCoverage,
        overall_status: overall,
        ewi: { n1: s_n1, lcr: s_lcr, outflow: s_out, top5: s_top5 },
      })
    }

  } catch (err) {
    console.error('CFP generate error:', err)
    return NextResponse.json({ error: 'Ошибка генерации CFP' }, { status: 500 })
  }
}

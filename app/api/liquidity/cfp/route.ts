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

      const prompt = `Ты эксперт по управлению ликвидностью ОАО «Алиф Банк» (Таджикистан) и специалист по нормативным требованиям НБТ.

Составь официальный документ «ПЛАН ФИНАНСИРОВАНИЯ НА СЛУЧАЙ ЧРЕЗВЫЧАЙНЫХ СИТУАЦИЙ (CFP)» строго в соответствии с требованиями Инструкции №247 НБТ РТ.

═══ ТЕКУЩИЕ НОРМАТИВНЫЕ ПОКАЗАТЕЛИ БАНКА ═══
Инструкция НБТ №176 — Нормативы достаточности капитала:
  CAR 1.1 = Кр / Ар × 100% = ${car11}% → ${EWI_EMOJI[s11]} ${normLabel(s11)} (НБТ норма: ≥ 12%)
  CAR 1.2 = Кр / А × 100%  = ${car12}% → ${EWI_EMOJI[s12]} ${normLabel(s12)} (НБТ норма: ≥ 10%)
  CAR 1.3 = Чок / Ар × 100% = ${car13}% → ${EWI_EMOJI[s13]} ${normLabel(s13)} (НБТ норма: ≥ 10%)
Инструкция НБТ №247 — Норматив ликвидности:
  К2-1 = ЛАТ / ОВТ × 100% = ${k21}% → ${EWI_EMOJI[sk21]} ${normLabel(sk21)} (НБТ норма: ≥ 30%)
Общий статус: ${overallComplianceLabel}

═══ СТРУКТУРА ОБЯЗАТЕЛЬСТВ (млн TJS) ═══
  Срочные депозиты физлиц: ${termDeposits} млн TJS
  Текущие счета: ${currentAccs} млн TJS
  МБК (межбанковские): ${interbank} млн TJS
  Прочие обязательства: ${other} млн TJS
  ИТОГО: ${totalLiab} млн TJS

═══ ЗАЯВЛЕННЫЕ ИСТОЧНИКИ ФИНАНСИРОВАНИЯ ═══
${sourcesBlock}
  ИТОГО ДОСТУПНО: ${totalFunding} млн TJS
${planPeriod ? `Период действия плана: ${planPeriod}` : ''}
${planDate    ? `Дата составления: ${planDate}` : ''}

═══ ТРЕБОВАНИЯ К ДОКУМЕНТУ ═══
Составь CFP строго по следующей структуре. Каждый раздел — полноценный профессиональный текст для официального документа банка, представляемого регулятору НБТ и Наблюдательному совету.

РАЗДЕЛ 1. ОЦЕНКА ТЕКУЩЕГО СОСТОЯНИЯ ЛИКВИДНОСТИ
Проанализируй все четыре норматива (CAR 1.1, 1.2, 1.3, К2-1). Для каждого: значение, сравнение с нормой НБТ, вывод о соответствии. Если есть нарушения — подчеркни критичность. Если нормативы соблюдены — оцени запас прочности. Завершить общим выводом о ликвидной позиции банка (3-4 предложения).

РАЗДЕЛ 2. ПОТЕНЦИАЛЬНЫЕ ИСТОЧНИКИ ФИНАНСИРОВАНИЯ И РАЗМЕР СРЕДСТВ
На основе заявленных источников банка, а также стандартного перечня согласно Инструкции №247 НБТ, изложи полный перечень источников финансирования:
— заявленные банком источники (из данных выше)
— дополнительные источники: взносы акционеров/субординированный долг, привлечение новых депозитов, пролонгация существующих обязательств, продажа/РЕПО высоколиквидных активов, заимствование у НБТ (рефинансирование), замедление темпов роста кредитного портфеля, приостановка выплаты дивидендов
Для каждого источника: потенциальный объём (оценочно), преимущества, ограничения.

РАЗДЕЛ 3. УСЛОВИЯ И СРОКИ АКТИВАЦИИ КАЖДОГО ИСТОЧНИКА
Опиши конкретные пороговые значения К2-1 и CAR, при которых активируется каждый источник финансирования. Указать: триггер (значение норматива), срок реагирования (часы/дни), ответственное подразделение, порядок активации. Используй формат: Источник → Триггер → Срок → Ответственный.

РАЗДЕЛ 4. ОТВЕТСТВЕННЫЕ ЛИЦА И ПОЛНОМОЧИЯ
Опиши роли и полномочия каждого органа в процессе активации CFP:
— КУАП (Комитет по управлению активами и пассивами): мониторинг, принятие решений по ликвидности
— Казначейство: оперативное управление ликвидной позицией, привлечение ресурсов
— СУР (Служба управления рисками): мониторинг EWI, оценка рисков, отчётность
— Правление банка: утверждение экстренных мер, коммуникация с НБТ
— Наблюдательный совет: надзор, утверждение стратегических решений при кризисе

РАЗДЕЛ 5. АЛГОРИТМ ДЕЙСТВИЙ
Пошаговый алгоритм активации CFP с указанием: шаг / ответственный / действие / срок выполнения. Минимум 8 шагов от момента выявления проблемы до стабилизации ситуации.

РАЗДЕЛ 6. ВРЕМЕННЫЕ ГОРИЗОНТЫ
Опиши план действий по трём горизонтам:
T+1 (первые 24 часа): экстренные меры, первоочередные действия
T+7 (первые 7 дней): краткосрочная стабилизация, ресурсные меры
T+30 (30 дней): среднесрочное восстановление, нормализация показателей

НЕ используй markdown-форматирование (никаких **, *, #, _).
НЕ указывай конкретные даты и числа там где они не указаны.
Используй профессиональный официальный стиль банковского документа на русском языке.`

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

import { NextResponse } from 'next/server'
import { aiGenerateText } from '@/lib/ai-provider'
import {
  ewiN1, ewiLcr, ewiOutflow, ewiTop5, overallEwi,
  calcSurvivalHorizon, calcReserveCoverage,
  EWI_EMOJI, EWI_LABEL, READINESS_LEVELS,
} from '@/lib/cfpCalculations'

export async function POST(req: Request) {
  try {
    const d = await req.json()

    const n1 = Number(d.n1) || 0
    const lcr = Number(d.lcr) || 0
    const outflow7d = Number(d.deposit_outflow_7d) || 0
    const top5 = Number(d.top5_share) || 0

    const hqlaL1 = Number(d.hqla_l1) || 0
    const hqlaL2a = Number(d.hqla_l2a) || 0
    const hqlaL2b = Number(d.hqla_l2b) || 0
    const hqlaTotal = hqlaL1 + hqlaL2a + hqlaL2b

    const obInterbank = Number(d.ob_interbank) || 0
    const obCurrent = Number(d.ob_current) || 0
    const obSavings = Number(d.ob_savings) || 0
    const obTerm = Number(d.ob_term) || 0
    const obCreditLines = Number(d.ob_credit_lines) || 0
    const totalObligations = obInterbank + obCurrent + obSavings + obTerm + obCreditLines
    const totalDeposits = obCurrent + obSavings + obTerm

    const reserveSources: { name: string; amount: number; status: string; access_term: string }[] = d.reserve_sources || []
    const reserveTotal = reserveSources.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const pessimisticOutflow = totalDeposits * (outflow7d / 100)

    const readinessLevel = Number(d.readiness_level) || 1

    const s_n1 = ewiN1(n1)
    const s_lcr = ewiLcr(lcr)
    const s_out = ewiOutflow(outflow7d)
    const s_top5 = ewiTop5(top5)
    const overall = overallEwi([s_n1, s_lcr, s_out, s_top5])

    const survivalHorizon = calcSurvivalHorizon(hqlaTotal, totalDeposits, outflow7d)
    const reserveCoverage = calcReserveCoverage(reserveTotal, pessimisticOutflow)

    const rl = READINESS_LEVELS[readinessLevel]

    const prompt = `Ты эксперт по управлению ликвидностью банка с опытом разработки CFP (Contingency Funding Plans) для центральноазиатских банков.

Составь профессиональное заключение по Плану финансирования на случай чрезвычайных ситуаций (CFP) банка Алиф Банк.

═══ EWI-ИНДИКАТОРЫ ═══
Н1 (норматив достаточности капитала): ${n1}% → ${EWI_EMOJI[s_n1]} ${EWI_LABEL[s_n1]} (порог: жёлтый <45%, красный <40%)
LCR (показатель краткосрочной ликвидности): ${lcr}% → ${EWI_EMOJI[s_lcr]} ${EWI_LABEL[s_lcr]} (порог: жёлтый <100%, красный <80%)
Отток депозитов 7 дней: ${outflow7d}% → ${EWI_EMOJI[s_out]} ${EWI_LABEL[s_out]} (порог: жёлтый >3%, красный >7%)
Доля топ-5 депозиторов: ${top5}% → ${EWI_EMOJI[s_top5]} ${EWI_LABEL[s_top5]} (порог: жёлтый >15%, красный >20%)
Общий EWI-статус: ${EWI_EMOJI[overall]} ${EWI_LABEL[overall]}

═══ HQLA (высококачественные ликвидные активы) ═══
Уровень 1 (L1 — безхарьютный): ${hqlaL1} млн TJS
Уровень 2A (L2A — haircut 15%): ${hqlaL2a} млн TJS
Уровень 2B (L2B — haircut 50%): ${hqlaL2b} млн TJS
Итого HQLA: ${hqlaTotal} млн TJS
HQLA после пессимистичного haircut 35%: ${(hqlaTotal * 0.65).toFixed(1)} млн TJS

═══ СТРУКТУРА ОБЯЗАТЕЛЬСТВ ═══
Межбанковские: ${obInterbank} млн TJS
Текущие счета: ${obCurrent} млн TJS
Накопительные/сберегательные: ${obSavings} млн TJS
Срочные депозиты: ${obTerm} млн TJS
Кредитные линии: ${obCreditLines} млн TJS
Итого обязательства: ${totalObligations} млн TJS

═══ РАСЧЁТЫ ═══
Пессимистичный отток (депозиты × ${outflow7d}%): ${pessimisticOutflow.toFixed(1)} млн TJS
Средне-дневной нетто-отток: ${(pessimisticOutflow / 7).toFixed(1)} млн TJS/день
Survival Horizon = ${(hqlaTotal * 0.65).toFixed(1)} / ${(pessimisticOutflow / 7).toFixed(1)} = ${survivalHorizon === 999 ? '∞' : survivalHorizon + ' дней'} (цель ≥ 30 дней)

═══ РЕЗЕРВНЫЕ ИСТОЧНИКИ ФОНДИРОВАНИЯ ═══
${reserveSources.length === 0 ? 'Не указаны' : reserveSources.map((r, i) => `${i + 1}. ${r.name} — ${r.amount} млн TJS | Статус: ${r.status} | Срок доступа: ${r.access_term}`).join('\n')}
Итого доступно: ${reserveTotal} млн TJS
Покрытие резервными источниками vs пессимистичный отток: ${reserveCoverage}%

═══ ТЕКУЩИЙ УРОВЕНЬ ГОТОВНОСТИ ═══
${rl.label}: ${rl.desc}

Напиши заключение строго по этой структуре (без дат, без markdown-форматирования **/*):

1. EWI-СТАТУС
Для каждого из 4 индикаторов: название, значение, статус (🟢/⚠️/🔴), краткий вывод 1 предложением.
Итоговый EWI-статус с обоснованием.

2. SURVIVAL HORIZON
Расчёт: ${survivalHorizon === 999 ? 'нет оттока (∞)' : survivalHorizon + ' дней'}.
Вывод: достаточно или недостаточно (цель ≥ 30 дней). 2-3 предложения.

3. УРОВЕНЬ КРИЗИСНОЙ ГОТОВНОСТИ
Текущий уровень: ${readinessLevel}. Подтверди или рекомендуй повышение. Обоснование.

4. ПОКРЫТИЕ РЕЗЕРВНЫМИ ИСТОЧНИКАМИ
Покрытие: ${reserveCoverage}%. Достаточно/недостаточно. Конкретные выводы по качеству резервных источников.

5. ПЛАН ДЕЙСТВИЙ
Конкретные шаги активации CFP для уровня ${readinessLevel}. Список из 5-7 пунктов с ответственными подразделениями.

6. НАРРАТИВ ДЛЯ КУАП
2-3 абзаца профессионального текста для представления на Комитете по управлению активами и пассивами.

НЕ используй markdown-форматирование (никаких **, *, #, _).
НЕ указывай конкретные даты.`

    const text = await aiGenerateText(prompt, 2000)

    return NextResponse.json({
      conclusion: text,
      survival_horizon: survivalHorizon,
      reserve_coverage: reserveCoverage,
      overall_status: overall,
      ewi: { n1: s_n1, lcr: s_lcr, outflow: s_out, top5: s_top5 },
    })
  } catch (err) {
    console.error('CFP generate error:', err)
    return NextResponse.json({ error: 'Ошибка генерации CFP' }, { status: 500 })
  }
}

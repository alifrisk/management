import { NextResponse } from 'next/server'
import { aiExtractFromImage, aiExtractFromPDFWithPrompt } from '@/lib/ai-provider'

export const dynamic = 'force-dynamic'

const CREDIT_PROMPT = `Ты финансовый аналитик. На скриншоте финансовая отчётность предприятия МСБ (баланс, ОПУ или движение денег).
Извлеки числа и верни ТОЛЬКО JSON без пояснений.

═══ КРИТИЧЕСКИЕ ПРАВИЛА — ПРОЧИТАЙ ДО ИЗВЛЕЧЕНИЯ ═══

1. ЧИСЛОВОЙ ФОРМАТ:
   - Числа могут быть: "1 234 567" или "1,234,567" или "1.234.567" — всегда возвращай ТОЛЬКО цифры: 1234567
   - Числа в скобках (1 234) или (1,234) — в финотчётности это отрицательные. Для РАСХОДОВ верни как ПОЛОЖИТЕЛЬНОЕ: 1234
   - Дробную часть УБИРАЙ: 1234.56 → 1235 (округляй)
   - Никаких пробелов, запятых, знаков валюты в числах

2. МАСШТАБ:
   - Если в шапке написано "в тысячах" / "тыс." — возвращай числа КАК НАПИСАНО, не умножай
   - Если "в миллионах" / "млн" — тоже как написано, не умножай
   - Пример: "в тысячах", видишь 5 234 → возвращай 5234 (НЕ 5234000)

3. ДВА ПЕРИОДА:
   - p1_ = более РАННИЙ (обычно левый столбец / предыдущий год)
   - p2_ = более ПОЗДНИЙ (правый столбец / отчётный период)
   - Если только один период — заполни p2_, оставь p1_ = 0

4. ЕСЛИ СТРОКА ОТСУТСТВУЕТ — ставь 0. Не придумывай числа.

5. МЕТКИ ПЕРИОДОВ:
   - p1_label / p2_label: дата периода если видна на скрине (напр. "31.12.2024" или "9 мес. 2024"), иначе ""

═══ МАППИНГ СТРОК ОТЧЁТА → JSON-ПОЛЯ ═══

ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ (ОПУ):
  Выручка / Объём продаж / Доход от реализации / Товарооборот                → p_revenue
  Себестоимость / Стоимость реализованных товаров / Покупная стоимость        → p_cogs         (ПОЛОЖИТЕЛЬНОЕ)
  Коммерческие / Торговые / Сбытовые расходы                                  → p_sales_expense (ПОЛОЖИТЕЛЬНОЕ)
  Управленческие / Административные / Общехозяйственные расходы               → p_admin_expense (ПОЛОЖИТЕЛЬНОЕ)
  Прочие операционные доходы / Прочие доходы от основной деятельности         → p_other_op_income
  Прочие доходы/расходы / Финансовые доходы/расходы / Внеоперационные         → p_non_op       (расходы → отрицательное)
  Налог на прибыль / КПН / Налог                                              → p_tax          (ПОЛОЖИТЕЛЬНОЕ)
  ПРИБЫЛЬ/УБЫТОК НЕ ЗАПОЛНЯТЬ — рассчитывается автоматически

БАЛАНС — АКТИВЫ:
  Денежные средства / Касса / Деньги в банке / Расчётные счета                → p_cash
  Дебиторская задолженность / Покупатели / Расчёты с покупателями              → p_receivables
  Товарно-материальные запасы / ТМЗ / Запасы / Товары                         → p_inventory
  Основные средства / ОС / Внеоборотные активы (или ОС + НМА суммарно)        → p_fixed_assets
  Прочие активы / Всё что не вошло выше / Незавершённое строительство          → p_other_assets

БАЛАНС — ПАССИВЫ (ОБЯЗАТЕЛЬСТВА):
  Кредиторская задолженность / Долги поставщикам / Торговая кредиторка        → p_supplier_debt
  Кредиты банков / Займы / Банковские ссуды / Заёмные средства                → p_bank_debt
  Прочие обязательства / Прочая кредиторка                                    → p_other_liabilities

БАЛАНС — КАПИТАЛ:
  Уставный капитал / Акционерный капитал / Вклады участников                  → p_equity_capital
  Резервный капитал / Добавочный капитал / Резервы                            → p_reserves
  Нераспределённая прибыль / Накопленный убыток                               → p_retained_earnings (убыток → отрицательное)

ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (ОДДС):
  Остаток на начало периода                                                    → p_cash_begin
  Поступления от продаж / Приток от операционной деятельности                 → p_op_inflow
  Выплаты поставщикам и персоналу / Отток от операционной деятельности        → p_op_outflow   (ПОЛОЖИТЕЛЬНОЕ)
  Получение кредитов / Поступления от финансовой деятельности                 → p_fin_inflow
  Погашение кредитов / Выплаты по финансовой деятельности                     → p_fin_outflow  (ПОЛОЖИТЕЛЬНОЕ)
  Поступления от продажи ОС / Приток инвестиционной деятельности              → p_inv_inflow
  Приобретение ОС / Отток инвестиционной деятельности                         → p_inv_outflow  (ПОЛОЖИТЕЛЬНОЕ)

Верни JSON строго этого формата (только цифры, без пробелов):
\`\`\`json
{
  "p1_label": "", "p2_label": "",
  "p1_revenue": 0, "p2_revenue": 0,
  "p1_cogs": 0, "p2_cogs": 0,
  "p1_sales_expense": 0, "p2_sales_expense": 0,
  "p1_admin_expense": 0, "p2_admin_expense": 0,
  "p1_other_op_income": 0, "p2_other_op_income": 0,
  "p1_non_op": 0, "p2_non_op": 0,
  "p1_tax": 0, "p2_tax": 0,
  "p1_cash": 0, "p2_cash": 0,
  "p1_receivables": 0, "p2_receivables": 0,
  "p1_inventory": 0, "p2_inventory": 0,
  "p1_fixed_assets": 0, "p2_fixed_assets": 0,
  "p1_other_assets": 0, "p2_other_assets": 0,
  "p1_supplier_debt": 0, "p2_supplier_debt": 0,
  "p1_bank_debt": 0, "p2_bank_debt": 0,
  "p1_other_liabilities": 0, "p2_other_liabilities": 0,
  "p1_equity_capital": 0, "p2_equity_capital": 0,
  "p1_reserves": 0, "p2_reserves": 0,
  "p1_retained_earnings": 0, "p2_retained_earnings": 0,
  "p1_cash_begin": 0, "p2_cash_begin": 0,
  "p1_op_inflow": 0, "p2_op_inflow": 0,
  "p1_op_outflow": 0, "p2_op_outflow": 0,
  "p1_fin_inflow": 0, "p2_fin_inflow": 0,
  "p1_fin_outflow": 0, "p2_fin_outflow": 0,
  "p1_inv_inflow": 0, "p2_inv_inflow": 0,
  "p1_inv_outflow": 0, "p2_inv_outflow": 0
}
\`\`\``

const FINANCIAL_PROMPT = `Ты эксперт по МСФО (IFRS). На скриншоте аудированная отчётность банка или финансовой компании по МСФО.
Извлеки числа и верни ТОЛЬКО JSON без пояснений.

═══ КРИТИЧЕСКИЕ ПРАВИЛА — ПРОЧИТАЙ ДО ИЗВЛЕЧЕНИЯ ═══

1. ЧИСЛОВОЙ ФОРМАТ:
   - Числа с пробелами "1 234 567", с запятыми "1,234,567" — возвращай ТОЛЬКО цифры: 1234567
   - Числа в скобках (1 234) или [1 234] — в МСФО это отрицательные/расходы. Для полей РАСХОДОВ возвращай ПОЛОЖИТЕЛЬНОЕ: 1234
   - Дробную часть УБИРАЙ: округляй до целых
   - Никаких пробелов или знаков в числах

2. МАСШТАБ:
   - Если "в тысячах сомони" / "TJS thousands" → возвращай как написано: видишь 5 234 → пиши 5234
   - Если "в миллионах" / "millions" → тоже как написано, не умножай
   - Масштаб УТОЧНИ из шапки таблицы, не угадывай

3. ДВА ПЕРИОДА:
   - p1_ = более РАННИЙ / предыдущий год (обычно правый столбец в МСФО!)
   - p2_ = более ПОЗДНИЙ / отчётный год (обычно левый столбец в МСФО!)
   - ВНИМАНИЕ: в МСФО-отчётах часто СНАЧАЛА идёт текущий год, потом предыдущий — читай даты!

4. ВАЛОВЫЕ КРЕДИТЫ:
   - p_gross_loans = ВАЛОВАЯ сумма кредитов ДО вычета резервов
   - p_ecl_reserve = резерв под обесценение (РППУ/ОКУ) — ВСЕГДА ПОЛОЖИТЕЛЬНОЕ
   - Если в таблице только "Чистые кредиты" (Net loans) = Gross − Reserve:
     → Ищи строку резерва отдельно; если нет — поставь чистые в p_gross_loans, p_ecl_reserve = 0

5. РАСХОДЫ — ВСЕГДА ПОЛОЖИТЕЛЬНЫЕ (даже если в скобках):
   p_int_expense, p_fee_expense, p_ecl_charge, p_personnel, p_depreciation, p_admin, p_other_expense, p_tax

6. p_net_profit: если прибыль — положительное, если убыток — отрицательное

═══ МАППИНГ СТАТЕЙ МСФО → JSON-ПОЛЯ ═══

БАЛАНС — АКТИВЫ:
  Денежные средства и их эквиваленты / Cash and equivalents / Касса + НБТ/ЦБ  → p_cash_cb
  Обязательные резервы / Ограниченные депозиты / Mandatory reserves            → p_restricted     (0 если нет)
  Средства в банках / МБК размещённые / Due from banks / Ностро               → p_due_banks
  Фин. инструменты по СС через ОПУ / FVTPL / Торговые ЦБ                     → p_fvtpl          (0 если нет)
  Фин. инструменты по СС через ПСД / FVOCI / AFS                              → p_fvoci          (0 если нет)
  Инвестиции по аморт. стоимости / HTM / ГЦБ / Held-to-maturity               → p_inv_ac
  Кредиты клиентам ВАЛОВЫЕ (до резервов) / Gross loans                        → p_gross_loans
  Резерв под обесценение / РППУ / ОКУ / ECL allowance                         → p_ecl_reserve    (ПОЛОЖИТЕЛЬНОЕ)
  Основные средства / PP&E / Здания + оборудование                            → p_ppe
  НМА + гудвил / Intangible assets                                            → p_intangibles    (0 если нет)
  Активы по праву пользования / ROU / МСФО 16                                 → p_rou            (0 если нет)
  Активы для продажи / Assets held for sale                                   → p_assets_held_sale (0 если нет)
  Прочие активы / Отложенные налоги / Прочая дебиторка                        → p_other_assets

БАЛАНС — ОБЯЗАТЕЛЬСТВА:
  Обязательства перед ЦБ / НБТ / Due to central bank                         → p_due_cb         (0 если нет)
  Средства банков / МБК привлечённые / Due to banks / Лоро                   → p_ibl
  Счета клиентов / Депозиты / Customer accounts / Вклады физлиц и юрлиц      → p_cust_dep
  Займы к оплате / Облигации / Loans payable / Debt securities issued          → p_debt_issued
  Субординированный долг / Subordinated debt                                  → p_subord         (0 если нет)
  Обязательства по аренде / Lease liabilities / МСФО 16                       → p_lease_liab     (0 если нет)
  Прочие обязательства / Резервы по гарантиям / Прочая кредиторка             → p_other_liab

БАЛАНС — КАПИТАЛ:
  Уставный / Акционерный капитал + Эмиссионный доход / Share capital          → p_share_cap
  Нераспределённая прибыль / Retained earnings                                → p_retained       (убыток → отрицательное)
  Прочие резервы + ПСД + Переоценка ОС / OCI reserves                        → p_oci_eq

ОПУ — ДОХОДЫ:
  Процентные доходы (всего) / Interest income                                 → p_int_income
  Процентные расходы (всего) / Interest expense                               → p_int_expense    (ПОЛОЖИТЕЛЬНОЕ)
  Комиссионные доходы / Fee and commission income                              → p_fee_income
  Комиссионные расходы / Fee and commission expense                            → p_fee_expense    (ПОЛОЖИТЕЛЬНОЕ)
  Торговый доход / Изменение СС FVTPL / Net trading income                    → p_trading
  Чистый доход от валютных операций / Net FX income / Курсовые разницы        → p_fx_income
  Прочие операционные доходы / Other income                                   → p_other_income

ОПУ — РАСХОДЫ:
  Формирование резерва под ОКУ / РППУ / ECL charge / Credit loss expense      → p_ecl_charge     (ПОЛОЖИТЕЛЬНОЕ)
  Расходы на персонал / Зарплата + бонусы / Staff expenses                    → p_personnel      (ПОЛОЖИТЕЛЬНОЕ)
  Амортизация ОС + НМА + ROU / Depreciation and amortization                 → p_depreciation   (ПОЛОЖИТЕЛЬНОЕ)
  Административные / Операционные расходы / Admin expenses                    → p_admin          (ПОЛОЖИТЕЛЬНОЕ)
  Прочие расходы / Other expenses                                              → p_other_expense  (ПОЛОЖИТЕЛЬНОЕ, 0 если нет)
  Налог на прибыль / Income tax                                               → p_tax            (ПОЛОЖИТЕЛЬНОЕ)
  Чистая прибыль / убыток / Net profit / loss                                 → p_net_profit
  Прочий совокупный доход (ПСД) / OCI                                         → p_oci

Верни JSON строго этого формата (только цифры):
\`\`\`json
{
  "p1_label": "", "p2_label": "",
  "p1_cash_cb": 0, "p2_cash_cb": 0,
  "p1_restricted": 0, "p2_restricted": 0,
  "p1_due_banks": 0, "p2_due_banks": 0,
  "p1_fvtpl": 0, "p2_fvtpl": 0,
  "p1_fvoci": 0, "p2_fvoci": 0,
  "p1_inv_ac": 0, "p2_inv_ac": 0,
  "p1_gross_loans": 0, "p2_gross_loans": 0,
  "p1_ecl_reserve": 0, "p2_ecl_reserve": 0,
  "p1_ppe": 0, "p2_ppe": 0,
  "p1_intangibles": 0, "p2_intangibles": 0,
  "p1_rou": 0, "p2_rou": 0,
  "p1_assets_held_sale": 0, "p2_assets_held_sale": 0,
  "p1_other_assets": 0, "p2_other_assets": 0,
  "p1_due_cb": 0, "p2_due_cb": 0,
  "p1_ibl": 0, "p2_ibl": 0,
  "p1_cust_dep": 0, "p2_cust_dep": 0,
  "p1_debt_issued": 0, "p2_debt_issued": 0,
  "p1_subord": 0, "p2_subord": 0,
  "p1_lease_liab": 0, "p2_lease_liab": 0,
  "p1_other_liab": 0, "p2_other_liab": 0,
  "p1_share_cap": 0, "p2_share_cap": 0,
  "p1_retained": 0, "p2_retained": 0,
  "p1_oci_eq": 0, "p2_oci_eq": 0,
  "p1_int_income": 0, "p2_int_income": 0,
  "p1_int_expense": 0, "p2_int_expense": 0,
  "p1_fee_income": 0, "p2_fee_income": 0,
  "p1_fee_expense": 0, "p2_fee_expense": 0,
  "p1_trading": 0, "p2_trading": 0,
  "p1_fx_income": 0, "p2_fx_income": 0,
  "p1_other_income": 0, "p2_other_income": 0,
  "p1_other_expense": 0, "p2_other_expense": 0,
  "p1_ecl_charge": 0, "p2_ecl_charge": 0,
  "p1_personnel": 0, "p2_personnel": 0,
  "p1_depreciation": 0, "p2_depreciation": 0,
  "p1_admin": 0, "p2_admin": 0,
  "p1_tax": 0, "p2_tax": 0,
  "p1_net_profit": 0, "p2_net_profit": 0,
  "p1_oci": 0, "p2_oci": 0
}
\`\`\``

// Sanitize a single extracted value to a clean integer
function sanitizeNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') {
    if (!isFinite(v) || isNaN(v)) return 0
    return Math.round(v)
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s || s === 'null' || s === 'undefined') return 0
    // Handle parentheses as negative: (1234) → -1234
    const isNeg = s.startsWith('(') && s.endsWith(')')
    // Strip everything except digits and decimal point
    const cleaned = s.replace(/[^0-9.]/g, '')
    if (!cleaned) return 0
    const num = parseFloat(cleaned)
    if (!isFinite(num) || isNaN(num)) return 0
    return Math.round(isNeg ? -num : num)
  }
  return 0
}

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, module } = await request.json()
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }

    const prompt = module === 'credit' ? CREDIT_PROMPT : FINANCIAL_PROMPT
    const isPDF = mimeType === 'application/pdf'
    const text = isPDF
      ? await aiExtractFromPDFWithPrompt(imageBase64, prompt, 4000)
      : await aiExtractFromImage(imageBase64, mimeType as 'image/jpeg' | 'image/png' | 'image/webp', prompt, 3000)

    // Extract JSON from response — try code block first, then bare object
    const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const jsonRaw = jsonBlock ? jsonBlock[1] : text.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonRaw) throw new Error('AI не вернул JSON структуру')

    const raw = JSON.parse(jsonRaw)

    // Sanitize all fields: labels stay as strings, numbers get cleaned
    const STRING_KEYS = new Set(['p1_label', 'p2_label'])
    const extracted: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (STRING_KEYS.has(k)) {
        extracted[k] = typeof v === 'string' ? v.trim() : ''
      } else {
        extracted[k] = sanitizeNum(v)
      }
    }

    return NextResponse.json({ data: extracted })
  } catch (err) {
    console.error('extract-from-image error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

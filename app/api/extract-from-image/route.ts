import { NextResponse } from 'next/server'
import { aiExtractFromImage } from '@/lib/ai-provider'

export const dynamic = 'force-dynamic'

const CREDIT_PROMPT = `Ты финансовый аналитик. На скриншоте финансовая отчётность предприятия (баланс, ОПУ, кеш-флоу).
Извлеки все числовые данные и верни ТОЛЬКО JSON без объяснений.

Правила:
- Если видишь два периода — p1_ это более ранний, p2_ более поздний
- Если число не найдено — ставь 0
- Все суммы только цифры без пробелов, запятых и знаков валюты
- Для p1_label и p2_label укажи название периода если видно на скрине (например "31.12.2024"), иначе ""

Верни JSON строго такого формата:
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

const FINANCIAL_PROMPT = `Ты эксперт по МСФО (IFRS). На скриншоте аудированная финансовая отчётность банка или финансовой компании, составленная по стандартам МСФО.
Извлеки все числовые данные и верни ТОЛЬКО JSON без объяснений.

ПРАВИЛА:
- Два периода: p1_ = более ранний (левый столбец), p2_ = более поздний (правый столбец)
- Если число не найдено — ставь 0
- Все суммы: только целые цифры без пробелов, запятых, знаков валюты (в тысячах)
- p1_label / p2_label: название периода если видно (напр. "31.12.2024"), иначе ""
- ECL резервы (p_ecl_reserve): ПОЛОЖИТЕЛЬНОЕ число (не отрицательное)
- Все расходы: ПОЛОЖИТЕЛЬНЫЕ числа
- Балансовое равенство: Активы = Обязательства + Капитал. Остаток — в p_other_assets или p_other_liab

СООТВЕТСТВИЕ ПОЛЕЙ МСФО-СТАТЬЯМ:

━━ БАЛАНС / ОТЧЁТ О ФИНАНСОВОМ ПОЛОЖЕНИИ ━━

АКТИВЫ:
  p_cash_cb          = Денежные средства и их эквиваленты (Cash and equivalents, including cash at vault and free NBT accounts)
  p_restricted       = Средства с ограниченным доступом (Restricted deposits / mandatory reserves at NBT / CBs). Если не выделено отдельной строкой — ставь 0.
  p_due_banks        = Средства в банках, МБК размещённые, ностро-счета (Due from banks / Interbank placements)
  p_fvtpl            = Фин. инструменты по СС через ОПУ, торговые ЦБ (FVTPL / Trading securities)
  p_fvoci            = Фин. инструменты по СС через ПСД, AFS (FVOCI / Available-for-sale). Если одна строка «Финансовые инструменты по СС» — всё сюда.
  p_inv_ac           = Инвестиции по амортизир. стоимости, HTM, ГЦБ (Amortized cost / HTM / Government bonds held to maturity)
  p_gross_loans      = Кредиты клиентам ВАЛОВЫЕ, до резервов (Gross loans to customers)
  p_ecl_reserve      = Резерв под ОКУ / РППУ / обесценение — ПОЛОЖИТЕЛЬНОЕ число (ECL allowance)
  p_ppe              = Основные средства (PP&E: здания, оборудование, транспорт)
  p_intangibles      = НМА + гудвил (Intangible assets + goodwill + software)
  p_rou              = Активы в форме права пользования МСФО 16 (ROU assets IFRS 16)
  p_assets_held_sale = Долгосрочные активы, предназначенные для продажи (Assets held for sale). Если нет — 0.
  p_other_assets     = ВСЕ ОСТАЛЬНЫЕ активы (отлож. налоги, прочая дебиторка). Разницу до итога — сюда.

ОБЯЗАТЕЛЬСТВА:
  p_due_cb       = Обязательства перед ЦБ / НБТ (Due to central bank)
  p_ibl          = Средства банков и финансовых организаций, МБК привлечённые (Due to banks / Interbank borrowings)
  p_cust_dep     = Счета клиентов, депозиты физлиц и юрлиц (Customer accounts / deposits)
  p_debt_issued  = Займы к оплате, выпущенные облигации (Loans payable / Debt securities issued). Если одна строка «Займы и облигации к оплате» — всё сюда.
  p_subord       = Субординированный долг (Subordinated debt). Если нет отдельной строки — 0.
  p_lease_liab   = Обязательства по аренде МСФО 16 (Lease liabilities IFRS 16)
  p_other_liab   = Прочие обязательства (резервы по гарантиям, кред. убытки по обязательствам, прочее). Разницу до итога — сюда.

КАПИТАЛ:
  p_share_cap    = Акционерный/уставный капитал + эмиссионный доход (Share capital + share premium)
  p_retained     = Нераспределённая прибыль (Retained earnings)
  p_oci_eq       = Прочие резервы + ПСД + резерв переоценки ОС + фонды (OCI reserves + revaluation + other funds)

━━ ОПУ / ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ ━━

  p_int_income   = Итого процентные доходы (Interest income: loans + placements + investments)
  p_int_expense  = Итого процентные расходы (Interest expense: deposits + borrowings + lease)
  p_fee_income   = Комиссионные доходы (Fee and commission income)
  p_fee_expense  = Комиссионные расходы (Fee and commission expense)
  p_trading      = Торговый доход / изменение СС фин. инструментов (Net trading / FV gains-losses on FVTPL)
  p_fx_income    = Чистый доход от операций с иностранной валютой (Net FX / currency income). Если объединено с торговым — всё в p_fx_income.
  p_other_income = Прочие доходы / операционные доходы (Other income)
  p_ecl_charge   = Формирование резерва под ОКУ / РППУ (ECL charge / credit loss expense) — ПОЛОЖИТЕЛЬНОЕ число
  p_personnel    = Расходы на персонал, зарплата, бонусы (Personnel / staff expenses)
  p_depreciation = Амортизация ОС, НМА, активов ПП-МСФО16 (Depreciation and amortization)
  p_admin        = Административные расходы (Admin and operating expenses)
  p_other_expense= Прочие расходы (Other expenses). Если нет отдельной строки — 0.
  p_tax          = Расход по налогу на прибыль (Income tax expense)
  p_net_profit   = Чистая прибыль / убыток (Net profit / loss)
  p_oci          = Прочий совокупный доход ПСД (OCI: revaluation, FVOCI changes, FX translation)

Верни JSON строго такого формата:
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

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, module } = await request.json()
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Изображение не передано' }, { status: 400 })
    }

    const prompt = module === 'credit' ? CREDIT_PROMPT : FINANCIAL_PROMPT
    const text = await aiExtractFromImage(
      imageBase64,
      mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
      prompt,
      3000
    )

    // Extract JSON block from response
    const jsonBlock = text.match(/```json\n?([\s\S]*?)\n?```/)
    const jsonRaw = jsonBlock ? jsonBlock[1] : text.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonRaw) throw new Error('AI не вернул JSON структуру')

    const extracted = JSON.parse(jsonRaw)
    return NextResponse.json({ data: extracted })
  } catch (err) {
    console.error('extract-from-image error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

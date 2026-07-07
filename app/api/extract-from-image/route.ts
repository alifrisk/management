import { NextResponse } from 'next/server'
import { aiExtractFromImage, aiExtractFromPDFWithPrompt } from '@/lib/ai-provider'

export const dynamic = 'force-dynamic'

const CREDIT_PROMPT = `Ты финансовый аналитик. На скриншоте финансовая отчётность предприятия МСБ по шаблону Минфина РТ Приказ №42 (баланс Форма №1, ОПУ Форма №2, или ОДДС Форма №5).
Извлеки числа и верни ТОЛЬКО JSON без пояснений.

═══ КРИТИЧЕСКИЕ ПРАВИЛА — ПРОЧИТАЙ ДО ИЗВЛЕЧЕНИЯ ═══

1. ЧИСЛОВОЙ ФОРМАТ И ЗНАК:
   - Числа могут быть: "1 234 567" или "1,234,567" или "1.234.567" — возвращай ТОЛЬКО цифры: 1234567
   - Дробную часть УБИРАЙ: 1234.56 → 1235 (округляй)
   - Числа в скобках (1 234) = ОТРИЦАТЕЛЬНЫЕ в финотчётности
   - В JSON отрицательные числа пиши со знаком минус: -1234 (НЕ в скобках)
   - ЗНАК определяется маппингом для каждого поля:
     → поля с меткой (ПОЛОЖИТЕЛЬНОЕ) — всегда абсолютное число, минус НЕ ставить
     → поля с меткой (расходы → отрицательное) — ставь -1234 если число в скобках
     → поля с меткой (убыток → отрицательное) — ставь -1234 если убыток/скобки
     → поля без метки — как в отчёте (обычно положительные)

2. МАСШТАБ:
   - Если в шапке написано "в тысячах" / "тыс." — возвращай числа КАК НАПИСАНО, не умножай
   - Если "в миллионах" / "млн" — тоже как написано, не умножай

3. ДВА ПЕРИОДА:
   - p1_ = более РАННИЙ (обычно левый столбец / предыдущий год)
   - p2_ = более ПОЗДНИЙ (правый столбец / отчётный период)
   - Если только один период — заполни p2_, оставь p1_ = 0

4. ЕСЛИ СТРОКА ОТСУТСТВУЕТ — ставь 0. Не придумывай числа.

5. МЕТКИ ПЕРИОДОВ:
   - p1_label / p2_label: дата периода если видна (напр. "31.12.2024"), иначе ""

═══ МАППИНГ — БАЛАНС ФОРМА №1 ═══

КРАТКОСРОЧНЫЕ АКТИВЫ:
  Денежные средства в кассе (10100)                                    → p_cash_desk
  Денежные средства в банках / на р/с (10200)                          → p_cash_bank
  Краткосрочные инвестиции / ценные бумаги (10300)                     → p_st_invest
  Торговая дебиторская задолженность / покупатели (10400)              → p_trade_rec
  Прочая дебиторская задолженность (10500)                             → p_other_rec
  Задолженность учредителей (10600)                                    → p_founder_rec
  ТМЗ / товарно-материальные запасы / товары / сырьё (10700)           → p_inventory
  Расходы будущих периодов (10800)                                     → p_prepaid
  Долгосрочные активы, предназначенные для продажи (10900)             → p_nca_sale

ДОЛГОСРОЧНЫЕ АКТИВЫ:
  Основные средства / ОС (11000)                                       → p_ppe
  Природные ресурсы (11200)                                            → p_nat_res
  Нематериальные активы / НМА (11300)                                  → p_intangibles
  Биологические активы (11400)                                         → p_bio_assets
  Инвестиционное имущество / инвестиции в недвижимость (11500)         → p_invest_prop
  Долгосрочные инвестиции (11600)                                      → p_lt_invest
  Отложенные налоговые активы (11700)                                  → p_def_tax_asset
  Долгосрочная дебиторская задолженность (11800)                       → p_lt_rec

КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА:
  Торговая кредиторская задолженность / долги поставщикам (22000)      → p_trade_pay
  Краткосрочные кредиты / займы / банковский долг (22100)              → p_st_debt
  Начисленные краткосрочные обязательства / зарплата к уплате (22200)  → p_accrued
  Налоговые обязательства / налоги к уплате (22300)                    → p_taxes_pay
  Резервы на расходы и отпускные (22400)                               → p_exp_reserves
  Прочие краткосрочные обязательства (22500)                           → p_other_st_liab

ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА:
  Долгосрочные кредиты / займы (22600)                                 → p_lt_debt
  Доходы будущих периодов (22700)                                      → p_def_income
  Отложенные налоговые обязательства (22800)                           → p_def_tax_liab

СОБСТВЕННЫЙ КАПИТАЛ:
  Уставный / акционерный капитал (33000)                               → p_charter_cap
  Дополнительный / добавочный капитал (33100)                          → p_add_cap
  Нераспределённая прибыль / накопленный убыток (33200)                → p_retained (убыток → отрицательное)
  Резервный капитал (33300)                                            → p_reserve_cap
  Доля меньшинства (33400)                                             → p_minority

═══ МАППИНГ — ОПУ ФОРМА №2 ═══
  Чистый доход от продаж / Выручка (010)                               → p_net_rev
  Себестоимость продаж (020)                                           → p_cogs         (ПОЛОЖИТЕЛЬНОЕ)
  Расходы на продажу / коммерческие / сбытовые (040)                   → p_sell_exp     (ПОЛОЖИТЕЛЬНОЕ)
  Административные / управленческие расходы (050)                      → p_admin_exp    (ПОЛОЖИТЕЛЬНОЕ)
  Прочие операционные доходы/(расходы) (070)                           → p_other_op     (расходы → отрицательное)
  Доходы/(расходы) по процентам / финансовые расходы (100)             → p_interest_exp (расходы → отрицательное)
  Доходы/(убыток) от инвестиций (110)                                  → p_invest_inc
  Доходы/(убыток) от курсовых разниц (120)                             → p_fx_diff
  Доходы/(убыток) от обмена валюты (130)                               → p_currency_ex
  Доходы/(убыток) от выбытия долгосрочных активов (140)               → p_asset_disp
  Убыток от обесценения (150)                                          → p_impairment   (ПОЛОЖИТЕЛЬНОЕ)
  Прочие неоперационные доходы/(расходы) (160)                         → p_other_nonop
  Доля прибыли ассоциированных компаний (180)                          → p_assoc_profit
  Налог на прибыль (200)                                               → p_tax          (ПОЛОЖИТЕЛЬНОЕ)
  Прибыль/(убыток) от прекращённой деятельности (220)                  → p_discont
  ИТОГИ — НЕ ЗАПОЛНЯТЬ (считаются автоматически)

═══ МАППИНГ — ОДДС ФОРМА №5 (прямой метод) ═══

ОПЕРАЦИОННАЯ ДЕЯТЕЛЬНОСТЬ — ПОСТУПЛЕНИЯ:
  Поступления от продаж / от покупателей (010)                         → p_cf_sales
  Прочие операционные поступления (020)                                → p_cf_other_op_in

ОПЕРАЦИОННАЯ ДЕЯТЕЛЬНОСТЬ — ВЫПЛАТЫ:
  Оплата себестоимости / поставщикам за товары (050)                   → p_cf_cogs_paid     (ПОЛОЖИТЕЛЬНОЕ)
  Оплата труда и соц. отчислений (060)                                 → p_cf_salary        (ПОЛОЖИТЕЛЬНОЕ)
  Оплата прочих услуг / аренда / комм. расходы (070)                   → p_cf_services      (ПОЛОЖИТЕЛЬНОЕ)
  Выплата процентов по кредитам (080)                                  → p_cf_interest      (ПОЛОЖИТЕЛЬНОЕ)
  Уплата налога на прибыль (090)                                       → p_cf_income_tax    (ПОЛОЖИТЕЛЬНОЕ)
  Уплата прочих налогов (100)                                          → p_cf_other_taxes   (ПОЛОЖИТЕЛЬНОЕ)
  Прочие операционные выплаты (110)                                    → p_cf_other_op_out  (ПОЛОЖИТЕЛЬНОЕ)

ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ — ПОСТУПЛЕНИЯ:
  Продажа / выбытие ОС и недвижимости (210)                            → p_cf_asset_sold
  Продажа нематериальных активов (220)                                 → p_cf_intang_sold
  Продажа ценных бумаг (230)                                           → p_cf_sec_sold
  Возврат займов / погашение выданных займов (240)                     → p_cf_loan_ret
  Прочие инвест. поступления (250)                                     → p_cf_other_inv_in

ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ — ВЫПЛАТЫ:
  Приобретение ОС и недвижимости (270)                                 → p_cf_asset_buy     (ПОЛОЖИТЕЛЬНОЕ)
  Приобретение НМА (280)                                               → p_cf_intang_buy    (ПОЛОЖИТЕЛЬНОЕ)
  Приобретение ценных бумаг (290)                                      → p_cf_sec_buy       (ПОЛОЖИТЕЛЬНОЕ)
  Предоставление займов / выданные займы (300)                         → p_cf_loans_given   (ПОЛОЖИТЕЛЬНОЕ)
  Прочие инвест. выплаты (310)                                         → p_cf_other_inv_out (ПОЛОЖИТЕЛЬНОЕ)

ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ — ПОСТУПЛЕНИЯ:
  Эмиссия акций (410)                                                  → p_cf_shares
  Эмиссия облигаций (420)                                              → p_cf_bonds
  Вклады учредителей (430)                                             → p_cf_founders
  Полученные займы и кредиты (440)                                     → p_cf_loans_in
  Прочие фин. поступления (450)                                        → p_cf_other_fin_in

ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ — ВЫПЛАТЫ:
  Выплата дивидендов (470)                                             → p_cf_dividends     (ПОЛОЖИТЕЛЬНОЕ)
  Погашение займов и кредитов (480)                                    → p_cf_loans_out     (ПОЛОЖИТЕЛЬНОЕ)
  Выкуп собственных акций (490)                                        → p_cf_buyback       (ПОЛОЖИТЕЛЬНОЕ)
  Прочие фин. выплаты (500)                                            → p_cf_other_fin_out (ПОЛОЖИТЕЛЬНОЕ)

ПРОЧЕЕ:
  Влияние курсовых разниц на денежные средства (600)                   → p_cf_fx
  Остаток денежных средств на начало периода                           → p_cf_cash_begin

Верни JSON строго этого формата (только цифры, без пробелов):
\`\`\`json
{
  "p1_label": "", "p2_label": "",
  "p1_cash_desk": 0, "p2_cash_desk": 0,
  "p1_cash_bank": 0, "p2_cash_bank": 0,
  "p1_st_invest": 0, "p2_st_invest": 0,
  "p1_trade_rec": 0, "p2_trade_rec": 0,
  "p1_other_rec": 0, "p2_other_rec": 0,
  "p1_founder_rec": 0, "p2_founder_rec": 0,
  "p1_inventory": 0, "p2_inventory": 0,
  "p1_prepaid": 0, "p2_prepaid": 0,
  "p1_nca_sale": 0, "p2_nca_sale": 0,
  "p1_ppe": 0, "p2_ppe": 0,
  "p1_nat_res": 0, "p2_nat_res": 0,
  "p1_intangibles": 0, "p2_intangibles": 0,
  "p1_bio_assets": 0, "p2_bio_assets": 0,
  "p1_invest_prop": 0, "p2_invest_prop": 0,
  "p1_lt_invest": 0, "p2_lt_invest": 0,
  "p1_def_tax_asset": 0, "p2_def_tax_asset": 0,
  "p1_lt_rec": 0, "p2_lt_rec": 0,
  "p1_trade_pay": 0, "p2_trade_pay": 0,
  "p1_st_debt": 0, "p2_st_debt": 0,
  "p1_accrued": 0, "p2_accrued": 0,
  "p1_taxes_pay": 0, "p2_taxes_pay": 0,
  "p1_exp_reserves": 0, "p2_exp_reserves": 0,
  "p1_other_st_liab": 0, "p2_other_st_liab": 0,
  "p1_lt_debt": 0, "p2_lt_debt": 0,
  "p1_def_income": 0, "p2_def_income": 0,
  "p1_def_tax_liab": 0, "p2_def_tax_liab": 0,
  "p1_charter_cap": 0, "p2_charter_cap": 0,
  "p1_add_cap": 0, "p2_add_cap": 0,
  "p1_retained": 0, "p2_retained": 0,
  "p1_reserve_cap": 0, "p2_reserve_cap": 0,
  "p1_minority": 0, "p2_minority": 0,
  "p1_net_rev": 0, "p2_net_rev": 0,
  "p1_cogs": 0, "p2_cogs": 0,
  "p1_sell_exp": 0, "p2_sell_exp": 0,
  "p1_admin_exp": 0, "p2_admin_exp": 0,
  "p1_other_op": 0, "p2_other_op": 0,
  "p1_interest_exp": 0, "p2_interest_exp": 0,
  "p1_invest_inc": 0, "p2_invest_inc": 0,
  "p1_fx_diff": 0, "p2_fx_diff": 0,
  "p1_currency_ex": 0, "p2_currency_ex": 0,
  "p1_asset_disp": 0, "p2_asset_disp": 0,
  "p1_impairment": 0, "p2_impairment": 0,
  "p1_other_nonop": 0, "p2_other_nonop": 0,
  "p1_assoc_profit": 0, "p2_assoc_profit": 0,
  "p1_tax": 0, "p2_tax": 0,
  "p1_discont": 0, "p2_discont": 0,
  "p1_cf_sales": 0, "p2_cf_sales": 0,
  "p1_cf_other_op_in": 0, "p2_cf_other_op_in": 0,
  "p1_cf_cogs_paid": 0, "p2_cf_cogs_paid": 0,
  "p1_cf_salary": 0, "p2_cf_salary": 0,
  "p1_cf_services": 0, "p2_cf_services": 0,
  "p1_cf_interest": 0, "p2_cf_interest": 0,
  "p1_cf_income_tax": 0, "p2_cf_income_tax": 0,
  "p1_cf_other_taxes": 0, "p2_cf_other_taxes": 0,
  "p1_cf_other_op_out": 0, "p2_cf_other_op_out": 0,
  "p1_cf_asset_sold": 0, "p2_cf_asset_sold": 0,
  "p1_cf_intang_sold": 0, "p2_cf_intang_sold": 0,
  "p1_cf_sec_sold": 0, "p2_cf_sec_sold": 0,
  "p1_cf_loan_ret": 0, "p2_cf_loan_ret": 0,
  "p1_cf_other_inv_in": 0, "p2_cf_other_inv_in": 0,
  "p1_cf_asset_buy": 0, "p2_cf_asset_buy": 0,
  "p1_cf_intang_buy": 0, "p2_cf_intang_buy": 0,
  "p1_cf_sec_buy": 0, "p2_cf_sec_buy": 0,
  "p1_cf_loans_given": 0, "p2_cf_loans_given": 0,
  "p1_cf_other_inv_out": 0, "p2_cf_other_inv_out": 0,
  "p1_cf_shares": 0, "p2_cf_shares": 0,
  "p1_cf_bonds": 0, "p2_cf_bonds": 0,
  "p1_cf_founders": 0, "p2_cf_founders": 0,
  "p1_cf_loans_in": 0, "p2_cf_loans_in": 0,
  "p1_cf_other_fin_in": 0, "p2_cf_other_fin_in": 0,
  "p1_cf_dividends": 0, "p2_cf_dividends": 0,
  "p1_cf_loans_out": 0, "p2_cf_loans_out": 0,
  "p1_cf_buyback": 0, "p2_cf_buyback": 0,
  "p1_cf_other_fin_out": 0, "p2_cf_other_fin_out": 0,
  "p1_cf_fx": 0, "p2_cf_fx": 0,
  "p1_cf_cash_begin": 0, "p2_cf_cash_begin": 0
}
\`\`\``

const FINANCIAL_PROMPT = `Ты эксперт по МСФО (IFRS). На скриншоте аудированная отчётность банка или финансовой компании по МСФО.
Извлеки числа и верни ТОЛЬКО JSON без пояснений.

═══ КРИТИЧЕСКИЕ ПРАВИЛА — ПРОЧИТАЙ ДО ИЗВЛЕЧЕНИЯ ═══

1. ЧИСЛОВОЙ ФОРМАТ И ЗНАК:
   - Числа с пробелами "1 234 567", с запятыми "1,234,567" — возвращай ТОЛЬКО цифры: 1234567
   - Дробную часть УБИРАЙ: округляй до целых
   - Числа в скобках (1 234) или [1 234] = ОТРИЦАТЕЛЬНЫЕ в МСФО
   - В JSON отрицательные числа пиши со знаком минус: -1234 (НЕ в скобках)
   - ЗНАК по правилу: поля из Правила 5 (расходы) — ВСЕГДА положительное, минус НЕ ставить
   - Все остальные поля — как в отчёте (если в скобках → ставь минус в JSON)

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

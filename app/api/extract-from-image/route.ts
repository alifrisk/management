import { NextResponse } from 'next/server'
import { aiExtractFromImage } from '@/lib/ai-provider'
import { requireAuth } from '@/lib/auth-check'

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

const FINANCIAL_PROMPT = `Ты финансовый аналитик. На скриншоте финансовая отчётность банка или финансовой компании.
Извлеки все числовые данные и верни ТОЛЬКО JSON без объяснений.

Правила:
- Если видишь два периода — p1_ это более ранний, p2_ более поздний
- Если число не найдено — ставь 0
- Все суммы только цифры без пробелов, запятых и знаков валюты (в тысячах)
- Для p1_label и p2_label укажи название периода если видно на скрине, иначе ""

Верни JSON строго такого формата:
\`\`\`json
{
  "p1_label": "", "p2_label": "",
  "p1_cash": 0, "p2_cash": 0,
  "p1_receivables": 0, "p2_receivables": 0,
  "p1_investments": 0, "p2_investments": 0,
  "p1_loans_issued": 0, "p2_loans_issued": 0,
  "p1_fixed_assets": 0, "p2_fixed_assets": 0,
  "p1_other_assets": 0, "p2_other_assets": 0,
  "p1_deposits": 0, "p2_deposits": 0,
  "p1_borrowings": 0, "p2_borrowings": 0,
  "p1_other_liab": 0, "p2_other_liab": 0,
  "p1_equity": 0, "p2_equity": 0,
  "p1_interest_income": 0, "p2_interest_income": 0,
  "p1_interest_expense": 0, "p2_interest_expense": 0,
  "p1_fee_income": 0, "p2_fee_income": 0,
  "p1_fx_income": 0, "p2_fx_income": 0,
  "p1_other_income": 0, "p2_other_income": 0,
  "p1_operating_expense": 0, "p2_operating_expense": 0,
  "p1_provisions": 0, "p2_provisions": 0,
  "p1_net_profit": 0, "p2_net_profit": 0
}
\`\`\``

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

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

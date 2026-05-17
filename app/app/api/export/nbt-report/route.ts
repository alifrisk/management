import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { incident } = await request.json()
    const incidentDate = incident.incident_date 
      ? new Date(incident.incident_date).toLocaleDateString('ru-RU') 
      : '—'
    const lossFormatted = incident.loss_amount_tjs 
      ? new Intl.NumberFormat('ru-RU').format(incident.loss_amount_tjs) 
      : '—'
    const recoveryFormatted = incident.recovery_amount 
      ? new Intl.NumberFormat('ru-RU').format(incident.recovery_amount) 
      : '—'

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body{font-family:'Times New Roman',serif;font-size:12pt;margin:2cm;line-height:1.5}
.right{text-align:right;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:15px;font-size:9pt}
th,td{border:1px solid #000;padding:4px 5px;text-align:center;vertical-align:middle}
th{background:#f5f5f5;font-weight:bold}
td.left{text-align:left}
.center{text-align:center;font-weight:bold;margin:10px 0}
</style>
</head>
<body>
<div class="right"><strong>Ба Бонки миллии Тоҷикистон</strong></div>
<p style="text-align:justify">ҶСК «Алиф Бонк» (минбаъд дар матн - "Бонк") ба Шумо эҳтироми худро баён намуда, ҳисоботи умумии мониторинги хавфи амалиётиро оид ба ҳодисаҳои дорои хавфи амалиётии моддӣ, ки боиси зарар дар ҳаҷми 5 000 сомонӣ ва зиёда аз он оварда расонидаанд, мувофиқи банди 54-и Дастурамали №240 Бонки миллии Тоҷикистон барои санаи ҷорӣ пешниҳод менамояд.</p>
<p>Замимаи №1 дар ҳаҷми 1 варақ</p>
<p>Бо эҳтиром,</p>
<table style="border:none;width:100%">
<tr style="border:none"><td style="border:none">Раиси Бонк</td><td style="border:none;text-align:right">Атобек Гуланор</td></tr>
</table>
<p>Иҷрокунанда: _______________<br>Тел.: _______________</p>
<div style="page-break-before:always">
<div class="center">Замима</div>
<div class="center">Ҳисобот оид ба ҳодисаҳои хавфҳои амалиётӣ,<br>ки ба зарар дар ҳаҷми 5000 сомонӣ ва зиёда аз он оварда расонидаанд<br>дар ҶСК "Алиф Бонк" барои "${incidentDate}"</div>
<table>
<thead>
<tr><th rowspan="2">№</th><th rowspan="2">Муҳтавои ҳодисаҳои хавфи амалиётӣ (сабабҳои зарар)</th><th rowspan="2">Ҷойе</th><th rowspan="2">Санаи ҳодиса</th><th colspan="8">Шакл ва ҳаҷми пайомадҳо (бо сомонӣ)</th><th rowspan="2">Маблағҳои барқароршуда</th></tr>
<tr><th>Ҷаримаҳо</th><th>Хароҷоти судӣ</th><th>Ҷуброни кормандон</th><th>Ҷуброни муштариён</th><th>Дороиҳо</th><th>Хароҷоти бартараф</th><th>Зарарҳои дигар</th><th>Коҳиши арзиш</th></tr>
<tr><th>р/т</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th></tr>
</thead>
<tbody>
<tr>
<td>1</td>
<td class="left">${incident.case_description || incident.disclosure || incident.cause || '—'}</td>
<td>${incident.department || '—'}</td>
<td>${incidentDate}</td>
<td>${lossFormatted}</td>
<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
<td>${recoveryFormatted}</td>
</tr>
<tr>
<td colspan="3"><strong>Ҳамагӣ</strong></td>
<td></td>
<td><strong>${lossFormatted}</strong></td>
<td></td><td></td><td></td><td></td><td></td><td></td>
<td><strong>${recoveryFormatted}</strong></td>
</tr>
</tbody>
</table>
</div>
</body>
</html>`

    return NextResponse.json({ html, filename: `NBT_OR_${incident.incident_number}_${new Date().toISOString().split('T')[0]}` })
  } catch {
    return NextResponse.json({ error: 'Ошибка генерации отчёта' }, { status: 500 })
  }
}

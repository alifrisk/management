'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Search, Filter, Download, Eye, Edit2, Trash2, Bell, X, CheckCircle2, Clock, AlertCircle, FileWarning, ShieldAlert, BellRing } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { BUSINESS_PROCESSES, RISK_FACTORS, SYSTEMS, DEPARTMENTS, INCIDENT_STATUSES, EVENT_CATEGORIES_L1, EVENT_CATEGORIES_L2, CURRENCIES, PROBABILITY_SCORES, IMPACT_SCORES, CONTROL_SCORES, INCIDENT_FREQUENCIES, CLIENT_WORK_STATUSES } from '@/lib/constants'

interface Incident {
  id: string
  incident_number: number
  event_category_l1: string
  event_category_l2: string
  event_category_l3: string
  business_process: string
  case_description: string
  repeat_count: number
  system: string
  cause: string
  factor: string
  frequency: string
  employee_involved: string
  incident_location: string
  department: string
  discovered_by: string
  disclosure: string
  discovery_date: string
  incident_date: string
  loss_amount: number
  currency: string
  loss_amount_tjs: number
  recovery_amount: number
  remainder: number
  recovery_rate: number
  incident_status: string
  client_work_status: string
  system_link: string
  transaction_count: number
  probability: number
  impact: number
  control_quality: number
  probability_score: number
  impact_score: number
  risk_level: string
  plans: string
  actual_execution: string
  control_status: string
  responsible: string
  source: string
  created_at: string
}

interface IncidentForm {
  id: string
  discovered_by: string
  business_process: string
  factor: string
  cause: string
  system: string
  discovery_date: string
  incident_date: string
  loss_amount: number
  recovery_amount: number
  disclosure: string
  department: string
  submitted_by: string
  status: string
  created_at: string
}

const EVENT_CATEGORIES_L3_MAP: Record<string, string[]> = {
  'Воровство и мошенничество': ['Мошенничество, кредитное мошенничество / кража денег со счетов','Грубое нарушение внутренних Политик и Процедур Банка','Воровство, вымогательство, хищения, грабеж','Присвоение активов (погашения клиентов, выданных кредитов, вкладов клиентов)','Умышленное уничтожение активов','Подделка','Использование чужих документов и т.д.','Преднамеренное несоблюдение налогового законодательства или уклонение от налогов','Получения взяток','Мошенничество','Воровство и грабеж','Предоставление поддельных документов'],
  'Неразрешенная деятельность': ['Нарушение требований конфиденциальности','Неразрешенные типы транзакций (преднамеренная потеря)'],
  'Безопасность систем': ['Вред от хакерских атак','Кража информации, повлекшая за собой убытки'],
  'Взаимоотношения с сотрудниками': ['Вопросы оплаты труда, вознаграждения и выходные пособия','Организация трудовой деятельности'],
  'Безопасная среда': ['Инциденты/Риски, связанные с обстоятельствами по несчастным случаям','Инциденты/Риски, связанные с охраной здоровья и безопасностью труда','Инциденты/Риски, связанные с Компенсацией сотрудникам'],
  'Дискриминация': ['Все типы дискриминации'],
  'Приемлемость, раскрытие, фидуциарные отношения': ['Нарушения сотрудниками требований внутренних Политик и Процедур','Проблемы раскрытия информации (знай своего клиента)','Нарушение требований раскрытия информации розничным клиентам','Нарушения, связанные с раскрытием конфиденциальной информации','Агрессивные продажи','Искусственное завышение комиссионных','Злоупотребление конфиденциальной информации'],
  'Неправильная деловая или рыночная практика': ['Нарушение/невыполнение Антимонопольного законодательства','Инсайдерский трейдинг','Деятельность без лицензии','Отмывание денег'],
  'Недостатки продуктов': ['Дефекты продуктов (контрафактная продукция и т.д.)'],
  'Выбор, спонсорство и риски': ['Неудача в исследовании клиента согласно принятым принципам','Превышение лимита подверженности риску на клиента'],
  'Консалтинговые услуги': ['Разногласия в оценках результатов консалтинговых услуг'],
  'Катастрофы и прочие события': ['Ущерб от природных катастроф, человеческие потери от воздействия внешних источников','Умышленный ущерб активам Банка сотрудниками'],
  'Cистемы': ['Программное обеспечение','Аппаратное обеспечение','Телекоммуникации','Сбои в энергоснабжении и предоставлении коммунальных услуг'],
  'Исполнение и поддержание операции': ['Неправильная коммуникация','Ошибки при вводе, загрузке или поддержании данных','Нарушение сроков или обязательств','Неправильное функционирование систем или моделей','Бухгалтерские ошибки/ошибки в транзакциях','Прочие ошибки при выполнении задач','Срыв доставки','Срывы в управлении залогом'],
  'Мониторинг и отчетность': ['Несоблюдение обязательной отчетности','Несвоевременное проведение мониторинга','Неточная внешняя отчетность, повлекшая убытки'],
  'Привлечение клиентов и ведение документации': ['Отсутствующая или неполная юридическая документация'],
  'Управление клиентскими счетами': ['Неавторизованный доступ к счетам','Неправильные клиентские записи, повлекшие убытки','Ущерб или убытки клиентов в результате халатности'],
  'Торговые контрагенты': ['Действие контрагентов выше полномочий, установленных в рамках подписанного договора','Конфликты с контрагентами','Нарушение лимитов контрагентов'],
  'Поставщики и подрядчики': ['Инциденты, связанные с аутсорсингом','Конфликты с поставщиками'],
}

const EMPTY_FORM = {
  event_category_l1: '', event_category_l2: '', event_category_l3: '',
  business_process: '', case_description: '', repeat_count: 1,
  system: '', cause: '', factor: '', frequency: '',
  employee_involved: '', incident_location: '', department: '',
  discovered_by: '', disclosure: '', discovery_date: '', incident_date: '',
  loss_amount: '', currency: 'TJS', loss_amount_tjs: '', recovery_amount: '',
  incident_status: 'Открыт', client_work_status: '', system_link: '',
  transaction_count: '', probability: '', impact: '', control_quality: '',
  probability_score: '', impact_score: '', risk_level: '',
  plans: '', actual_execution: '', control_status: '', responsible: '',
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const PAGE_SIZE = 20

export default function RegistryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pendingForms, setPendingForms] = useState<IncidentForm[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(1)
  const [formData, setFormData] = useState<Record<string, unknown>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // ✅ Добавлен month фильтр
  const [filters, setFilters] = useState({ status: '', factor: '', system: '', department: '', risk_level: '', year: '', month: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // ── Alert state ─────────────────────────────────────────────────────────────
  const [nbtReported, setNbtReported] = useState<Record<string, boolean>>({})
  const [qSent,       setQSent]       = useState<Record<string, boolean>>({})
  const [nowMs,       setNowMs]       = useState(Date.now())

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('operational_incidents').select('*').order('incident_number', { ascending: false })
    if (filters.status) query = query.eq('incident_status', filters.status)
    if (filters.factor) query = query.eq('factor', filters.factor)
    if (filters.system) query = query.eq('system', filters.system)
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.risk_level) query = query.eq('risk_level', filters.risk_level)
    if (filters.year) query = query.gte('incident_date', `${filters.year}-01-01`).lte('incident_date', `${filters.year}-12-31`)
    // ✅ Фильтр по месяцу
    if (filters.month && filters.year) query = query.gte('incident_date', `${filters.year}-${filters.month}-01`).lte('incident_date', `${filters.year}-${filters.month}-31`)
    const { data } = await query
    setIncidents(data || [])
    setLoading(false)
  }, [filters])

  const fetchPendingForms = useCallback(async () => {
    const { data } = await supabase.from('incident_forms').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setPendingForms(data || [])
  }, [])

  useEffect(() => { fetchIncidents(); fetchPendingForms() }, [fetchIncidents, fetchPendingForms])

  // Load alert dismissal state from localStorage
  useEffect(() => {
    try {
      const r = localStorage.getItem('or_nbt_reported'); if (r) setNbtReported(JSON.parse(r))
      const q = localStorage.getItem('or_q_sent');       if (q) setQSent(JSON.parse(q))
    } catch {}
  }, [])

  // Live countdown — ticks every second
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Alert helpers ──────────────────────────────────────────────────────────
  function markNbtDone(incidentId: string) {
    const u = { ...nbtReported, [incidentId]: true }
    setNbtReported(u); localStorage.setItem('or_nbt_reported', JSON.stringify(u))
  }
  function markQuarterSent(key: string) {
    const u = { ...qSent, [key]: true }
    setQSent(u); localStorage.setItem('or_q_sent', JSON.stringify(u))
  }
  function fmtCountdown(ms: number): string {
    if (ms <= 0) return 'ПРОСРОЧЕНО'
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1_000)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }
  function getQuarterReportAlert(nowMs: number) {
    const year = new Date(nowMs).getFullYear()
    // Fixed reporting dates: Jan 1, Apr 1, Jul 1, Oct 1
    for (const y of [year - 1, year, year + 1]) {
      for (const month of [0, 3, 6, 9] as const) {
        const reportDate = new Date(y, month, 1)
        const diffDays = Math.floor((nowMs - reportDate.getTime()) / 86_400_000)
        if (diffDays < -1 || diffDays > 3) continue
        const quarterNum = month === 0 ? 4 : month / 3
        const reportYear  = month === 0 ? y - 1 : y
        const key      = `nbt-${y}-${month}`
        const label    = `Q${quarterNum} ${reportYear}`
        const dateStr  = reportDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        if (diffDays === -1) return { type: 'before'  as const, key, label, dateStr }
        if (diffDays === 0)  return { type: 'today'   as const, key, label, dateStr }
        if (diffDays >= 1)   return { type: 'overdue' as const, key, label, dateStr, daysAfter: diffDays }
      }
    }
    return null
  }

  function handleChange(field: string, value: unknown) {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'incident_date' && prev.discovery_date && value) {
        if (String(value) > String(prev.discovery_date)) { alert('Фактическая дата инцидента не может быть позже даты обнаружения!'); return prev }
      }
      if (field === 'discovery_date' && prev.incident_date && value) {
        if (String(prev.incident_date) > String(value)) { alert('Дата обнаружения не может быть раньше фактической даты инцидента!'); return prev }
      }
      if (field === 'recovery_amount' && prev.loss_amount_tjs && Number(value) > Number(prev.loss_amount_tjs)) {
        alert('Сумма восстановления не может быть больше суммы ущерба!'); return prev
      }
      if (field === 'probability' || field === 'impact' || field === 'control_quality') {
        const p = Number(field === 'probability' ? value : prev.probability) || 0
        const i = Number(field === 'impact' ? value : prev.impact) || 0
        const c = Number(field === 'control_quality' ? value : prev.control_quality) || 0
        if (p > 0 && i > 0 && c > 0) {
          const score = (p * i) / c
          updated.risk_level = score <= 3 ? 'Низкий' : score <= 6 ? 'Средний' : score <= 12 ? 'Высокий' : 'Экстремальные'
        } else { updated.risk_level = '' }
        updated.probability_score = p
        updated.impact_score = i
      }
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    if (!formData.event_category_l1 || !formData.business_process || !formData.factor ||
        !formData.system || !formData.cause || !formData.department ||
        !formData.discovered_by || !formData.disclosure ||
        !formData.discovery_date || !formData.incident_date || !formData.incident_status) {
      setError('Заполните все обязательные поля во всех этапах перед сохранением.')
      setSaving(false); return
    }
    const payload: Record<string, unknown> = {
      event_category_l1: formData.event_category_l1, event_category_l2: formData.event_category_l2,
      event_category_l3: formData.event_category_l3, business_process: formData.business_process,
      case_description: formData.case_description, repeat_count: Number(formData.repeat_count) || 1,
      system: formData.system, cause: formData.cause, factor: formData.factor, frequency: formData.frequency,
      employee_involved: formData.employee_involved || null, incident_location: formData.incident_location || null,
      department: formData.department, discovered_by: formData.discovered_by, disclosure: formData.disclosure,
      discovery_date: formData.discovery_date || null, incident_date: formData.incident_date || null,
      loss_amount: formData.loss_amount ? Number(formData.loss_amount) : null, currency: formData.currency,
      loss_amount_tjs: formData.loss_amount_tjs ? Number(formData.loss_amount_tjs) : null,
      recovery_amount: formData.recovery_amount ? Number(formData.recovery_amount) : null,
      incident_status: formData.incident_status, client_work_status: formData.client_work_status || null,
      system_link: formData.system_link || null,
      transaction_count: formData.transaction_count ? Number(formData.transaction_count) : null,
      probability: formData.probability ? Number(formData.probability) : null,
      impact: formData.impact ? Number(formData.impact) : null,
      control_quality: formData.control_quality ? Number(formData.control_quality) : null,
      probability_score: formData.probability_score ? Number(formData.probability_score) : null,
      impact_score: formData.impact_score ? Number(formData.impact_score) : null,
      risk_level: formData.risk_level || null, plans: formData.plans || null,
      actual_execution: formData.actual_execution || null, control_status: formData.control_status || null,
      responsible: formData.responsible || null, source: 'admin',
    }
    let err
    if (editingId) {
      const { error: e } = await supabase.from('operational_incidents').update(payload).eq('id', editingId)
      err = e
    } else {
      const { error: e } = await supabase.from('operational_incidents').insert(payload)
      err = e
    }
    if (err) { setError('Ошибка сохранения: ' + err.message); setSaving(false); return }
    if (!editingId && formData._form_id) {
      await supabase.from('incident_forms').update({ status: 'processed' }).eq('id', formData._form_id)
    }
    setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null); setActiveTab(1)
    fetchIncidents(); fetchPendingForms(); setSaving(false)
  }

  function openEdit(incident: Incident) {
    setFormData({ ...incident, loss_amount: incident.loss_amount || '', loss_amount_tjs: incident.loss_amount_tjs || '',
      recovery_amount: incident.recovery_amount || '', transaction_count: incident.transaction_count || '',
      probability: incident.probability || '', impact: incident.impact || '', control_quality: incident.control_quality || '',
      probability_score: incident.probability_score || '', impact_score: incident.impact_score || '' })
    setEditingId(incident.id); setActiveTab(1); setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить инцидент?')) return
    await supabase.from('operational_incidents').delete().eq('id', id)
    fetchIncidents()
  }

  async function processForm(form: IncidentForm) {
    setFormData({ ...EMPTY_FORM, discovered_by: form.discovered_by, business_process: form.business_process,
      factor: form.factor, cause: form.cause, system: form.system, discovery_date: form.discovery_date,
      incident_date: form.incident_date, loss_amount: form.loss_amount || '', recovery_amount: form.recovery_amount || '',
      disclosure: form.disclosure, department: form.department, _form_id: form.id } as Record<string, unknown>)
    setShowFormsModal(false); setActiveTab(1); setShowModal(true)
  }

  // ── Computed alerts ────────────────────────────────────────────────────────
  const nbtAlerts = incidents.filter(i =>
    i.loss_amount_tjs != null && i.loss_amount_tjs >= 5000 &&
    !nbtReported[i.id] &&
    (nowMs - new Date(i.created_at).getTime()) < 7 * 86_400_000
  )
  const qAlert = getQuarterReportAlert(nowMs)

  // Change browser tab title when alerts are active (annoying on purpose)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const overdue = nbtAlerts.filter(i => nowMs - new Date(i.created_at).getTime() > 86_400_000)
    const urgent  = nbtAlerts.filter(i => {
      const rem = new Date(i.created_at).getTime() + 86_400_000 - nowMs
      return rem > 0 && rem < 4 * 3_600_000
    })
    if (overdue.length > 0)      document.title = `🚨 ПРОСРОЧЕНО! ${overdue.length} отчёт НБТ не отправлен!`
    else if (urgent.length > 0)  document.title = `⏰ СРОЧНО! ${urgent.length} отчёт НБТ — менее 4 часов!`
    else if (nbtAlerts.length > 0) document.title = `⚠️ ${nbtAlerts.length} инцидент(а) требуют отчёта НБТ`
    else                         document.title = 'Реестр операционных инцидентов'
    return () => { document.title = 'Реестр операционных инцидентов' }
  })

  const filtered = incidents.filter(i =>
    !search ||
    i.case_description?.toLowerCase().includes(search.toLowerCase()) ||
    i.business_process?.toLowerCase().includes(search.toLowerCase()) ||
    i.discovered_by?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.incident_number).includes(search)
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ✅ Исправлена нумерация в Excel — по порядку отображения (1,2,3...)
  function exportToExcel() {
    const headers = ['№','№ инцидента','Категория Ур.1','Категория Ур.2','Пример действий Ур.3','Бизнес-процесс','Фактор риска','Система','Причина','Частота','Кол-во повторений','Место происшествия','Сотрудник (чел. фактор)','Описание кейса','Обнаружил (ФИО)','Дата обнаружения','Дата инцидента','Раскрытие','Ссылка/ID транзакции','Кол-во транзакций','Сумма ущерба','Валюта','Сумма ущерба (TJS)','Сумма возврата (TJS)','Остаток (TJS)','Уровень возврата (%)','Статус инцидента','Статус работы с клиентом','Планы мероприятий','Фактическое исполнение','Ответственный','Статус контроля','Вероятность','Влияние','Контроль и регулирование','Уровень риска']
    const rows = filtered.map((i, idx) => [
      idx + 1, // ✅ Порядковый номер по порядку отображения
      i.incident_number,
      i.event_category_l1?.replace(/_/g,' ')||'',i.event_category_l2||'',i.event_category_l3||'',
      i.business_process||'',i.factor||'',i.system||'',i.cause||'',i.frequency||'',i.repeat_count||1,
      i.department||'',i.employee_involved||'',i.case_description||'',i.discovered_by||'',
      i.discovery_date||'',i.incident_date||'',i.disclosure||'',i.system_link||'',i.transaction_count||'',
      i.loss_amount||'',i.currency||'TJS',i.loss_amount_tjs||'',i.recovery_amount||'',i.remainder||'',
      i.recovery_rate?`${i.recovery_rate}%`:'',i.incident_status||'',i.client_work_status||'',
      i.plans||'',i.actual_execution||'',i.responsible||'',i.control_status||'',
      i.probability||'',i.impact||'',i.control_quality||'',i.risk_level||''
    ])
    const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`Реестр_инцидентов_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function generateNBTReport(incident: Incident) {
    if (!incident.loss_amount_tjs || incident.loss_amount_tjs < 5000) {
      alert('Отчёт НБТ формируется только для инцидентов с ущербом от 5 000 TJS!'); return
    }
    try {
      const res = await fetch('/api/export/nbt-report', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({incident}) })
      if (!res.ok) throw new Error('Ошибка сервера')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url; a.download=`NBT_OR_${incident.incident_number}_${new Date().toISOString().split('T')[0]}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Ошибка при генерации отчёта НБТ') }
  }

  const getRiskBg = (level: string) => {
    if (level === 'Экстремальные') return 'bg-red-100 text-red-800'
    if (level === 'Высокий') return 'bg-orange-100 text-orange-800'
    if (level === 'Средний') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusBg = (status: string) => {
    if (status === 'Открыт') return 'bg-blue-100 text-blue-800'
    if (status === 'В процессе') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent bg-white"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-full">

      {/* Sticky: заголовок + KPI */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Реестр операционных инцидентов</h1>
            <p className="text-sm text-gray-500 mt-0.5">Учёт и управление операционными инцидентами</p>
          </div>
          <div className="flex items-center gap-2">
            {pendingForms.length > 0 && (
              <button onClick={() => setShowFormsModal(true)} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                <Bell className="w-4 h-4" /> {pendingForms.length} новых анкет
              </button>
            )}
            <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Экспорт Excel
            </button>
            <button onClick={() => { setFormData(EMPTY_FORM); setEditingId(null); setActiveTab(1); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] transition-colors">
              <Plus className="w-4 h-4" /> Добавить инцидент
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Всего', value: incidents.length, color: 'text-gray-900' },
            { label: 'Открытые', value: incidents.filter(i => i.incident_status === 'Открыт').length, color: 'text-blue-600' },
            { label: 'В процессе', value: incidents.filter(i => i.incident_status === 'В процессе').length, color: 'text-yellow-600' },
            { label: 'Закрытые', value: incidents.filter(i => i.incident_status === 'Закрыт').length, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 mt-5">

      {/* ── NBT 24h Alerts ─────────────────────────────────────────────────── */}
      {nbtAlerts.map(incident => {
        const deadline  = new Date(incident.created_at).getTime() + 86_400_000
        const remaining = deadline - nowMs
        const isOverdue = remaining <= 0
        const isUrgent  = !isOverdue && remaining < 4 * 3_600_000
        const timeStr   = isOverdue ? null : fmtCountdown(remaining)
        const hoursLate = isOverdue ? Math.floor((nowMs - deadline) / 3_600_000) : 0
        return (
          <div key={incident.id}
            className={`rounded-xl border-2 p-4 ${
              isOverdue  ? 'bg-red-50 border-red-500 animate-pulse' :
              isUrgent   ? 'bg-orange-50 border-orange-400' :
                           'bg-amber-50 border-amber-300'
            }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <ShieldAlert className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                  isOverdue ? 'text-red-600 animate-bounce' :
                  isUrgent  ? 'text-orange-600 animate-pulse' : 'text-amber-600'
                }`} />
                <div className="min-w-0">
                  <p className={`font-bold text-sm ${
                    isOverdue ? 'text-red-700' : isUrgent ? 'text-orange-700' : 'text-amber-700'
                  }`}>
                    {isOverdue
                      ? `🚨 ПРОСРОЧЕНО! Отчёт в НБТ не был отправлен (${hoursLate} ч. назад)`
                      : '⚠️ ТРЕБУЕТСЯ ОТЧЁТ В НБТ РТ В ТЕЧЕНИЕ 24 ЧАСОВ!'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Инцидент #{incident.incident_number}
                    {' · '}Ущерб: <span className="font-semibold">{new Intl.NumberFormat('ru-RU').format(incident.loss_amount_tjs!)} TJS</span>
                    {' · '}Обнаружен: {formatDate(incident.discovery_date)}
                    {' · '}Зарегистрирован: {new Date(incident.created_at).toLocaleString('ru-RU')}
                  </p>
                  {!isOverdue && timeStr && (
                    <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-base ${
                      isUrgent ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      <Clock className="w-4 h-4" />
                      До дедлайна: {timeStr}
                    </div>
                  )}
                  {isOverdue && (
                    <p className="mt-1.5 text-xs font-semibold text-red-700">
                      Дедлайн 24ч истёк {hoursLate} ч. назад. Немедленно уведомите НБТ РТ и зафиксируйте отправку!
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => { generateNBTReport(incident); markNbtDone(incident.id) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap ${
                    isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1B8A4C] hover:bg-[#177040]'
                  }`}>
                  <FileWarning className="w-3.5 h-3.5" /> Сформировать отчёт НБТ
                </button>
                <button
                  onClick={() => markNbtDone(incident.id)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Отмечено как отправлено
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Quarterly Report Alert ──────────────────────────────────────────── */}
      {qAlert && !qSent[qAlert.key] && (
        <div className={`rounded-xl border-2 p-4 ${
          qAlert.type === 'overdue' ? 'bg-red-50 border-red-500 animate-pulse' :
          qAlert.type === 'today'   ? 'bg-orange-50 border-orange-500' :
                                      'bg-yellow-50 border-yellow-400'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellRing className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                qAlert.type === 'overdue' ? 'text-red-600 animate-bounce' :
                qAlert.type === 'today'   ? 'text-orange-600 animate-pulse' :
                                            'text-yellow-600'
              }`} />
              <div>
                <p className={`font-bold text-sm ${
                  qAlert.type === 'overdue' ? 'text-red-700' :
                  qAlert.type === 'today'   ? 'text-orange-700' :
                                              'text-yellow-700'
                }`}>
                  {qAlert.type === 'overdue'
                    ? `🚨 ПРОСРОЧЕНО — Квартальный отчёт НБТ РТ · ${qAlert.label} не отправлен`
                    : qAlert.type === 'today'
                    ? `🔴 СЕГОДНЯ — Срок подачи квартального отчёта НБТ РТ · ${qAlert.label}`
                    : `⚠️ ЗАВТРА — Квартальный отчёт НБТ РТ · ${qAlert.label}`
                  }
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {qAlert.type === 'overdue'
                    ? `Отчётная дата ${qAlert.dateStr} прошла ${qAlert.daysAfter} дн. назад. Немедленно отправьте отчёт по операционным рискам в НБТ РТ!`
                    : qAlert.type === 'today'
                    ? `Срок подачи отчёта по операционным рискам за ${qAlert.label} истекает СЕГОДНЯ (${qAlert.dateStr}). Отправьте в НБТ РТ незамедлительно!`
                    : `Отчётная дата: ${qAlert.dateStr}. Подготовьте и отправьте квартальный отчёт по операционным рискам в НБТ РТ.`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => markQuarterSent(qAlert.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap flex-shrink-0 ${
                qAlert.type === 'overdue' ? 'bg-red-600 hover:bg-red-700' :
                qAlert.type === 'today'   ? 'bg-orange-600 hover:bg-orange-700' :
                                            'bg-[#1B8A4C] hover:bg-[#177040]'
              }`}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Отчёт отправлен в НБТ
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Поиск по номеру, описанию, координатору..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn('flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors', showFilters ? 'bg-[#1B8A4C] text-white border-[#1B8A4C]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
            <Filter className="w-4 h-4" /> Фильтры
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mt-3 pt-3 border-t border-gray-100">
            <select value={filters.status} onChange={e => { setFilters(p => ({...p, status: e.target.value})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все статусы</option>
              {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.factor} onChange={e => { setFilters(p => ({...p, factor: e.target.value})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все факторы</option>
              {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filters.system} onChange={e => { setFilters(p => ({...p, system: e.target.value})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все системы</option>
              {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.risk_level} onChange={e => { setFilters(p => ({...p, risk_level: e.target.value})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все риски</option>
              {['Низкий','Средний','Высокий','Экстремальные'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filters.year} onChange={e => { setFilters(p => ({...p, year: e.target.value, month: ''})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все годы</option>
              {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* ✅ Новый фильтр по месяцам */}
            <select value={filters.month} onChange={e => { setFilters(p => ({...p, month: e.target.value})); setCurrentPage(1) }} className={inputCls}>
              <option value="">Все месяцы</option>
              {MONTHS.map((m, i) => (
                <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
              ))}
            </select>
            <button onClick={() => { setFilters({status:'',factor:'',system:'',department:'',risk_level:'',year:'',month:''}); setCurrentPage(1) }}
              className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-10">№</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Дата обнаружения</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Категория</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Бизнес-процесс</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Фактор</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Система</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Ущерб (TJS)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Возврат (TJS)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Уровень риска</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">Инцидентов не найдено</td></tr>
              ) : (
                paginated.map((incident, idx) => (
                  <tr key={incident.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(incident.discovery_date)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={incident.event_category_l1}>{incident.event_category_l1?.replace(/_/g,' ')}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={incident.business_process}>{incident.business_process}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{incident.factor}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{incident.system}</td>
                    <td className="px-4 py-3 text-red-600 whitespace-nowrap font-medium">{incident.loss_amount_tjs ? new Intl.NumberFormat('ru-RU').format(incident.loss_amount_tjs) : '—'}</td>
                    <td className="px-4 py-3 text-green-700 whitespace-nowrap font-medium">{incident.recovery_amount ? new Intl.NumberFormat('ru-RU').format(incident.recovery_amount) : '—'}</td>
                    <td className="px-4 py-3">
                      {incident.risk_level ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRiskBg(incident.risk_level)}`}>{incident.risk_level}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBg(incident.incident_status)}`}>{incident.incident_status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewingIncident(incident)} title="Просмотр" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEdit(incident)} title="Редактировать" className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        {incident.loss_amount_tjs && incident.loss_amount_tjs >= 5000 && (
                          <button onClick={() => generateNBTReport(incident)} title="Отчёт НБТ" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"><FileWarning className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDelete(incident.id)} title="Удалить" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Показано {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} из {filtered.length} инцидентов
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">←</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1 : currentPage <= 4 ? i + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + i : currentPage - 3 + i
                  return (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`px-2.5 py-1 text-xs rounded border ${currentPage === p ? 'bg-[#1B8A4C] text-white border-[#1B8A4C]' : 'border-gray-200 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">→</button>
              </div>
            )}
          </div>
        )}
      </div>

      </div>{/* end space-y-4 mt-5 */}

      {/* Pending Forms Modal */}
      {showFormsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Новые анкеты от координаторов ({pendingForms.length})</h2>
              <button onClick={() => setShowFormsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {pendingForms.map(form => (
                <div key={form.id} className="border border-gray-100 rounded-xl p-4 hover:border-[#1B8A4C]/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900 text-sm">{form.discovered_by}</p>
                      <p className="text-xs text-gray-500">{form.department} · {form.business_process}</p>
                      <p className="text-xs text-gray-600 mt-1">{form.disclosure}</p>
                      <p className="text-xs text-gray-400">{formatDate(form.created_at)}</p>
                    </div>
                    <button onClick={() => processForm(form)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040] transition-colors whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Обработать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Инцидент #{viewingIncident.incident_number}</h2>
              <button onClick={() => setViewingIncident(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Категория (Ур. 1)', viewingIncident.event_category_l1?.replace(/_/g,' ')],
                  ['Категория (Ур. 2)', viewingIncident.event_category_l2],
                  ['Бизнес-процесс', viewingIncident.business_process],
                  ['Фактор', viewingIncident.factor],
                  ['Система', viewingIncident.system],
                  ['Причина', viewingIncident.cause],
                  ['Частота', viewingIncident.frequency],
                  ['Обнаружил', viewingIncident.discovered_by],
                  ['Место происшествия', viewingIncident.department],
                  ['Дата обнаружения', formatDate(viewingIncident.discovery_date)],
                  ['Дата инцидента', formatDate(viewingIncident.incident_date)],
                  ['Сумма ущерба', viewingIncident.loss_amount_tjs ? `${new Intl.NumberFormat('ru-RU').format(viewingIncident.loss_amount_tjs)} TJS` : '—'],
                  ['Возврат', viewingIncident.recovery_amount ? `${new Intl.NumberFormat('ru-RU').format(viewingIncident.recovery_amount)} TJS` : '—'],
                  ['Вероятность', viewingIncident.probability || '—'],
                  ['Влияние', viewingIncident.impact || '—'],
                  ['Контроль', viewingIncident.control_quality || '—'],
                  ['Уровень риска', viewingIncident.risk_level || '—'],
                  ['Статус инцидента', viewingIncident.incident_status],
                  ['Статус клиента', viewingIncident.client_work_status || '—'],
                  ['Ответственный', viewingIncident.responsible || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>
              {viewingIncident.disclosure && (
                <div><p className="text-xs text-gray-500">Раскрытие</p>
                <p className="text-sm text-gray-900 mt-0.5 bg-gray-50 rounded-lg p-3">{viewingIncident.disclosure}</p></div>
              )}
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Воздействие и контроль</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Планы мероприятий</p>
                    <p className="text-sm text-gray-900 mt-0.5 bg-blue-50 rounded-lg p-3 min-h-[40px]">{viewingIncident.plans || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Фактическое исполнение</p>
                    <p className="text-sm text-gray-900 mt-0.5 bg-green-50 rounded-lg p-3 min-h-[40px]">{viewingIncident.actual_execution || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Ответственный</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{viewingIncident.responsible || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Статус контроля</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{viewingIncident.control_status || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setViewingIncident(null); openEdit(viewingIncident) }} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                <Edit2 className="w-4 h-4" /> Редактировать
              </button>
              <button onClick={() => setViewingIncident(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Редактировать инцидент' : 'Новый инцидент'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Реестр операционных инцидентов</p>
              </div>
              <button onClick={() => {
                if (Object.values(formData).some(v => v !== '' && v !== 1 && v !== 'Открыт' && v !== 'TJS')) {
                  if (!confirm('Закрыть без сохранения? Данные будут потеряны.')) return
                }
                setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null)
              }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              {[{n:1,label:'Классификация'},{n:2,label:'Идентификация'},{n:3,label:'Анализ'},{n:4,label:'Воздействие'},{n:5,label:'Оценка'}].map(tab => (
                <button key={tab.n} onClick={() => setActiveTab(tab.n)}
                  className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap', activeTab === tab.n ? 'border-[#1B8A4C] text-[#1B8A4C]' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                  {tab.n}. {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {activeTab === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Категория типа событий (Уровень 1) *</label>
                      <select value={String(formData.event_category_l1)} onChange={e => handleChange('event_category_l1', e.target.value)} className={inputCls}>
                        <option value="">Выберите категорию</option>
                        {EVENT_CATEGORIES_L1.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Категория инцидентов (Уровень 2) *</label>
                      <select value={String(formData.event_category_l2)} onChange={e => handleChange('event_category_l2', e.target.value)} className={inputCls}>
                        <option value="">Выберите категорию</option>
                        {(EVENT_CATEGORIES_L2[String(formData.event_category_l1)] || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Пример действий (Уровень 3)</label>
                      <select value={String(formData.event_category_l3)} onChange={e => handleChange('event_category_l3', e.target.value)} className={inputCls}>
                        <option value="">Выберите действие</option>
                        {(EVENT_CATEGORIES_L3_MAP[String(formData.event_category_l2)] || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Бизнес-процесс *</label>
                      <select value={String(formData.business_process)} onChange={e => handleChange('business_process', e.target.value)} className={inputCls}>
                        <option value="">Выберите процесс</option>
                        {BUSINESS_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Фактор риска *</label>
                      <select value={String(formData.factor)} onChange={e => handleChange('factor', e.target.value)} className={inputCls}>
                        <option value="">Выберите фактор</option>
                        {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Система *</label>
                      <select value={String(formData.system)} onChange={e => handleChange('system', e.target.value)} className={inputCls}>
                        <option value="">Выберите систему</option>
                        {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Частота повторений</label>
                      <select value={String(formData.frequency)} onChange={e => handleChange('frequency', e.target.value)} className={inputCls}>
                        <option value="">Выберите частоту</option>
                        {INCIDENT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Количество повторений</label>
                      <input type="number" min="1" value={String(formData.repeat_count)} onChange={e => handleChange('repeat_count', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Место происшествия *</label>
                      <select value={String(formData.department)} onChange={e => handleChange('department', e.target.value)} className={inputCls}>
                        <option value="">Выберите подразделение</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Сотрудник допустивший инцидент (чел. фактор)</label>
                      <input type="text" value={String(formData.employee_involved)} onChange={e => handleChange('employee_involved', e.target.value)} placeholder="ФИО сотрудника" className={inputCls} /></div>
                    <div><label className={labelCls}>Причины *</label>
                      <input type="text" value={String(formData.cause)} onChange={e => handleChange('cause', e.target.value)} placeholder="Причина инцидента" className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Описание кейса</label>
                    <textarea value={String(formData.case_description)} onChange={e => handleChange('case_description', e.target.value)} rows={3} placeholder="Подробное описание инцидента" className={inputCls+' resize-none'} /></div>
                </div>
              )}

              {activeTab === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Риск-координатор обнаруживший инцидент *</label>
                    <input type="text" value={String(formData.discovered_by)} onChange={e => handleChange('discovered_by', e.target.value)} placeholder="ФИО" className={inputCls} /></div>
                  <div><label className={labelCls}>Дата обнаружения *</label>
                    <input type="date" value={String(formData.discovery_date)} max={new Date().toISOString().split('T')[0]} onChange={e => handleChange('discovery_date', e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Фактическая дата инцидента *</label>
                    <input type="date" value={String(formData.incident_date)} max={String(formData.discovery_date) || new Date().toISOString().split('T')[0]} onChange={e => handleChange('incident_date', e.target.value)} className={inputCls} /></div>
                  <div className="lg:col-span-2"><label className={labelCls}>Раскрытие *</label>
                    <textarea value={String(formData.disclosure)} onChange={e => handleChange('disclosure', e.target.value)} rows={4} placeholder="Подробное описание инцидента..." className={inputCls+' resize-none'} /></div>
                  <div><label className={labelCls}>Ссылка в Mobi или ID транзакции</label>
                    <input type="text" value={String(formData.system_link)} onChange={e => handleChange('system_link', e.target.value)} placeholder="ID или ссылка" className={inputCls} /></div>
                  <div><label className={labelCls}>Количество транзакций</label>
                    <input type="number" min="0" value={String(formData.transaction_count)} onChange={e => handleChange('transaction_count', e.target.value)} className={inputCls} /></div>
                </div>
              )}

              {activeTab === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Сумма ущерба</label>
                    <input type="number" min="0" step="0.01" value={String(formData.loss_amount)} onChange={e => handleChange('loss_amount', e.target.value)} placeholder="0.00" className={inputCls} /></div>
                  <div><label className={labelCls}>Валюта</label>
                    <select value={String(formData.currency)} onChange={e => handleChange('currency', e.target.value)} className={inputCls}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Сумма в сомони (TJS)</label>
                    <input type="number" min="0" step="0.01" value={String(formData.loss_amount_tjs)} onChange={e => handleChange('loss_amount_tjs', e.target.value)} placeholder="0.00" className={inputCls} /></div>
                  <div><label className={labelCls}>Сумма возврата</label>
                    <input type="number" min="0" step="0.01" value={String(formData.recovery_amount)} onChange={e => handleChange('recovery_amount', e.target.value)} placeholder="0.00" className={inputCls} /></div>
                  {Boolean(formData.loss_amount_tjs) && Boolean(formData.recovery_amount) && (
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Остаток</p>
                        <p className="text-lg font-bold text-red-600 mt-0.5">{new Intl.NumberFormat('ru-RU').format(Number(formData.loss_amount_tjs) - Number(formData.recovery_amount))} TJS</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Уровень возврата</p>
                        <p className="text-lg font-bold text-green-600 mt-0.5">{Number(formData.loss_amount_tjs) > 0 ? ((Number(formData.recovery_amount)/Number(formData.loss_amount_tjs))*100).toFixed(1) : 0}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 4 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Статус работы с инцидентом *</label>
                    <select value={String(formData.incident_status)} onChange={e => handleChange('incident_status', e.target.value)} className={inputCls}>
                      <option value="">Выберите статус</option>
                      <option value="Открыт">Открыт</option>
                      <option value="В процессе">В процессе</option>
                      <option value="Закрыт">Закрыт</option>
                    </select></div>
                  <div><label className={labelCls}>Статус работы с клиентом</label>
                    <select value={String(formData.client_work_status)} onChange={e => handleChange('client_work_status', e.target.value)} className={inputCls}>
                      <option value="">Выберите статус</option>
                      {CLIENT_WORK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Планы мероприятий</label>
                    <textarea value={String(formData.plans)} onChange={e => handleChange('plans', e.target.value)} rows={3} placeholder="Планируемые мероприятия..." className={inputCls+' resize-none'} /></div>
                  <div><label className={labelCls}>Фактическое исполнение</label>
                    <textarea value={String(formData.actual_execution)} onChange={e => handleChange('actual_execution', e.target.value)} rows={3} placeholder="Фактически выполненные действия..." className={inputCls+' resize-none'} /></div>
                  <div><label className={labelCls}>Ответственный</label>
                    <input type="text" value={String(formData.responsible)} onChange={e => handleChange('responsible', e.target.value)} placeholder="ФИО ответственного" className={inputCls} /></div>
                  <div><label className={labelCls}>Статус контроля</label>
                    <input type="text" value={String(formData.control_status)} onChange={e => handleChange('control_status', e.target.value)} placeholder="Статус" className={inputCls} /></div>
                </div>
              )}

              {activeTab === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Вероятность *</label>
                      <select value={String(formData.probability)} onChange={e => handleChange('probability', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {PROBABILITY_SCORES.map(p => <option key={p.value} value={p.value}>{p.value} — {p.label}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Влияние *</label>
                      <select value={String(formData.impact)} onChange={e => handleChange('impact', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {IMPACT_SCORES.map(i => <option key={i.value} value={i.value}>{i.value} — {i.label}</option>)}
                      </select></div>
                    <div><label className={labelCls}>Контроль и регулирование</label>
                      <select value={String(formData.control_quality)} onChange={e => handleChange('control_quality', e.target.value)} className={inputCls}>
                        <option value="">Выберите</option>
                        {CONTROL_SCORES.map(c => <option key={c.value} value={c.value}>{c.value} — {c.label}</option>)}
                      </select></div>
                  </div>
                  {Boolean(formData.risk_level) && (
                    <div className={`p-4 rounded-xl border-2 ${formData.risk_level==='Экстремальные'?'bg-red-50 border-red-200':formData.risk_level==='Высокий'?'bg-orange-50 border-orange-200':formData.risk_level==='Средний'?'bg-yellow-50 border-yellow-200':'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-gray-500 mb-1">Степень риска (автоматически)</p>
                      <p className={`text-xl font-bold ${formData.risk_level==='Экстремальные'?'text-red-700':formData.risk_level==='Высокий'?'text-orange-700':formData.risk_level==='Средний'?'text-yellow-700':'text-green-700'}`}>
                        {String(formData.risk_level || '')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-between">
              <div>{activeTab > 1 && <button onClick={() => setActiveTab(activeTab-1)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Назад</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
                {activeTab < 5 ? (
                  <button onClick={() => setActiveTab(activeTab+1)} className="px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">Далее →</button>
                ) : (
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                    {saving ? <><Clock className="w-4 h-4 animate-spin" /> Сохранение...</> : <><CheckCircle2 className="w-4 h-4" /> Сохранить</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

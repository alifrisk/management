'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/supabase/client'
import {
  Loader2, CheckCircle2, AlertCircle, Building2, Briefcase, AlertTriangle,
  Calendar, ChevronRight, ChevronLeft, Phone, Cpu, User, Check,
} from 'lucide-react'
import { BUSINESS_PROCESSES, RISK_FACTORS, SYSTEMS, DEPARTMENTS } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────────────────
type FormData = {
  discovered_by:  string
  phone:          string
  department:     string
  business_process: string
  factor:         string
  system:         string
  cause:          string
  disclosure:     string
  actions_taken:  string
  discovery_date: string
  incident_date:  string
  loss_amount:    string
  recovery_amount: string
}

const INITIAL: FormData = {
  discovered_by: '', phone: '', department: '',
  business_process: '', factor: '', system: '', cause: '', disclosure: '', actions_taken: '',
  discovery_date: '', incident_date: '',
  loss_amount: '', recovery_amount: '',
}

const DRAFT_KEY = 'incident_form_draft'

const STEPS = [
  { id: 1, label: 'Обнаружение' },
  { id: 2, label: 'Детали'      },
  { id: 3, label: 'Даты'        },
  { id: 4, label: 'Ущерб'       },
]

// ── Styles ────────────────────────────────────────────────────────────────────
const inp = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all bg-white'
const sel = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent bg-white transition-all appearance-none'
const lbl = 'block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide'
const err = (e?: string) => e ? ' border-red-300 focus:ring-red-400' : ''

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />{msg}
    </p>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IncidentFormPage() {
  const [step,        setStep]        = useState(1)
  const [formData,    setFormData]    = useState<FormData>(INITIAL)
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [hasDraft,    setHasDraft]    = useState(false)
  const [draftSaved,  setDraftSaved]  = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as Partial<FormData>
        if (d.discovered_by || d.business_process || d.cause) setHasDraft(true)
      }
    } catch {}
  }, [])

  // Autosave on every change
  useEffect(() => {
    if (Object.values(formData).every(v => !v)) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
      setDraftSaved(true)
      const t = setTimeout(() => setDraftSaved(false), 2000)
      return () => clearTimeout(t)
    } catch {}
  }, [formData])

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) setFormData(JSON.parse(raw))
    } catch {}
    setHasDraft(false)
  }

  function set(field: keyof FormData, value: string) {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'discovery_date' && prev.incident_date && prev.incident_date > value) {
        next.incident_date = ''
      }
      return next
    })
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function validate(s: number) {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!formData.discovered_by.trim()) e.discovered_by  = 'Укажите ФИО'
      if (!formData.department)           e.department      = 'Выберите подразделение'
    }
    if (s === 2) {
      if (!formData.business_process) e.business_process = 'Выберите бизнес-процесс'
      if (!formData.factor)           e.factor            = 'Выберите фактор риска'
      if (!formData.system)           e.system            = 'Выберите систему'
      if (!formData.cause.trim())     e.cause             = 'Укажите причину'
      if (!formData.disclosure.trim()) e.disclosure       = 'Опишите инцидент'
    }
    if (s === 3) {
      if (!formData.discovery_date) e.discovery_date = 'Укажите дату обнаружения'
      if (!formData.incident_date)  e.incident_date  = 'Укажите дату инцидента'
    }
    if (s === 4) {
      if (formData.loss_amount && formData.recovery_amount &&
          Number(formData.recovery_amount) > Number(formData.loss_amount)) {
        e.recovery_amount = 'Не может превышать сумму ущерба'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() { if (validate(step)) setStep(s => s + 1) }
  function back() { setErrors({}); setStep(s => s - 1) }

  async function submit() {
    if (!validate(4)) return
    setLoading(true); setSubmitError(null)
    const { error } = await supabase.from('incident_forms').insert({
      discovered_by:    formData.discovered_by,
      business_process: formData.business_process,
      factor:           formData.factor,
      system:           formData.system,
      cause:            formData.cause,
      disclosure:       formData.disclosure,
      department:       formData.department,
      discovery_date:   formData.discovery_date,
      incident_date:    formData.incident_date,
      loss_amount:      formData.loss_amount    ? parseFloat(formData.loss_amount)    : null,
      recovery_amount:  formData.recovery_amount ? parseFloat(formData.recovery_amount) : null,
      status:           'pending',
      phone:            formData.phone          || null,
      actions_taken:    formData.actions_taken  || null,
    })
    setLoading(false)
    if (error) { setSubmitError('Ошибка при отправке. Попробуйте снова.'); return }
    localStorage.removeItem(DRAFT_KEY)
    setSuccess(true)
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 50%, #1B8A4C 100%)'}}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#1B8A4C]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Анкета отправлена!</h2>
          <p className="text-gray-500 mb-2">Служба управления рисками получила вашу анкету и обработает её в ближайшее время.</p>
          <p className="text-sm text-gray-400 mb-8">Спасибо за своевременное уведомление!</p>
          <button
            onClick={() => { setSuccess(false); setFormData(INITIAL); setStep(1) }}
            className="w-full py-3 bg-[#1B8A4C] text-white rounded-xl font-medium hover:bg-[#177040] transition-colors">
            Заполнить ещё одну анкету
          </button>
        </div>
      </div>
    )
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen"
      style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 60%, #1B8A4C 100%)'}}>

      {/* Sticky header */}
      <div className="sticky top-0 z-30 border-b border-white/10"
        style={{background: 'rgba(11,49,28,0.97)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.35)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 relative flex items-center justify-center">
          <div className="text-center">
            <p className="text-white font-bold text-sm">Анкета операционного инцидента</p>
            <p className="text-green-400/60 text-xs">ОАО «Алиф Банк» · Служба управления рисками</p>
          </div>
          <span className={`absolute right-4 text-xs flex items-center gap-1 transition-opacity duration-300 ${draftSaved ? 'opacity-100 text-green-400' : 'opacity-0'}`}>
            <Check className="w-3 h-3" /> Черновик сохранён
          </span>
        </div>
      </div>

      {/* Draft restore banner */}
      {hasDraft && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-amber-800 text-sm font-medium">Найден незавершённый черновик</p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={restoreDraft}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
                Продолжить
              </button>
              <button onClick={() => { localStorage.removeItem(DRAFT_KEY); setHasDraft(false) }}
                className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 rounded-lg text-xs hover:bg-amber-50 transition-colors">
                Начать заново
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-5 md:pt-16 md:pb-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* ── Step indicator ─────────────────────────────────────────── */}
          <div className="px-6 pt-4 pb-3">
            <div className="flex justify-between mb-3">
              {STEPS.map(s => (
                <div key={s.id} className="flex flex-col items-center gap-1.5 w-1/4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                    s.id < step  ? 'bg-[#1B8A4C] border-[#1B8A4C] text-white shadow-md shadow-green-900/20' :
                    s.id === step ? 'bg-white border-[#1B8A4C] text-[#1B8A4C] shadow-md shadow-green-100 ring-4 ring-[#1B8A4C]/10' :
                    'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {s.id < step ? <Check className="w-4 h-4" /> : s.id}
                  </div>
                  <span className={`text-[10px] font-semibold text-center leading-tight transition-colors ${
                    s.id === step ? 'text-[#1B8A4C]' : s.id < step ? 'text-gray-400' : 'text-gray-300'
                  }`}>{s.label}</span>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B8A4C] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* ── Step content ───────────────────────────────────────────── */}
          <div className="px-6 py-3 min-h-[240px]">

            {/* Step 1: Discovery */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="mb-1">
                  <p className="font-semibold text-gray-900 text-base">Информация об обнаружении</p>
                  <p className="text-xs text-gray-400 mt-0.5">Кто и где обнаружил инцидент</p>
                </div>

                <div>
                  <label className={lbl}>ФИО обнаружившего *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type="text" value={formData.discovered_by}
                      onChange={e => set('discovered_by', e.target.value)}
                      placeholder="Иванов Иван Иванович"
                      className={inp + ' pl-10' + err(errors.discovered_by)} />
                  </div>
                  <FieldError msg={errors.discovered_by} />
                </div>

                <div>
                  <label className={lbl}>Контактный телефон <span className="text-gray-300 font-normal normal-case tracking-normal">(необязательно)</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type="tel" value={formData.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+992 XX XXX XXXX"
                      className={inp + ' pl-10'} />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Структурное подразделение *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select value={formData.department}
                      onChange={e => set('department', e.target.value)}
                      className={sel + ' pl-10' + err(errors.department)}>
                      <option value="">Выберите подразделение</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <FieldError msg={errors.department} />
                </div>
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <p className="font-semibold text-gray-900 text-base">Детали инцидента</p>
                  <p className="text-xs text-gray-400 mt-0.5">Классификация и описание произошедшего</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Бизнес-процесс *</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                      <select value={formData.business_process}
                        onChange={e => set('business_process', e.target.value)}
                        className={sel + ' pl-10' + err(errors.business_process)}>
                        <option value="">Выберите...</option>
                        {BUSINESS_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <FieldError msg={errors.business_process} />
                  </div>
                  <div>
                    <label className={lbl}>Фактор риска *</label>
                    <div className="relative">
                      <AlertTriangle className="absolute left-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                      <select value={formData.factor}
                        onChange={e => set('factor', e.target.value)}
                        className={sel + ' pl-10' + err(errors.factor)}>
                        <option value="">Выберите...</option>
                        {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <FieldError msg={errors.factor} />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Система / Приложение *</label>
                  <div className="relative">
                    <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select value={formData.system}
                      onChange={e => set('system', e.target.value)}
                      className={sel + ' pl-10' + err(errors.system)}>
                      <option value="">Выберите систему</option>
                      {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <FieldError msg={errors.system} />
                </div>

                <div>
                  <label className={lbl}>Причина инцидента *</label>
                  <input type="text" value={formData.cause}
                    onChange={e => set('cause', e.target.value)}
                    placeholder="Кратко укажите причину"
                    className={inp + err(errors.cause)} />
                  <FieldError msg={errors.cause} />
                </div>

                <div>
                  <label className={lbl}>Описание инцидента *</label>
                  <textarea value={formData.disclosure}
                    onChange={e => set('disclosure', e.target.value)}
                    placeholder="Подробно опишите что произошло, какие последствия..."
                    rows={3}
                    className={inp + ' resize-none' + err(errors.disclosure)} />
                  <FieldError msg={errors.disclosure} />
                </div>

                <div>
                  <label className={lbl}>
                    Принятые меры
                    <span className="ml-1 text-gray-300 font-normal normal-case tracking-normal">(необязательно)</span>
                  </label>
                  <textarea value={formData.actions_taken}
                    onChange={e => set('actions_taken', e.target.value)}
                    placeholder="Что было сделано сразу после обнаружения инцидента?"
                    rows={2}
                    className={inp + ' resize-none'} />
                </div>
              </div>
            )}

            {/* Step 3: Dates */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <p className="font-semibold text-gray-900 text-base">Временные рамки</p>
                  <p className="text-xs text-gray-400 mt-0.5">Дата инцидента не может быть позже даты обнаружения</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Дата обнаружения *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input type="date" value={formData.discovery_date} max={today}
                        onChange={e => set('discovery_date', e.target.value)}
                        className={inp + ' pl-10' + err(errors.discovery_date)} />
                    </div>
                    <FieldError msg={errors.discovery_date} />
                  </div>
                  <div>
                    <label className={lbl}>Дата инцидента *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input type="date" value={formData.incident_date}
                        max={formData.discovery_date || today}
                        onChange={e => set('incident_date', e.target.value)}
                        className={inp + ' pl-10' + err(errors.incident_date)} />
                    </div>
                    <FieldError msg={errors.incident_date} />
                  </div>
                </div>

                {/* Timeline visual hint */}
                {formData.discovery_date && formData.incident_date && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-xs text-[#1B8A4C]">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-gray-400 mb-0.5">Инцидент</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(formData.incident_date + 'T00:00:00').toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-px bg-[#1B8A4C]/30" />
                        {(() => {
                          const diff = Math.round(
                            (new Date(formData.discovery_date).getTime() - new Date(formData.incident_date).getTime()) / 86400000
                          )
                          return diff > 0
                            ? <span className="text-[#1B8A4C] font-medium whitespace-nowrap px-1">{diff} дн.</span>
                            : <span className="text-gray-400 whitespace-nowrap px-1">тот же день</span>
                        })()}
                        <div className="flex-1 h-px bg-[#1B8A4C]/30" />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 mb-0.5">Обнаружен</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(formData.discovery_date + 'T00:00:00').toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Financial */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <p className="font-semibold text-gray-900 text-base">Финансовый ущерб</p>
                  <p className="text-xs text-gray-400 mt-0.5">Заполните если есть финансовые потери (в сомони)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Сумма ущерба (TJS)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">TJS</span>
                      <input type="number" step="0.01" min="0"
                        value={formData.loss_amount}
                        onChange={e => set('loss_amount', e.target.value)}
                        placeholder="0.00"
                        className={inp + ' pl-12'} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Сумма восстановления (TJS)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">TJS</span>
                      <input type="number" step="0.01" min="0"
                        value={formData.recovery_amount}
                        onChange={e => set('recovery_amount', e.target.value)}
                        placeholder="0.00"
                        className={inp + ' pl-12' + err(errors.recovery_amount)} />
                    </div>
                    <FieldError msg={errors.recovery_amount} />
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Краткая сводка</p>
                  <div className="space-y-2">
                    {([
                      ['Обнаружил',         formData.discovered_by],
                      ['Подразделение',     formData.department],
                      ['Бизнес-процесс',    formData.business_process],
                      ['Система',           formData.system],
                      ['Фактор',            formData.factor],
                      ['Дата обнаружения',  formData.discovery_date
                        ? new Date(formData.discovery_date + 'T00:00:00').toLocaleDateString('ru-RU') : ''],
                    ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-xs text-gray-400">{k}</span>
                        <span className="text-xs font-medium text-gray-700 text-right max-w-[60%]">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Navigation ─────────────────────────────────────────────── */}
          <div className="px-6 pb-2 flex items-center gap-3">
            {step > 1 && (
              <button onClick={back}
                className="flex items-center gap-1.5 px-5 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Назад
              </button>
            )}
            {step < 4 ? (
              <button onClick={next}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1B8A4C] hover:bg-[#177040] text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-green-900/20">
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1B8A4C] hover:bg-[#177040] disabled:opacity-70 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-green-900/20">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем...</>
                  : <>Отправить в СУР <ChevronRight className="w-4 h-4" /></>}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-300 py-2.5">
            Поля * обязательны · Данные конфиденциальны
          </p>
        </div>

        <p className="text-center text-white/20 text-xs mt-4">
          © 2026 ОАО «Алиф Банк» · Служба управления рисками · Конфиденциально
        </p>
      </div>
    </div>
  )
}

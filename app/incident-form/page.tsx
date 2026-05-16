'use client'

import { useState } from 'react'
import { supabase } from '@/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, FileText, Building2, Briefcase, AlertTriangle, Monitor, Calendar, Mail, ChevronRight } from 'lucide-react'
import { BUSINESS_PROCESSES, RISK_FACTORS, SYSTEMS, DEPARTMENTS } from '@/lib/constants'

export default function IncidentFormPage() {
  const [formData, setFormData] = useState({
    discovered_by: '',
    business_process: '',
    factor: '',
    cause: '',
    system: '',
    discovery_date: '',
    incident_date: '',
    loss_amount: '',
    recovery_amount: '',
    disclosure: '',
    department: '',
    submitted_by: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      
      // Дата инцидента не может быть позже даты обнаружения
      if (name === 'incident_date' && prev.discovery_date && value > prev.discovery_date) {
        alert('Фактическая дата инцидента не может быть позже даты обнаружения!')
        return prev
      }
      if (name === 'discovery_date' && prev.incident_date && prev.incident_date > value) {
        alert('Дата обнаружения не может быть раньше фактической даты инцидента!')
        return prev
      }
      
      // Сумма восстановления не может быть больше суммы ущерба
      if (name === 'recovery_amount' && prev.loss_amount && Number(value) > Number(prev.loss_amount)) {
        alert('Сумма восстановления не может быть больше суммы ущерба!')
        return prev
      }
      
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('incident_forms')
      .insert({
        discovered_by: formData.discovered_by,
        business_process: formData.business_process,
        factor: formData.factor,
        cause: formData.cause,
        system: formData.system,
        discovery_date: formData.discovery_date,
        incident_date: formData.incident_date,
        loss_amount: formData.loss_amount ? parseFloat(formData.loss_amount) : null,
        recovery_amount: formData.recovery_amount ? parseFloat(formData.recovery_amount) : null,
        disclosure: formData.disclosure,
        department: formData.department,
        submitted_by: formData.submitted_by,
        status: 'pending',
      })

    if (insertError) {
      setError('Ошибка при отправке. Попробуйте снова.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 50%, #1B8A4C 100%)'}}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#1B8A4C]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Анкета отправлена!</h2>
          <p className="text-gray-500 mb-2">
            Служба управления рисками получила вашу анкету и обработает её в ближайшее время.
          </p>
          <p className="text-sm text-gray-400 mb-8">Спасибо за своевременное уведомление!</p>
          <button
            onClick={() => {
              setSuccess(false)
              setFormData({ discovered_by: '', business_process: '', factor: '', cause: '', system: '', discovery_date: '', incident_date: '', loss_amount: '', recovery_amount: '', disclosure: '', department: '', submitted_by: '' })
            }}
            className="w-full py-3 bg-[#1B8A4C] text-white rounded-xl font-medium hover:bg-[#177040] transition-colors"
          >
            Заполнить ещё одну анкету
          </button>
        </div>
      </div>
    )
  }

  const selectCls = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent bg-white transition-all appearance-none"
  const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent transition-all"

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, #0f3d24 0%, #1a7a43 60%, #1B8A4C 100%)'}}>
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
          <FileText className="w-4 h-4 text-green-200" />
          <span className="text-green-100 text-sm font-medium">Служба управления рисками</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Анкета операционного инцидента</h1>
        <p className="text-green-200/70 text-sm">ОАО «Алиф Банк» — заполните все обязательные поля</p>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          
          {error && (
            <div className="mx-6 mt-6 flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {/* Section 1: Кто обнаружил */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B8A4C] font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Информация об обнаружении</h3>
                  <p className="text-xs text-gray-400">Кто и где обнаружил инцидент</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">ФИО обнаружившего *</label>
                  <input name="discovered_by" type="text" value={formData.discovered_by} onChange={handleChange} placeholder="Иванов Иван Иванович" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Структурное подразделение *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select name="department" value={formData.department} onChange={handleChange} required className={selectCls + ' pl-10'}>
                      <option value="">Выберите подразделение</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-6" />

            {/* Section 2: Детали инцидента */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B8A4C] font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Детали инцидента</h3>
                  <p className="text-xs text-gray-400">Классификация и описание</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Бизнес-процесс *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select name="business_process" value={formData.business_process} onChange={handleChange} required className={selectCls + ' pl-10'}>
                      <option value="">Выберите бизнес-процесс</option>
                      {BUSINESS_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Фактор риска *</label>
                  <div className="relative">
                    <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select name="factor" value={formData.factor} onChange={handleChange} required className={selectCls + ' pl-10'}>
                      <option value="">Выберите фактор</option>
                      {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Система *</label>
                  <div className="relative">
                    <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select name="system" value={formData.system} onChange={handleChange} required className={selectCls + ' pl-10'}>
                      <option value="">Выберите систему</option>
                      {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Причина инцидента *</label>
                  <input name="cause" type="text" value={formData.cause} onChange={handleChange} placeholder="Кратко опишите причину" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Описание инцидента *</label>
                  <textarea name="disclosure" value={formData.disclosure} onChange={handleChange} placeholder="Подробно опишите что произошло, какие последствия..." required rows={4} className={inputCls + ' resize-none'} />
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-6" />

            {/* Section 3: Даты */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B8A4C] font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Временные рамки</h3>
                  <p className="text-xs text-gray-400">Когда произошёл и обнаружен инцидент</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Дата обнаружения *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input name="discovery_date" type="date" value={formData.discovery_date} onChange={handleChange} required className={inputCls + ' pl-10'} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Дата инцидента *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input name="incident_date" type="date" value={formData.incident_date} onChange={handleChange} required className={inputCls + ' pl-10'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-6" />

            {/* Section 4: Финансы */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B8A4C] font-bold text-sm">4</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Финансовый ущерб</h3>
                  <p className="text-xs text-gray-400">Заполните если есть финансовые потери</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Сумма ущерба (сомони)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">TJS</span>
                    <input name="loss_amount" type="number" step="0.01" min="0" value={formData.loss_amount} onChange={handleChange} placeholder="0.00" className={inputCls + ' pl-12'} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Сумма восстановления (сомони)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">TJS</span>
                    <input name="recovery_amount" type="number" step="0.01" min="0" value={formData.recovery_amount} onChange={handleChange} placeholder="0.00" className={inputCls + ' pl-12'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-6" />

            {/* Section 5: Контакт */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1B8A4C] font-bold text-sm">5</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Ваши контакты</h3>
                  <p className="text-xs text-gray-400">Для обратной связи</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Корпоративный email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input name="submitted_by" type="email" value={formData.submitted_by} onChange={handleChange} placeholder="имя@alif.tj" className={inputCls + ' pl-10'} />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="px-6 pb-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#1B8A4C] hover:bg-[#177040] disabled:opacity-70 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-green-900/20"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Отправляем анкету...</>
                ) : (
                  <>Отправить в СУР <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                Поля отмеченные * обязательны для заполнения
              </p>
            </div>

          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-4">
          © 2026 ОАО «Алиф Банк» · Служба управления рисками · Конфиденциально
        </p>
      </div>
    </div>
  )
}

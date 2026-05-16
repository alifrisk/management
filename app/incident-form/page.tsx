'use client'

import { useState } from 'react'
import { supabase } from '@/supabase/client'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
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
      <div className="min-h-screen bg-[#F5F8F6] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#1B8A4C]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Анкета отправлена!</h2>
          <p className="text-gray-500 text-sm mb-2">
            Служба управления рисками получила уведомление и обработает инцидент в ближайшее время.
          </p>
          <button
            onClick={() => {
              setSuccess(false)
              setFormData({ discovered_by: '', business_process: '', factor: '', cause: '', system: '', discovery_date: '', incident_date: '', loss_amount: '', recovery_amount: '', disclosure: '', department: '', submitted_by: '' })
            }}
            className="mt-5 w-full py-2.5 bg-[#1B8A4C] text-white rounded-lg font-medium hover:bg-[#177040] transition-colors"
          >
            Заполнить ещё одну анкету
          </button>
        </div>
      </div>
    )
  }

  const inputCls = "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] focus:border-transparent bg-white"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5"

  return (
    <div className="min-h-screen bg-[#F5F8F6] py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Анкета операционного инцидента</h1>
          <p className="text-gray-500 text-sm mt-1">ОАО «Алиф Банк» · Служба управления рисками</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>ФИО обнаружившего инцидент *</label>
              <input name="discovered_by" type="text" value={formData.discovered_by} onChange={handleChange} placeholder="Иванов Иван Иванович" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Структурное подразделение *</label>
              <select name="department" value={formData.department} onChange={handleChange} required className={inputCls}>
                <option value="">Выберите подразделение</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Бизнес-процесс *</label>
              <select name="business_process" value={formData.business_process} onChange={handleChange} required className={inputCls}>
                <option value="">Выберите бизнес-процесс</option>
                {BUSINESS_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Фактор риска *</label>
              <select name="factor" value={formData.factor} onChange={handleChange} required className={inputCls}>
                <option value="">Выберите фактор</option>
                {RISK_FACTORS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Система *</label>
              <select name="system" value={formData.system} onChange={handleChange} required className={inputCls}>
                <option value="">Выберите систему</option>
                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Причина инцидента *</label>
              <input name="cause" type="text" value={formData.cause} onChange={handleChange} placeholder="Кратко опишите причину" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Описание инцидента *</label>
              <textarea name="disclosure" value={formData.disclosure} onChange={handleChange} placeholder="Подробно опишите что произошло..." required rows={3} className={inputCls + ' resize-none'} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Дата обнаружения *</label>
                <input name="discovery_date" type="date" value={formData.discovery_date} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Дата инцидента *</label>
                <input name="incident_date" type="date" value={formData.incident_date} onChange={handleChange} required className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Сумма ущерба (если есть)</label>
                <input name="loss_amount" type="number" step="0.01" value={formData.loss_amount} onChange={handleChange} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Сумма восстановления</label>
                <input name="recovery_amount" type="number" step="0.01" value={formData.recovery_amount} onChange={handleChange} placeholder="0.00" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Ваш email</label>
              <input name="submitted_by" type="email" value={formData.submitted_by} onChange={handleChange} placeholder="имя@alif.tj" className={inputCls} />
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-[#1B8A4C] hover:bg-[#177040] disabled:opacity-70 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем...</> : 'Отправить анкету в СУР'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          © 2026 ОАО «Алиф Банк» · Служба управления рисками · Конфиденциально
        </p>
      </div>
    </div>
  )
}

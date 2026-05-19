'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/supabase/client'
import { Save, CheckCircle2, AlertCircle, Building2, FileText, Phone } from 'lucide-react'

interface Setting { key: string; value: string }

const SETTING_GROUPS = [
  {
    title: 'Общие настройки банка',
    icon: <Building2 className="w-5 h-5 text-[#1B8A4C]" />,
    fields: [
      { key: 'bank_name', label: 'Официальное название банка', placeholder: 'ҶСК «Алиф Бонк»', type: 'text' },
    ]
  },
  {
    title: 'Исполнитель для писем НБТ',
    icon: <FileText className="w-5 h-5 text-blue-600" />,
    desc: 'Данные подставляются в официальные письма в Национальный Банк Таджикистана',
    fields: [
      { key: 'nbt_executor_name', label: 'ФИО исполнителя', placeholder: 'Иванов Иван Иванович', type: 'text' },
      { key: 'nbt_executor_position', label: 'Должность', placeholder: 'Начальник СУР', type: 'text' },
      { key: 'nbt_executor_phone', label: 'Контактный телефон', placeholder: '+992 XX XXX-XX-XX', type: 'text' },
    ]
  },

  {
    title: 'Пороги уведомлений',
    icon: <Phone className="w-5 h-5 text-orange-600" />,
    desc: 'Пороговые значения для автоматических действий',
    fields: [
      { key: 'incident_nbt_threshold', label: 'Порог для письма НБТ (TJS)', placeholder: '5000', type: 'number' },
    ]
  },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch_() {
      const { data } = await supabase.from('app_settings').select('key, value')
      const map: Record<string, string> = {}
      ;(data || []).forEach((s: Setting) => { map[s.key] = s.value || '' })
      setSettings(map)
      setLoading(false)
    }
    fetch_()
  }, [])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key, value, updated_at: new Date().toISOString()
      }))
      const { error: e } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })
      if (e) throw new Error(e.message)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Параметры платформы управления рисками</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
          {saving ? 'Сохранение...' : <><Save className="w-4 h-4" /> Сохранить</>}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700 font-medium">Настройки успешно сохранены!</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {SETTING_GROUPS.map(group => (
        <div key={group.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            {group.icon}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
              {group.desc && <p className="text-xs text-gray-500 mt-0.5">{group.desc}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {group.fields.map(field => (
              <div key={field.key}>
                <label className={lbl}>{field.label}</label>
                <input
                  type={field.type}
                  value={settings[field.key] || ''}
                  onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={inp}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
          {saving ? 'Сохранение...' : <><Save className="w-4 h-4" /> Сохранить настройки</>}
        </button>
      </div>
    </div>
  )
}

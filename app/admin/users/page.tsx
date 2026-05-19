'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Trash2, X, CheckCircle2, AlertCircle, Search, Shield, Eye, UserCheck } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  department: string
  position: string
  is_active: boolean
  created_at: string
}

const ROLES = [
  { value: 'admin', label: 'Администратор', desc: 'Полный доступ', color: 'bg-red-100 text-red-700', icon: <Shield className="w-3.5 h-3.5" /> },
  { value: 'observer', label: 'Наблюдатель', desc: 'Просмотр без изменений', color: 'bg-blue-100 text-blue-700', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'coordinator', label: 'Риск-координатор', desc: 'Только анкета инцидентов', color: 'bg-green-100 text-green-700', icon: <UserCheck className="w-3.5 h-3.5" /> },
]

const EMPTY_FORM = {
  email: '', full_name: '', role: 'observer',
  department: '', position: '', password: '',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleAdd() {
    if (!form.email.trim()) { setError('Введите email'); return }
    if (!form.full_name.trim()) { setError('Введите ФИО'); return }
    if (!form.password || form.password.length < 6) { setError('Пароль минимум 6 символов'); return }
    if (!form.email.includes('@')) { setError('Введите корректный email'); return }

    setSaving(true); setError(null)
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: { full_name: form.full_name },
      })

      if (authErr) throw new Error(authErr.message)

      // Create profile
      const { error: profileErr } = await supabase.from('user_profiles').upsert({
        id: authData.user.id,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        department: form.department || null,
        position: form.position || null,
        is_active: true,
      })

      if (profileErr) throw new Error(profileErr.message)

      setSuccess(`Пользователь ${form.full_name} успешно добавлен!`)
      setShowModal(false); setForm(EMPTY_FORM); fetch_()
      setTimeout(() => setSuccess(null), 4000)
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setSaving(false) }
  }

  async function handleChangeRole(id: string, newRole: string) {
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', id)
    fetch_()
  }

  async function handleToggleActive(user: UserProfile) {
    await supabase.from('user_profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    fetch_()
  }

  async function handleDelete(user: UserProfile) {
    if (!confirm(`Удалить пользователя ${user.full_name}?`)) return
    await supabase.from('user_profiles').delete().eq('id', user.id)
    fetch_()
  }

  const filtered = users.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[1]

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Пользователи</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление доступом к платформе</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Добавить пользователя
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего', value: users.length, c: 'text-gray-900' },
          { label: 'Администраторов', value: users.filter(u => u.role === 'admin').length, c: 'text-red-600' },
          { label: 'Наблюдателей', value: users.filter(u => u.role === 'observer').length, c: 'text-blue-600' },
          { label: 'Координаторов', value: users.filter(u => u.role === 'coordinator').length, c: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Roles info */}
      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(role => (
          <div key={role.value} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
            <div className={`p-2 rounded-lg ${role.color}`}>{role.icon}</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{role.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{role.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Поиск по имени или email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Пользователь','Email','Роль','Отдел','Статус','Дата добавления','Действия'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">Пользователей нет</td></tr>
                : filtered.map(user => {
                  const roleInfo = getRoleInfo(user.role)
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#1B8A4C]/10 rounded-full flex items-center justify-center text-[#1B8A4C] text-xs font-bold">
                            {user.full_name?.split(' ').map(n => n[0]).slice(0,2).join('') || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name || '—'}</p>
                            {user.position && <p className="text-xs text-gray-400">{user.position}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <select value={user.role} onChange={e => handleChangeRole(user.id, e.target.value)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${roleInfo.color}`}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{user.department || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleActive(user)}
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${user.is_active !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {user.is_active !== false ? 'Активен' : 'Заблокирован'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(user)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">Добавить пользователя</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600">{error}</p></div>}
              <div><label className={lbl}>Email (корп. почта) *</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="name@alif.tj" className={inp} /></div>
              <div><label className={lbl}>ФИО *</label>
                <input type="text" value={form.full_name} onChange={e => setF('full_name', e.target.value)} placeholder="Иванов Иван Иванович" className={inp} /></div>
              <div><label className={lbl}>Временный пароль *</label>
                <input type="password" value={form.password} onChange={e => setF('password', e.target.value)} placeholder="Минимум 6 символов" className={inp} /></div>
              <div><label className={lbl}>Роль</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => setF('role', r.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${form.role === r.value ? 'border-[#1B8A4C] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`inline-flex p-1 rounded mb-1 ${r.color}`}>{r.icon}</div>
                      <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Отдел</label>
                  <input type="text" value={form.department} onChange={e => setF('department', e.target.value)} placeholder="СУР" className={inp} /></div>
                <div><label className={lbl}>Должность</label>
                  <input type="text" value={form.position} onChange={e => setF('position', e.target.value)} placeholder="Риск-аналитик" className={inp} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {saving ? 'Добавление...' : <><CheckCircle2 className="w-4 h-4" /> Добавить</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

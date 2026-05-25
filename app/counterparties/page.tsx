'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Edit2, X, CheckCircle2, AlertCircle, Building2, Download, Trash2 } from 'lucide-react'

interface Counterparty {
  id: string
  code: string
  real_name: string
  inn: string
  country: string
  notes: string
  created_at: string
}

interface Assessment {
  id: string
  bank_name: string
  total_score: number
  reliability_category: string
  limit_recommendation: string
  created_at: string
}

export default function CounterpartiesPage() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ real_name: '', inn: '', country: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('counterparties').select('*').order('created_at', { ascending: false }),
      supabase.from('counterparty_assessments').select('id, bank_name, total_score, reliability_category, limit_recommendation, created_at').order('created_at', { ascending: false }),
    ])
    setCounterparties(c || [])
    setAssessments(a || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  function openEdit(c: Counterparty) {
    setEditForm({ real_name: c.real_name || '', inn: c.inn || '', country: c.country || '', notes: c.notes || '' })
    setEditingId(c.id)
    setError(null)
  }

  async function handleSave() {
    if (!editingId) return
    setSaving(true)
    const { error: e } = await supabase.from('counterparties').update({
      real_name: editForm.real_name || null,
      inn: editForm.inn || null,
      country: editForm.country || null,
      notes: editForm.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)
    if (e) { setError(e.message); setSaving(false); return }
    setEditingId(null); fetch_(); setSaving(false)
  }

  async function handleDelete(c: Counterparty) {
    const assessmentCount = assessments.filter(a => a.bank_name === c.code).length
    const msg = assessmentCount > 0
      ? `Удалить "${c.code}" из реестра? Связанные оценки (${assessmentCount}) останутся.`
      : `Удалить "${c.code}" из реестра?`
    if (!confirm(msg)) return
    await supabase.from('counterparties').delete().eq('id', c.id)
    fetch_()
  }

  function exportToExcel() {
    const headers = ['Код контрагента', 'Реальное название', 'ИНН', 'Страна', 'Примечание', 'Кол-во оценок', 'Последняя оценка', 'Лимит', 'Дата добавления']
    const rows = counterparties.map(c => {
      const ca = assessments.filter(a => a.bank_name === c.code)
      const last = ca[0]
      return [
        c.code, c.real_name || '', c.inn || '', c.country || '', c.notes || '',
        ca.length,
        last ? `${last.total_score}/60 — ${last.reliability_category}` : '—',
        last ? last.limit_recommendation : '—',
        new Date(c.created_at).toLocaleDateString('ru-RU'),
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Реестр_контрагентов_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const getAssessments = (code: string) => assessments.filter(a => a.bank_name === code)
  const scoreColor = (s: number) => s >= 50 ? 'text-green-600' : s >= 40 ? 'text-blue-600' : s >= 25 ? 'text-yellow-600' : 'text-red-600'
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Реестр контрагентов</h1>
          <p className="text-sm text-gray-500 mt-0.5">Соответствие кодов контрагентов реальным данным</p>
        </div>
        {counterparties.length > 0 && (
          <button onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Excel
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Как работает:</strong> При создании оценки аналитик вводит код контрагента (например "Контрагент-001").
          Здесь добавляется реальное название и ИНН — они не передаются в AI.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : counterparties.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Реестр пуст</p>
          <p className="text-xs mt-1">Создайте оценку контрагента — запись появится автоматически</p>
        </div>
      ) : (
        <div className="space-y-3">
          {counterparties.map(c => {
            const cAssessments = getAssessments(c.code)
            const isEditing = editingId === c.id
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1B8A4C]/10 rounded-xl flex items-center justify-center">
                        <span className="text-[#1B8A4C] font-bold text-sm">{c.code.slice(0,2).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{c.code}</p>
                        <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                          <Edit2 className="w-3.5 h-3.5" /> Заполнить данные
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      <div><p className="text-xs text-gray-400">Реальное название</p><p className="text-sm font-medium text-gray-900 mt-0.5">{c.real_name || <span className="text-gray-300 italic">не указано</span>}</p></div>
                      <div><p className="text-xs text-gray-400">ИНН</p><p className="text-sm font-medium text-gray-900 mt-0.5">{c.inn || <span className="text-gray-300 italic">не указан</span>}</p></div>
                      <div><p className="text-xs text-gray-400">Страна</p><p className="text-sm font-medium text-gray-900 mt-0.5">{c.country || '—'}</p></div>
                      <div><p className="text-xs text-gray-400">Примечание</p><p className="text-sm text-gray-600 mt-0.5">{c.notes || '—'}</p></div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {error && <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-600">{error}</p></div>}
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Реальное название</label>
                          <input type="text" value={editForm.real_name} onChange={e => setEditForm(p => ({...p, real_name: e.target.value}))} placeholder="ОАО 'Банк...'" className={inp} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">ИНН</label>
                          <input type="text" value={editForm.inn} onChange={e => setEditForm(p => ({...p, inn: e.target.value}))} placeholder="000000000" className={inp} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Страна</label>
                          <input type="text" value={editForm.country} onChange={e => setEditForm(p => ({...p, country: e.target.value}))} placeholder="Таджикистан" className={inp} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Примечание</label>
                          <input type="text" value={editForm.notes} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} placeholder="Дополнительная информация..." className={inp} /></div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Отмена</button>
                        <button onClick={handleSave} disabled={saving}
                          className="px-3 py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040] disabled:opacity-70 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {saving ? 'Сохраняется...' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  )}

                  {cAssessments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Оценки ({cAssessments.length})</p>
                      <div className="space-y-2">
                        {cAssessments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${scoreColor(a.total_score)}`}>{a.total_score}</span>
                              <span className="text-xs text-gray-500">/60 — {a.reliability_category}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-gray-700">{a.limit_recommendation}</p>
                              <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('ru-RU')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

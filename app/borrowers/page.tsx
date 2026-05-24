'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Edit2, X, CheckCircle2, AlertCircle, BookUser, Download } from 'lucide-react'
interface Borrower {
  id: string
  code: string
  real_name: string
  inn: string
  notes: string
  created_at: string
}
interface CreditConclusion {
  id: string
  borrower_name: string
  recommendation: string
  risk_level: string
  loan_amount: number
  loan_currency: string
  created_at: string
}
export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [conclusions, setConclusions] = useState<CreditConclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ real_name: '', inn: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetch_ = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from('borrowers').select('*').order('created_at', { ascending: false }),
      supabase.from('credit_conclusions').select('id, borrower_name, recommendation, risk_level, loan_amount, loan_currency, created_at').order('created_at', { ascending: false }),
    ])
    setBorrowers(b || [])
    setConclusions(c || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  function openEdit(b: Borrower) {
    setEditForm({ real_name: b.real_name || '', inn: b.inn || '', notes: b.notes || '' })
    setEditingId(b.id)
    setError(null)
  }
  async function handleSave() {
    if (!editingId) return
    setSaving(true)
    const { error: e } = await supabase.from('borrowers').update({
      real_name: editForm.real_name || null,
      inn: editForm.inn || null,
      notes: editForm.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)
    if (e) { setError(e.message); setSaving(false); return }
    setEditingId(null); fetch_(); setSaving(false)
  }
  function exportToExcel() {
    const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
    const headers = ['Код заёмщика', 'Реальное название', 'ИНН', 'Примечание', 'Кол-во заключений', 'Последнее заключение', 'Дата добавления']
    const rows = borrowers.map(b => {
      const bc = conclusions.filter(c => c.borrower_name === b.code)
      const last = bc[0]
      return [
        b.code,
        b.real_name || '',
        b.inn || '',
        b.notes || '',
        bc.length,
        last ? `${last.recommendation} — ${fmt(last.loan_amount)} ${last.loan_currency}` : '—',
        new Date(b.created_at).toLocaleDateString('ru-RU'),
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Реестр_заёмщиков_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const getConclusions = (code: string) => conclusions.filter(c => c.borrower_name === code)
  const riskColor = (l: string) => l === 'Высокий' ? 'bg-red-100 text-red-800' : l === 'Средний' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  const recColor = (r: string) => r?.includes('Отклонить') ? 'text-red-600' : r?.includes('Условно') ? 'text-yellow-600' : 'text-green-600'
  const fmt = (v: number) => v ? new Intl.NumberFormat('ru-RU').format(Math.round(v)) : '—'
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Реестр заёмщиков</h1>
          <p className="text-sm text-gray-500 mt-0.5">Соответствие кодов заёмщиков реальным данным</p>
        </div>
        {borrowers.length > 0 && (
          <button onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Excel
          </button>
        )}
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Как работает:</strong> При генерации заключения аналитик вводит код заёмщика (например "Заёмщик-001"). 
          Здесь можно добавить реальное имя и ИНН — они хранятся отдельно и не передаются в AI.
        </p>
      </div>
      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : borrowers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <BookUser className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Реестр пуст</p>
          <p className="text-xs mt-1">Создайте заключение в кредитном риске — запись появится автоматически</p>
        </div>
      ) : (
        <div className="space-y-3">
          {borrowers.map(b => {
            const bConclusions = getConclusions(b.code)
            const isEditing = editingId === b.id
            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1B8A4C]/10 rounded-xl flex items-center justify-center">
                        <span className="text-[#1B8A4C] font-bold text-sm">{b.code.slice(0,2).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{b.code}</p>
                        <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                    {!isEditing && (
                      <button onClick={() => openEdit(b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                        <Edit2 className="w-3.5 h-3.5" /> Заполнить данные
                      </button>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Реальное название</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{b.real_name || <span className="text-gray-300 italic">не указано</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">ИНН</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{b.inn || <span className="text-gray-300 italic">не указан</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Примечание</p>
                        <p className="text-sm text-gray-600 mt-0.5">{b.notes || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {error && <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-600">{error}</p></div>}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Реальное название</label>
                          <input type="text" value={editForm.real_name} onChange={e => setEditForm(p => ({...p, real_name: e.target.value}))} placeholder="ООО 'Компания'" className={inp} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">ИНН</label>
                          <input type="text" value={editForm.inn} onChange={e => setEditForm(p => ({...p, inn: e.target.value}))} placeholder="000000000" className={inp} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Примечание</label>
                        <input type="text" value={editForm.notes} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} placeholder="Дополнительная информация..." className={inp} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Отмена
                        </button>
                        <button onClick={handleSave} disabled={saving}
                          className="px-3 py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040] disabled:opacity-70 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {saving ? 'Сохраняется...' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  )}
                  {bConclusions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Заключения ({bConclusions.length})</p>
                      <div className="space-y-2">
                        {bConclusions.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${recColor(c.recommendation)}`}>{c.recommendation}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${riskColor(c.risk_level)}`}>{c.risk_level}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-gray-700">{fmt(c.loan_amount)} {c.loan_currency}</p>
                              <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ru-RU')}</p>
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

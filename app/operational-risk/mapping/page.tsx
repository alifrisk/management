'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, Filter, ChevronDown } from 'lucide-react'

interface RiskItem {
  id: string
  business_process: string
  risk_name: string
  probability: string
  impact: string
  score: number
  risk_level: string
  responsible: string
  mitigation: string
  created_at: string
}

const BUSINESS_PROCESSES = ['Кредитование', 'Депозит', 'Платежная карта', 'Касса', 'IT', 'Другое']

const PROBABILITY_OPTIONS = [
  { label: 'Маловероятно', value: 'Маловероятно', score: 1 },
  { label: 'Возможно', value: 'Возможно', score: 2 },
  { label: 'Весьма вероятно', value: 'Весьма вероятно', score: 3 },
]

const IMPACT_OPTIONS = [
  { label: 'Незначительное', value: 'Незначительное', score: 1 },
  { label: 'Умеренное', value: 'Умеренное', score: 2 },
  { label: 'Существенное', value: 'Существенное', score: 3 },
]

function calcScore(probability: string, impact: string): number {
  const p = PROBABILITY_OPTIONS.find(o => o.value === probability)?.score || 0
  const i = IMPACT_OPTIONS.find(o => o.value === impact)?.score || 0
  return p * i
}

function calcLevel(score: number): string {
  if (score <= 2) return 'Низкий'
  if (score <= 4) return 'Средний'
  return 'Высокий'
}

function getRiskColor(level: string) {
  if (level === 'Высокий') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' }
  if (level === 'Средний') return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' }
  return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' }
}

function MatrixCell({ p, i, risks }: { p: number; i: number; risks: RiskItem[] }) {
  const score = p * i
  const level = calcLevel(score)
  const cellRisks = risks.filter(r => {
    const ps = PROBABILITY_OPTIONS.find(o => o.value === r.probability)?.score
    const is_ = IMPACT_OPTIONS.find(o => o.value === r.impact)?.score
    return ps === p && is_ === i
  })
  const colors = getRiskColor(level)

  return (
    <div className={`border-2 rounded-lg p-2 min-h-[70px] ${colors.bg} ${colors.border}`}>
      <div className={`text-xs font-bold mb-1 ${colors.text}`}>{score}</div>
      {cellRisks.length > 0 ? (
        <div className="space-y-1">
          {cellRisks.map(r => (
            <div key={r.id} className={`text-xs px-1.5 py-0.5 rounded font-medium truncate ${colors.badge}`} title={r.risk_name}>
              {r.risk_name.length > 20 ? r.risk_name.slice(0, 20) + '…' : r.risk_name}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-300">—</div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  business_process: 'Кредитование',
  risk_name: '',
  probability: 'Возможно',
  impact: 'Умеренное',
  responsible: '',
  mitigation: '',
}

export default function MappingPage() {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterProcess, setFilterProcess] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [activeProcess, setActiveProcess] = useState<string | null>(null)

  const fetchRisks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('risk_maps')
      .select('*')
      .order('created_at', { ascending: false })
    setRisks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRisks() }, [fetchRisks])

  async function handleSave() {
    if (!formData.risk_name.trim()) { setError('Введите название риска'); return }
    setSaving(true)
    setError(null)
    const score = calcScore(formData.probability, formData.impact)
    const risk_level = calcLevel(score)
    const payload = { ...formData, score, risk_level }

    let err
    if (editingId) {
      const { error: e } = await supabase.from('risk_maps').update(payload).eq('id', editingId)
      err = e
    } else {
      const { error: e } = await supabase.from('risk_maps').insert(payload)
      err = e
    }
    if (err) { setError('Ошибка: ' + err.message); setSaving(false); return }
    setShowModal(false)
    setFormData(EMPTY_FORM)
    setEditingId(null)
    fetchRisks()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить риск?')) return
    await supabase.from('risk_maps').delete().eq('id', id)
    fetchRisks()
  }

  function openEdit(risk: RiskItem) {
    setFormData({
      business_process: risk.business_process,
      risk_name: risk.risk_name,
      probability: risk.probability,
      impact: risk.impact,
      responsible: risk.responsible || '',
      mitigation: risk.mitigation || '',
    })
    setEditingId(risk.id)
    setShowModal(true)
  }

  const filtered = risks.filter(r => {
    if (filterProcess && r.business_process !== filterProcess) return false
    if (filterLevel && r.risk_level !== filterLevel) return false
    return true
  })

  const grouped = BUSINESS_PROCESSES.reduce((acc, bp) => {
    acc[bp] = filtered.filter(r => r.business_process === bp)
    return acc
  }, {} as Record<string, RiskItem[]>)

  const totalHigh = risks.filter(r => r.risk_level === 'Высокий').length
  const totalMedium = risks.filter(r => r.risk_level === 'Средний').length
  const totalLow = risks.filter(r => r.risk_level === 'Низкий').length

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Картирование операционных рисков</h1>
          <p className="text-sm text-gray-500 mt-0.5">Реестр рисков по бизнес-процессам</p>
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setEditingId(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]"
        >
          <Plus className="w-4 h-4" /> Добавить риск
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{totalHigh}</p>
          <p className="text-xs font-medium text-red-600 mt-0.5">Высокий риск</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-700">{totalMedium}</p>
          <p className="text-xs font-medium text-yellow-600 mt-0.5">Средний риск</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{totalLow}</p>
          <p className="text-xs font-medium text-green-600 mt-0.5">Низкий риск</p>
        </div>
      </div>

      {/* Heat Matrix */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Тепловая матрица рисков (Вероятность × Влияние)</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="flex">
              <div className="w-28 flex-shrink-0" />
              <div className="flex-1 grid grid-cols-3 gap-1 mb-1">
                {IMPACT_OPTIONS.map(i => (
                  <div key={i.value} className="text-center text-xs text-gray-500 font-medium">{i.label}</div>
                ))}
              </div>
            </div>
            {[...PROBABILITY_OPTIONS].reverse().map(p => (
              <div key={p.value} className="flex gap-1 mb-1">
                <div className="w-28 flex-shrink-0 flex items-center">
                  <span className="text-xs text-gray-500 font-medium">{p.label}</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {IMPACT_OPTIONS.map(i => (
                    <MatrixCell key={i.value} p={p.score} i={i.score} risks={filterProcess ? risks.filter(r => r.business_process === filterProcess) : risks} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Легенда:</span>
              {[{ color: 'bg-green-100 border-green-200', label: 'Низкий (1-2)' }, { color: 'bg-yellow-100 border-yellow-200', label: 'Средний (3-4)' }, { color: 'bg-red-100 border-red-200', label: 'Высокий (6-9)' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded border ${l.color}`} />
                  <span className="text-xs text-gray-600">{l.label}</span>
                </div>
              ))}
              {filterProcess && <span className="text-xs text-[#1B8A4C] font-medium">Фильтр: {filterProcess}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <select value={filterProcess} onChange={e => setFilterProcess(e.target.value)} className={inputCls + ' w-48'}>
          <option value="">Все бизнес-процессы</option>
          {BUSINESS_PROCESSES.map(bp => <option key={bp} value={bp}>{bp}</option>)}
        </select>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className={inputCls + ' w-36'}>
          <option value="">Все уровни</option>
          <option value="Высокий">Высокий</option>
          <option value="Средний">Средний</option>
          <option value="Низкий">Низкий</option>
        </select>
        {(filterProcess || filterLevel) && (
          <button onClick={() => { setFilterProcess(''); setFilterLevel('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">Найдено: {filtered.length} рисков</span>
      </div>

      {/* Risks by business process */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {BUSINESS_PROCESSES.map(bp => {
            const bpRisks = grouped[bp] || []
            if (bpRisks.length === 0 && (filterProcess || filterLevel)) return null
            const isOpen = activeProcess === bp || !filterProcess
            return (
              <div key={bp} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setActiveProcess(isOpen && activeProcess === bp ? null : bp)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 text-sm">{bp}</span>
                    <span className="text-xs text-gray-400">{bpRisks.length} рисков</span>
                    {bpRisks.filter(r => r.risk_level === 'Высокий').length > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {bpRisks.filter(r => r.risk_level === 'Высокий').length} высоких
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${activeProcess === bp ? 'rotate-180' : ''}`} />
                </button>

                {(activeProcess === bp || bpRisks.length > 0) && (
                  <div className="border-t border-gray-100">
                    {bpRisks.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">Рисков нет — нажмите "Добавить риск"</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">№</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Риск</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Вероятность</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Влияние</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Оценка</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Уровень</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ответственный</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Действия</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bpRisks.map((risk, idx) => {
                              const colors = getRiskColor(risk.risk_level)
                              return (
                                <tr key={risk.id} className="hover:bg-gray-50">
                                  <td className="px-5 py-3 text-gray-500 text-xs">{idx + 1}</td>
                                  <td className="px-4 py-3 max-w-xs">
                                    <p className="text-sm font-medium text-gray-900">{risk.risk_name}</p>
                                    {risk.mitigation && <p className="text-xs text-gray-500 mt-0.5 truncate">{risk.mitigation}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{risk.probability}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{risk.impact}</td>
                                  <td className="px-4 py-3 font-bold text-sm text-gray-900">{risk.score}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                                      {risk.risk_level}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{risk.responsible || '—'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => openEdit(risk)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDelete(risk.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Редактировать риск' : 'Добавить риск'}</h2>
              <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div>
                <label className={labelCls}>Бизнес-процесс *</label>
                <select value={formData.business_process} onChange={e => setFormData(p => ({...p, business_process: e.target.value}))} className={inputCls}>
                  {BUSINESS_PROCESSES.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Название риска *</label>
                <textarea value={formData.risk_name} onChange={e => setFormData(p => ({...p, risk_name: e.target.value}))} rows={3} placeholder="Описание риска..." className={inputCls + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Вероятность *</label>
                  <select value={formData.probability} onChange={e => setFormData(p => ({...p, probability: e.target.value}))} className={inputCls}>
                    {PROBABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Влияние *</label>
                  <select value={formData.impact} onChange={e => setFormData(p => ({...p, impact: e.target.value}))} className={inputCls}>
                    {IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Preview score */}
              {formData.probability && formData.impact && (
                <div className={`p-3 rounded-lg border-2 ${getRiskColor(calcLevel(calcScore(formData.probability, formData.impact))).bg} ${getRiskColor(calcLevel(calcScore(formData.probability, formData.impact))).border}`}>
                  <p className="text-xs text-gray-500">Оценка риска (автоматически)</p>
                  <p className={`text-xl font-bold mt-0.5 ${getRiskColor(calcLevel(calcScore(formData.probability, formData.impact))).text}`}>
                    {calcLevel(calcScore(formData.probability, formData.impact))} · {calcScore(formData.probability, formData.impact)} баллов
                  </p>
                </div>
              )}
              <div>
                <label className={labelCls}>Ответственный</label>
                <input type="text" value={formData.responsible} onChange={e => setFormData(p => ({...p, responsible: e.target.value}))} placeholder="ФИО ответственного" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Меры по снижению риска</label>
                <textarea value={formData.mitigation} onChange={e => setFormData(p => ({...p, mitigation: e.target.value}))} rows={2} placeholder="Мероприятия по митигации..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-70">
                {saving ? 'Сохранение...' : <><CheckCircle2 className="w-4 h-4" /> Сохранить</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

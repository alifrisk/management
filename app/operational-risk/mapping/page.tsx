'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, ChevronDown, Eye, Download, ClipboardList } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

// ✅ Генерируем буквы для рисков в матрице
function getRiskLetter(risk: RiskItem, allRisks: RiskItem[]): string {
  const sorted = [...allRisks].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const idx = sorted.findIndex(r => r.id === risk.id)
  if (idx < 0) return '?'
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (idx < 26) return letters[idx]
  return `${letters[Math.floor(idx/26)-1]}${letters[idx%26]}`
}

function MatrixCell({ p, i, risks, allRisks, onView }: {
  p: number; i: number; risks: RiskItem[]; allRisks: RiskItem[]
  onView: (r: RiskItem) => void
}) {
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
        <div className="flex flex-wrap gap-1">
          {cellRisks.map(r => (
            <button
              key={r.id}
              onClick={() => onView(r)}
              title={r.risk_name}
              className={`text-xs px-1.5 py-0.5 rounded font-bold hover:opacity-80 transition-opacity cursor-pointer ${colors.badge}`}
            >
              {getRiskLetter(r, allRisks)}
            </button>
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
  const [viewingRisk, setViewingRisk] = useState<RiskItem | null>(null)
  const router = useRouter()

  const fetchRisks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('risk_maps').select('*').order('created_at', { ascending: false })
    setRisks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRisks() }, [fetchRisks])

  function createRecommendation(risk: RiskItem) {
    // Save risk data to sessionStorage so recommendations page can pre-fill
    sessionStorage.setItem('new_rec_prefill', JSON.stringify({
      title: `Снижение риска: ${risk.risk_name}`,
      source_type: 'initiative',
      report_name: `Карта рисков — ${risk.business_process}`,
      priority: risk.risk_level === 'Высокий' ? 'Высокий' : risk.risk_level === 'Средний' ? 'Средний' : 'Низкий',
      description: risk.mitigation || '',
      responsible: risk.responsible || '',
    }))
    router.push('/recommendations')
  }

  async function handleSave() {
    if (!formData.risk_name.trim()) { setError('Введите название риска'); return }
    setSaving(true); setError(null)
    const score = calcScore(formData.probability, formData.impact)
    const risk_level = calcLevel(score)
    const payload = { ...formData, score, risk_level }
    let err
    if (editingId) {
      const { error: e } = await supabase.from('risk_maps').update(payload).eq('id', editingId); err = e
    } else {
      const { error: e } = await supabase.from('risk_maps').insert(payload); err = e
    }
    if (err) { setError('Ошибка: ' + err.message); setSaving(false); return }
    setShowModal(false); setFormData(EMPTY_FORM); setEditingId(null); fetchRisks(); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить риск?')) return
    await supabase.from('risk_maps').delete().eq('id', id)
    fetchRisks()
  }

  function openEdit(risk: RiskItem) {
    setFormData({
      business_process: risk.business_process, risk_name: risk.risk_name,
      probability: risk.probability, impact: risk.impact,
      responsible: risk.responsible || '', mitigation: risk.mitigation || '',
    })
    setEditingId(risk.id); setShowModal(true)
  }

  // ✅ Скачать матрицу как CSV
  function handleDownload() {
    const headers = ['Буква','Бизнес-процесс','Риск','Вероятность','Влияние','Оценка','Уровень','Ответственный','Меры митигации']
    const rows = [...risks]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r, idx) => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const letter = idx < 26 ? letters[idx] : `${letters[Math.floor(idx/26)-1]}${letters[idx%26]}`
        return [letter, r.business_process, r.risk_name, r.probability, r.impact, r.score, r.risk_level, r.responsible || '', r.mitigation || '']
      })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Картирование_рисков_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
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
    <div className="max-w-7xl mx-auto">

      {/* Sticky: заголовок + KPI */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Картирование операционных рисков</h1>
            <p className="text-sm text-gray-500 mt-0.5">Реестр рисков по бизнес-процессам</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white">
              <Download className="w-4 h-4" /> Скачать Excel
            </button>
            <button onClick={() => { setFormData(EMPTY_FORM); setEditingId(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
              <Plus className="w-4 h-4" /> Добавить риск
            </button>
          </div>
        </div>
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
      </div>

      <div className="space-y-5 mt-5">

      {/* Heat Matrix */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Тепловая матрица рисков (Вероятность × Влияние)</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="flex">
              <div className="w-32 flex-shrink-0" />
              <div className="flex-1 grid grid-cols-3 gap-1 mb-1">
                {IMPACT_OPTIONS.map(i => (
                  <div key={i.value} className="text-center text-xs text-gray-500 font-medium">{i.label}</div>
                ))}
              </div>
            </div>
            {[...PROBABILITY_OPTIONS].reverse().map(p => (
              <div key={p.value} className="flex gap-1 mb-1">
                <div className="w-32 flex-shrink-0 flex items-center">
                  <span className="text-xs text-gray-500 font-medium">{p.label}</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {IMPACT_OPTIONS.map(i => (
                    <MatrixCell
                      key={i.value} p={p.score} i={i.score}
                      risks={filterProcess ? risks.filter(r => r.business_process === filterProcess) : risks}
                      allRisks={risks}
                      onView={setViewingRisk}
                    />
                  ))}
                </div>
              </div>
            ))}
            {/* Легенда + расшифровка букв */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              <span className="text-xs text-gray-500">Легенда:</span>
              {[{ color: 'bg-green-100 border-green-200', label: 'Низкий (1-2)' }, { color: 'bg-yellow-100 border-yellow-200', label: 'Средний (3-4)' }, { color: 'bg-red-100 border-red-200', label: 'Высокий (6-9)' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded border ${l.color}`} />
                  <span className="text-xs text-gray-600">{l.label}</span>
                </div>
              ))}
              <span className="text-xs text-gray-400 ml-auto">Нажмите на букву для просмотра риска</span>
            </div>
            {/* Расшифровка букв */}
            {risks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Расшифровка:</p>
                <div className="flex flex-wrap gap-2">
                  {[...risks].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r, idx) => {
                    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                    const letter = idx < 26 ? letters[idx] : `${letters[Math.floor(idx/26)-1]}${letters[idx%26]}`
                    const colors = getRiskColor(r.risk_level)
                    return (
                      <button key={r.id} onClick={() => setViewingRisk(r)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${colors.bg} ${colors.border} hover:opacity-80`}>
                        <span className={`font-bold ${colors.text}`}>{letter}</span>
                        <span className="text-gray-600 max-w-[120px] truncate">{r.risk_name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
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
            return (
              <div key={bp} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setActiveProcess(activeProcess === bp ? null : bp)}
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

                {activeProcess === bp && (
                  <div className="border-t border-gray-100">
                    {bpRisks.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">Рисков нет — нажмите "Добавить риск"</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Код</th>
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
                            {bpRisks.map(risk => {
                              const colors = getRiskColor(risk.risk_level)
                              const letter = getRiskLetter(risk, risks)
                              return (
                                <tr key={risk.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>{letter}</span>
                                  </td>
                                  <td className="px-4 py-3 max-w-xs">
                                    <p className="text-sm font-medium text-gray-900">{risk.risk_name}</p>
                                    {risk.mitigation && <p className="text-xs text-gray-500 mt-0.5 truncate">{risk.mitigation}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{risk.probability}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{risk.impact}</td>
                                  <td className="px-4 py-3 font-bold text-sm text-gray-900">{risk.score}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>{risk.risk_level}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{risk.responsible || '—'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => setViewingRisk(risk)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => openEdit(risk)} className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleDelete(risk.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
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

      </div>{/* end space-y-5 */}

      {/* View Risk Modal */}
      {viewingRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${getRiskColor(viewingRisk.risk_level).badge}`}>
                  {getRiskLetter(viewingRisk, risks)}
                </span>
                <h2 className="text-base font-semibold text-gray-900">Карточка риска</h2>
              </div>
              <button onClick={() => setViewingRisk(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500">Название риска</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{viewingRisk.risk_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Бизнес-процесс', viewingRisk.business_process],
                  ['Уровень риска', viewingRisk.risk_level],
                  ['Вероятность', viewingRisk.probability],
                  ['Влияние', viewingRisk.impact],
                  ['Оценка', String(viewingRisk.score)],
                  ['Ответственный', viewingRisk.responsible || '—'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-gray-500">{l}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {viewingRisk.mitigation && (
                <div>
                  <p className="text-xs text-gray-500">Меры по снижению риска</p>
                  <p className="text-sm text-gray-700 mt-0.5 bg-gray-50 rounded-lg p-3">{viewingRisk.mitigation}</p>
                </div>
              )}
              <div className={`p-3 rounded-xl border-2 ${getRiskColor(viewingRisk.risk_level).bg} ${getRiskColor(viewingRisk.risk_level).border}`}>
                <p className={`text-lg font-bold ${getRiskColor(viewingRisk.risk_level).text}`}>
                  {viewingRisk.risk_level} риск · {viewingRisk.score} баллов
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => createRecommendation(viewingRisk)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <ClipboardList className="w-4 h-4" /> Создать рекомендацию
              </button>
              <button onClick={() => { setViewingRisk(null); openEdit(viewingRisk) }}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
                <Edit2 className="w-4 h-4" /> Редактировать
              </button>
              <button onClick={() => setViewingRisk(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
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

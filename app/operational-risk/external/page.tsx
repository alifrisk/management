'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, X, Trash2, Eye, Download, Filter, Globe, AlertTriangle, CheckCircle, Minus } from 'lucide-react'

const PAGE_SIZE  = 20
const RISK_TYPES = ['Внутреннее мошенничество','Внешнее мошенничество','Технологический сбой','Операционная ошибка','Юридический риск','Киберинцидент','Другое']
const RELEVANCE  = ['Высокая','Средняя','Низкая']
const COUNTRIES  = ['Таджикистан','Россия','Казахстан','Узбекистан','Кыргызстан','Азербайджан','Грузия','США','Германия','Великобритания','Китай','ОАЭ','Другое']

interface Incident {
  id: string
  incident_date: string
  organization: string
  country: string | null
  risk_type: string | null
  description: string | null
  loss_amount: number | null
  loss_currency: string
  source_url: string | null
  relevance: string
  lesson: string | null
  analyst_name: string | null
  created_at: string
}

const EMPTY = {
  incident_date: '', organization: '', country: '', risk_type: '',
  description: '', loss_amount: '', loss_currency: 'USD',
  source_url: '', relevance: 'Средняя', lesson: '', analyst_name: ''
}

const fmt   = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const fmtN  = (v: string) => { const n = v.replace(/\D/g,''); return n ? new Intl.NumberFormat('ru-RU').format(Number(n)) : '' }
const parseN = (v: string) => Number(v.replace(/\D/g,'')) || 0

const relColor = (r: string) =>
  r === 'Высокая' ? 'bg-red-50 text-red-700 border-red-200' :
  r === 'Средняя' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
  'bg-green-50 text-green-700 border-green-200'

const relIcon = (r: string) =>
  r === 'Высокая' ? <AlertTriangle className="w-3 h-3" /> :
  r === 'Средняя' ? <Minus className="w-3 h-3" /> :
  <CheckCircle className="w-3 h-3" />

export default function ExternalIncidentsPage() {
  const [incidents, setIncidents]   = useState<Incident[]>([])
  const [loading,   setLoading]     = useState(true)
  const [showForm,  setShowForm]    = useState(false)
  const [form,      setForm]        = useState<Record<string,string>>(EMPTY)
  const [saving,    setSaving]      = useState(false)
  const [viewing,   setViewing]     = useState<Incident | null>(null)
  const [filterRel,  setFilterRel]  = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth,setFilterMonth]= useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('external_incidents').select('*').order('incident_date', { ascending: false })
    if (filterRel)  q = q.eq('relevance', filterRel)
    if (filterType) q = q.eq('risk_type', filterType)
    if (filterYear) q = q.gte('incident_date', `${filterYear}-01-01`).lte('incident_date', `${filterYear}-12-31`)
    if (filterYear && filterMonth) q = q.gte('incident_date', `${filterYear}-${filterMonth.padStart(2,'0')}-01`).lte('incident_date', `${filterYear}-${filterMonth.padStart(2,'0')}-31`)
    const { data } = await q
    setIncidents(data || [])
    setLoading(false)
  }, [filterRel, filterType, filterYear, filterMonth])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.organization.trim() || !form.incident_date) return
    setSaving(true)
    await supabase.from('external_incidents').insert({
      incident_date:  form.incident_date,
      organization:   form.organization,
      country:        form.country || null,
      risk_type:      form.risk_type || null,
      description:    form.description || null,
      loss_amount:    form.loss_amount ? parseN(form.loss_amount) : null,
      loss_currency:  form.loss_currency,
      source_url:     form.source_url || null,
      relevance:      form.relevance,
      lesson:         form.lesson || null,
      analyst_name:   form.analyst_name || null,
    })
    setShowForm(false); setForm(EMPTY); setSaving(false); fetch_()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    await supabase.from('external_incidents').delete().eq('id', id)
    fetch_()
  }

  function exportExcel() {
    const rows = [
      ['Дата','Организация','Страна','Тип риска','Описание','Сумма потерь','Валюта','Источник','Применимость к Алиф','Урок','Аналитик'],
      ...incidents.map(i => [
        i.incident_date, i.organization, i.country||'', i.risk_type||'',
        i.description||'', String(i.loss_amount||''), i.loss_currency,
        i.source_url||'', i.relevance, i.lesson||'', i.analyst_name||''
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Внешние_инциденты_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  const totalPages = Math.ceil(incidents.length / PAGE_SIZE)
  const paginated  = incidents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto">

      {/* Sticky: заголовок + KPI */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 bg-[#F5F8F6]" style={{boxShadow: '0 2px 12px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Реестр внешних инцидентов</h1>
            <p className="text-sm text-gray-500 mt-0.5">External Loss Database — инциденты из СМИ и открытых источников</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => { setForm(EMPTY); setShowForm(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
              <Plus className="w-4 h-4" /> Добавить инцидент
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: 'Всего инцидентов', v: incidents.length, c: 'text-gray-900' },
            { l: 'Высокая применимость', v: incidents.filter(i => i.relevance === 'Высокая').length, c: 'text-red-600' },
            { l: 'Средняя применимость', v: incidents.filter(i => i.relevance === 'Средняя').length, c: 'text-yellow-600' },
            { l: 'За этот год', v: incidents.filter(i => new Date(i.incident_date).getFullYear() === new Date().getFullYear()).length, c: 'text-blue-600' },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 mt-5">

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterRel} onChange={e => { setFilterRel(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все применимости</option>
          {RELEVANCE.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все типы риска</option>
          {RISK_TYPES.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(''); setCurrentPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все годы</option>
          {[2026,2025,2024,2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все месяцы</option>
          {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((m,i) =>
            <option key={i} value={String(i+1)}>{m}</option>
          )}
        </select>
        {(filterRel || filterType || filterYear || filterMonth) && (
          <button onClick={() => { setFilterRel(''); setFilterType(''); setFilterYear(''); setFilterMonth(''); setCurrentPage(1) }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Дата','Организация','Страна','Тип риска','Сумма потерь','Применимость','Аналитик',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : incidents.length === 0
                ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Нет записей</td></tr>
                : paginated.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(i.incident_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-40">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{i.organization}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{i.country || '—'}</td>
                    <td className="px-4 py-3">
                      {i.risk_type && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{i.risk_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600 whitespace-nowrap">
                      {i.loss_amount ? `${i.loss_currency} ${fmt(i.loss_amount)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${relColor(i.relevance)}`}>
                        {relIcon(i.relevance)} {i.relevance}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{i.analyst_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(i)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(i.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {incidents.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Показано {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, incidents.length)} из {incidents.length} инцидентов
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">←</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                  const p = totalPages <= 7 ? idx + 1 : currentPage <= 4 ? idx + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + idx : currentPage - 3 + idx
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

      </div>{/* end space-y-5 mt-5 */}

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">{viewing.organization}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(viewing.incident_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                  {viewing.country ? ` · ${viewing.country}` : ''}
                </p>
              </div>
              <button onClick={() => setViewing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Тип риска', v: viewing.risk_type || '—' },
                  { l: 'Страна', v: viewing.country || '—' },
                  { l: 'Сумма потерь', v: viewing.loss_amount ? `${viewing.loss_currency} ${fmt(viewing.loss_amount)}` : '—' },
                  { l: 'Применимость к Алиф', v: viewing.relevance },
                ].map(s => (
                  <div key={s.l} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{s.l}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{s.v}</p>
                  </div>
                ))}
              </div>
              {viewing.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание инцидента</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-sm text-gray-800">{viewing.description}</p>
                  </div>
                </div>
              )}
              {viewing.lesson && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Урок / Рекомендация для Алиф</p>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <p className="text-sm text-gray-800">{viewing.lesson}</p>
                  </div>
                </div>
              )}
              {viewing.source_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Источник</p>
                  <a href={viewing.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all">{viewing.source_url}</a>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setViewing(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">Новый внешний инцидент</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Дата инцидента *</label>
                  <input type="date" value={form.incident_date} max={new Date().toISOString().split('T')[0]}
                    onChange={e => setF('incident_date', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Организация *</label>
                  <input type="text" value={form.organization} onChange={e => setF('organization', e.target.value)}
                    placeholder="Банк ABC" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Страна</label>
                  <select value={form.country} onChange={e => setF('country', e.target.value)} className={inp}>
                    <option value="">— Выберите —</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Тип риска</label>
                  <select value={form.risk_type} onChange={e => setF('risk_type', e.target.value)} className={inp}>
                    <option value="">— Выберите —</option>
                    {RISK_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Сумма потерь</label>
                  <input type="text" inputMode="numeric" value={form.loss_amount}
                    onChange={e => setF('loss_amount', fmtN(e.target.value))} placeholder="0" className={`${inp} text-right`} />
                </div>
                <div>
                  <label className={lbl}>Валюта</label>
                  <select value={form.loss_currency} onChange={e => setF('loss_currency', e.target.value)} className={inp}>
                    {['USD','EUR','RUB','TJS','KZT'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Применимость к Алиф</label>
                  <select value={form.relevance} onChange={e => setF('relevance', e.target.value)} className={inp}>
                    {RELEVANCE.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Аналитик</label>
                  <input type="text" value={form.analyst_name} onChange={e => setF('analyst_name', e.target.value)}
                    placeholder="ФИО" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Описание инцидента</label>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)}
                  rows={3} placeholder="Краткое описание из СМИ..." className={`${inp} resize-none`} />
              </div>
              <div>
                <label className={lbl}>Урок / Рекомендация для Алиф</label>
                <textarea value={form.lesson} onChange={e => setF('lesson', e.target.value)}
                  rows={2} placeholder="Что следует учесть..." className={`${inp} resize-none`} />
              </div>
              <div>
                <label className={lbl}>Источник (ссылка)</label>
                <input type="url" value={form.source_url} onChange={e => setF('source_url', e.target.value)}
                  placeholder="https://..." className={inp} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={saving || !form.organization || !form.incident_date}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {saving ? 'Сохранение...' : <><Plus className="w-4 h-4" /> Сохранить</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

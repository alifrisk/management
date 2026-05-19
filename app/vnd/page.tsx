'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Plus, Download, Eye, Trash2, X, Upload, FileText, AlertTriangle, CheckCircle, Clock, Filter, Search, History } from 'lucide-react'

interface VNDDocument {
  id: string
  title: string
  category: string
  document_number: string
  status: string
  approved_date: string
  review_date: string
  version: string
  description: string
  file_path: string
  file_name: string
  file_size: number
  file_type: string
  uploaded_by: string
  created_at: string
  updated_at: string
}

interface DocumentVersion {
  id: string
  document_id: string
  version: string
  file_path: string
  file_name: string
  changed_by: string
  change_notes: string
  created_at: string
}

const CATEGORIES = ['Политика', 'Процедура', 'Инструкция', 'Методология', 'Регламент', 'Положение', 'Другое']
const STATUSES = ['Действующий', 'На пересмотре', 'Архив']

function getDaysUntilReview(reviewDate: string): number | null {
  if (!reviewDate) return null
  const diff = new Date(reviewDate).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getStatusInfo(doc: VNDDocument) {
  const days = getDaysUntilReview(doc.review_date)
  if (doc.status === 'Архив') return { color: 'bg-gray-100 text-gray-600', icon: null, label: 'Архив' }
  if (doc.status === 'На пересмотре') return { color: 'bg-yellow-100 text-yellow-700', icon: '⚠️', label: 'На пересмотре' }
  if (days !== null && days <= 0) return { color: 'bg-red-100 text-red-700', icon: '🔴', label: 'Истёк' }
  if (days !== null && days <= 30) return { color: 'bg-orange-100 text-orange-700', icon: '🟠', label: `Истекает через ${days} дн.` }
  return { color: 'bg-green-100 text-green-700', icon: '✅', label: 'Действующий' }
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

const EMPTY_FORM = {
  title: '', category: 'Политика', document_number: '',
  status: 'Действующий', approved_date: '', review_date: '',
  version: '1.0', description: '', uploaded_by: '',
}

export default function VNDPage() {
  const [docs, setDocs] = useState<VNDDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showVersions, setShowVersions] = useState<VNDDocument | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newVersionDoc, setNewVersionDoc] = useState<VNDDocument | null>(null)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [newVersionNotes, setNewVersionNotes] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vnd_documents').select('*').order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) { setError('Введите название документа'); return }
    if (!file && !editingId) { setError('Выберите файл для загрузки'); return }
    setUploading(true); setError(null)

    try {
      let filePath = ''
      let fileName = ''
      let fileSize = 0
      let fileType = ''

      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}_${file.name.replace(/\s/g, '_')}`
        const { error: uploadErr } = await supabase.storage.from('vnd-documents').upload(path, file)
        if (uploadErr) throw new Error('Ошибка загрузки файла: ' + uploadErr.message)
        filePath = path
        fileName = file.name
        fileSize = file.size
        fileType = ext || ''
      }

      const payload = {
        title: form.title, category: form.category,
        document_number: form.document_number || null,
        status: form.status,
        approved_date: form.approved_date || null,
        review_date: form.review_date || null,
        version: form.version,
        description: form.description || null,
        uploaded_by: form.uploaded_by || null,
        updated_at: new Date().toISOString(),
        ...(file ? { file_path: filePath, file_name: fileName, file_size: fileSize, file_type: fileType } : {}),
      }

      if (editingId) {
        const { error: e } = await supabase.from('vnd_documents').update(payload).eq('id', editingId)
        if (e) throw new Error(e.message)
      } else {
        const { error: e } = await supabase.from('vnd_documents').insert(payload)
        if (e) throw new Error(e.message)
      }

      setShowModal(false); setForm(EMPTY_FORM); setFile(null); setEditingId(null)
      fetch_()
    } catch (err: unknown) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setUploading(false) }
  }

  async function handleDownload(doc: VNDDocument) {
    if (!doc.file_path) { alert('Файл не найден'); return }
    const { data, error } = await supabase.storage.from('vnd-documents').download(doc.file_path)
    if (error || !data) { alert('Ошибка скачивания'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = doc.file_name || doc.title; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(doc: VNDDocument) {
    if (!confirm('Удалить документ?')) return
    if (doc.file_path) await supabase.storage.from('vnd-documents').remove([doc.file_path])
    await supabase.from('vnd_documents').delete().eq('id', doc.id)
    fetch_()
  }

  async function loadVersions(doc: VNDDocument) {
    const { data } = await supabase.from('vnd_document_versions').select('*').eq('document_id', doc.id).order('created_at', { ascending: false })
    setVersions(data || [])
    setShowVersions(doc)
  }

  async function handleNewVersion() {
    if (!newVersionDoc || !newVersionFile) return
    setUploading(true)
    try {
      const path = `${Date.now()}_${newVersionFile.name.replace(/\s/g, '_')}`
      const { error: uploadErr } = await supabase.storage.from('vnd-documents').upload(path, newVersionFile)
      if (uploadErr) throw new Error(uploadErr.message)

      // Save version history
      await supabase.from('vnd_document_versions').insert({
        document_id: newVersionDoc.id,
        version: newVersionDoc.version,
        file_path: newVersionDoc.file_path,
        file_name: newVersionDoc.file_name,
        changed_by: form.uploaded_by,
        change_notes: newVersionNotes,
      })

      // Update document
      const newVer = incrementVersion(newVersionDoc.version)
      await supabase.from('vnd_documents').update({
        file_path: path, file_name: newVersionFile.name,
        file_size: newVersionFile.size, version: newVer,
        updated_at: new Date().toISOString(),
      }).eq('id', newVersionDoc.id)

      setNewVersionDoc(null); setNewVersionFile(null); setNewVersionNotes('')
      fetch_()
    } catch (err: unknown) {
      alert('Ошибка: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setUploading(false) }
  }

  function incrementVersion(v: string): string {
    const parts = v.split('.')
    const minor = parseInt(parts[1] || '0') + 1
    return `${parts[0]}.${minor}`
  }

  function openEdit(doc: VNDDocument) {
    setForm({
      title: doc.title, category: doc.category,
      document_number: doc.document_number || '',
      status: doc.status,
      approved_date: doc.approved_date || '',
      review_date: doc.review_date || '',
      version: doc.version, description: doc.description || '',
      uploaded_by: doc.uploaded_by || '',
    })
    setEditingId(doc.id); setFile(null); setError(null); setShowModal(true)
  }

  const filtered = docs.filter(d => {
    if (filterCategory && d.category !== filterCategory) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.document_number?.includes(search)) return false
    return true
  })

  const expiringSoon = docs.filter(d => {
    const days = getDaysUntilReview(d.review_date)
    return days !== null && days <= 30 && days > 0 && d.status === 'Действующий'
  }).length

  const expired = docs.filter(d => {
    const days = getDaysUntilReview(d.review_date)
    return days !== null && days <= 0 && d.status === 'Действующий'
  }).length

  const fileIcon = (type: string) => {
    if (type === 'pdf') return '📄'
    if (type === 'docx' || type === 'doc') return '📝'
    if (type === 'xlsx' || type === 'xls') return '📊'
    return '📎'
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white"
  const lbl = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">ВНД СУР — Внутренние нормативные документы</h1>
          <p className="text-sm text-gray-500 mt-0.5">Хранилище документов Службы управления рисками</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setFile(null); setEditingId(null); setError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040]">
          <Plus className="w-4 h-4" /> Загрузить документ
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего документов', value: docs.length, c: 'text-gray-900', icon: <FileText className="w-5 h-5 text-gray-400" /> },
          { label: 'Действующие', value: docs.filter(d => d.status === 'Действующий').length, c: 'text-green-600', icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
          { label: 'Истекают (30 дн.)', value: expiringSoon, c: 'text-orange-600', icon: <Clock className="w-5 h-5 text-orange-400" /> },
          { label: 'Просроченные', value: expired, c: 'text-red-600', icon: <AlertTriangle className="w-5 h-5 text-red-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
            {s.icon}
            <div>
              <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {expired > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{expired} документ(ов) требуют пересмотра — срок действия истёк!</p>
        </div>
      )}
      {expiringSoon > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-700 font-medium">{expiringSoon} документ(ов) истекают в течение 30 дней — требуется пересмотр</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Поиск по названию или номеру..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C]" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white">
          <option value="">Все статусы</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {(filterCategory || filterStatus || search) && (
          <button onClick={() => { setFilterCategory(''); setFilterStatus(''); setSearch('') }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Документ','Категория','Версия','Статус','Утверждён','Пересмотр','Размер',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Документов нет</p>
                  </td></tr>
                : filtered.map(doc => {
                  const si = getStatusInfo(doc)
                  const days = getDaysUntilReview(doc.review_date)
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{fileIcon(doc.file_type)}</span>
                          <div>
                            <p className="font-medium text-gray-900">{doc.title}</p>
                            {doc.document_number && <p className="text-xs text-gray-400">№ {doc.document_number}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{doc.category}</span></td>
                      <td className="px-4 py-3 text-gray-600 font-medium">v{doc.version}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>
                          {si.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{doc.approved_date ? new Date(doc.approved_date).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="px-4 py-3">
                        {doc.review_date ? (
                          <span className={`text-xs font-medium ${days !== null && days <= 0 ? 'text-red-600' : days !== null && days <= 30 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {new Date(doc.review_date).toLocaleDateString('ru-RU')}
                            {days !== null && days <= 30 && <span className="ml-1">({days <= 0 ? 'истёк' : `${days} дн.`})</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatSize(doc.file_size)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDownload(doc)} title="Скачать" className="p-1.5 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                          <button onClick={() => loadVersions(doc)} title="История версий" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><History className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(doc)} title="Редактировать" className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setNewVersionDoc(doc)} title="Загрузить новую версию" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><Upload className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(doc)} title="Удалить" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">История версий: {showVersions.title}</h2>
              <button onClick={() => setShowVersions(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Current version */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-green-700">Текущая версия v{showVersions.version}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{showVersions.file_name}</p>
                  </div>
                  <button onClick={() => handleDownload(showVersions)} className="flex items-center gap-1 text-xs text-[#1B8A4C] hover:underline">
                    <Download className="w-3.5 h-3.5" /> Скачать
                  </button>
                </div>
              </div>
              {versions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Нет истории версий</p>
              ) : versions.map(v => (
                <div key={v.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-700">v{v.version}</span>
                      <span className="text-xs text-gray-400 ml-2">{new Date(v.created_at).toLocaleDateString('ru-RU')}</span>
                      {v.changed_by && <span className="text-xs text-gray-400 ml-2">· {v.changed_by}</span>}
                      {v.change_notes && <p className="text-xs text-gray-500 mt-0.5">{v.change_notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Version Modal */}
      {newVersionDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold">Новая версия: {newVersionDoc.title}</h2>
              <button onClick={() => setNewVersionDoc(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={lbl}>Новый файл *</label>
                <input type="file" onChange={e => setNewVersionFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#1B8A4C] file:text-white file:text-xs file:cursor-pointer" />
              </div>
              <div>
                <label className={lbl}>Описание изменений</label>
                <textarea value={newVersionNotes} onChange={e => setNewVersionNotes(e.target.value)} rows={3}
                  placeholder="Что изменилось в новой версии..." className={inp + ' resize-none'} />
              </div>
              <p className="text-xs text-gray-400">Текущая версия v{newVersionDoc.version} → будет v{incrementVersion(newVersionDoc.version)}</p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setNewVersionDoc(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleNewVersion} disabled={!newVersionFile || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {uploading ? 'Загрузка...' : <><Upload className="w-4 h-4" /> Загрузить</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold">{editingId ? 'Редактировать документ' : 'Загрузить документ'}</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFile(null); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2"><label className={lbl}>Название документа *</label><input type="text" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Политика управления операционным риском" className={inp} /></div>
                <div><label className={lbl}>Категория</label><select value={form.category} onChange={e => setF('category', e.target.value)} className={inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className={lbl}>Номер документа</label><input type="text" value={form.document_number} onChange={e => setF('document_number', e.target.value)} placeholder="ВНД-СУР-001" className={inp} /></div>
                <div><label className={lbl}>Статус</label><select value={form.status} onChange={e => setF('status', e.target.value)} className={inp}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className={lbl}>Версия</label><input type="text" value={form.version} onChange={e => setF('version', e.target.value)} placeholder="1.0" className={inp} /></div>
                <div><label className={lbl}>Дата утверждения</label><input type="date" value={form.approved_date} onChange={e => setF('approved_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Дата следующего пересмотра</label><input type="date" value={form.review_date} onChange={e => setF('review_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Загрузил</label><input type="text" value={form.uploaded_by} onChange={e => setF('uploaded_by', e.target.value)} placeholder="ФИО" className={inp} /></div>
                <div className="lg:col-span-2"><label className={lbl}>Описание</label><textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={2} placeholder="Краткое описание документа..." className={inp + ' resize-none'} /></div>
                <div className="lg:col-span-2">
                  <label className={lbl}>{editingId ? 'Заменить файл (необязательно)' : 'Файл *'} (PDF, Word, Excel)</label>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#1B8A4C] file:text-white file:text-xs file:cursor-pointer border border-gray-200 rounded-lg p-2" />
                  {file && <p className="text-xs text-green-600 mt-1">✅ {file.name} ({formatSize(file.size)})</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFile(null); setEditingId(null) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={handleSave} disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B8A4C] text-white rounded-lg text-sm font-medium hover:bg-[#177040] disabled:opacity-50">
                {uploading ? <><Upload className="w-4 h-4 animate-bounce" /> Загрузка...</> : <><CheckCircle className="w-4 h-4" /> {editingId ? 'Сохранить' : 'Загрузить'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

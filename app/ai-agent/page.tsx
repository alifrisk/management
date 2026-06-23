'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Send, Bot, User, Loader2, Copy, Check, Paperclip, X, FileText, Plus, History, ChevronDown, Edit2, BookOpen, Trash2, Zap } from 'lucide-react'

interface Message { id: string; role: 'user' | 'assistant'; content: string }
interface Chat { id: string; title: string; created_at: string }
interface DocFile { name: string; content: string }
interface KBDoc { id: string; title: string; content: string }

const SUGGESTED = [
  'Какой норматив достаточности капитала требует НБТ?',
  'LCR и NSFR — что это и минимальные значения?',
  'Объясни PAR30 и Coverage Rate простыми словами',
  'Базель II vs Базель III — ключевые отличия',
  'Что такое ERM и три линии защиты?',
  'Как оценить операционный риск по методу BIA?',
  'Стресс-тест ликвидности T+1/T+7/T+30 — методология',
  'Объясни ICAAP и зачем он нужен банку',
]

const CONTEXTS = [
  { value: '', label: '💬 Общий вопрос' },
  { value: 'Пользователь работает в модуле Операционный риск.', label: '🛡️ Операционный риск' },
  { value: 'Пользователь работает в модуле Кредитный риск.', label: '📄 Кредитный риск' },
  { value: 'Пользователь работает в модуле Рыночный риск.', label: '📈 Рыночный риск' },
  { value: 'Пользователь работает в модуле Риск ликвидности.', label: '💧 Ликвидность' },
  { value: 'Пользователь работает со стратегическими задачами ERM.', label: '🎯 ERM / Стратегия' },
]

function fmtText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br/>')
}

export default function RiskovikPage() {
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [context,   setContext]   = useState('')
  const [docs,      setDocs]      = useState<DocFile[]>([])
  const [copied,    setCopied]    = useState<string | null>(null)
  const [chatId,    setChatId]    = useState<string | null>(null)
  const [chats,     setChats]     = useState<Chat[]>([])
  const [showHist,  setShowHist]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editText,  setEditText]  = useState('')
  const [userId,    setUserId]    = useState<string | null>(null)

  // Knowledge base
  const [showKB,    setShowKB]    = useState(false)
  const [kbDocs,    setKbDocs]    = useState<KBDoc[]>([])
  const [kbTitle,   setKbTitle]   = useState('')
  const [kbContent, setKbContent] = useState('')
  const [kbSaving,  setKbSaving]  = useState(false)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const kbFileRef = useRef<HTMLInputElement>(null)

  // Live data from Supabase
  const [liveData,  setLiveData]  = useState('')
  const [liveLoading, setLiveLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const loadChats = useCallback(async (uid?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const id = uid || user?.id
    if (!id) return
    const { data } = await supabase.from('ai_chats').select('id, title, created_at').eq('user_id', id).order('updated_at', { ascending: false }).limit(20)
    setChats(data || [])
  }, [])

  const loadKBDocs = useCallback(async () => {
    const { data } = await supabase
      .from('knowledge_documents')
      .select('id, title, content')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    setKbDocs(data || [])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
        setIsAdmin(profile?.role === 'admin')
        await loadKBDocs()
        await loadChats(user.id)
        const { data: chatsData } = await supabase.from('ai_chats').select('id').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1)
        if (chatsData && chatsData.length > 0) {
          await openChat(chatsData[0].id)
        }
      }
    }
    init()
  }, [])

  // Fetch live data when context changes
  useEffect(() => {
    async function fetchLive() {
      setLiveLoading(true)
      try {
        let text = ''

        if (!context) {
          // Общий контекст — подгружаем компактный срез из всех модулей
          const [creditRes, assessRes, finRes, opRes] = await Promise.all([
            supabase.from('credit_conclusions')
              .select('borrower_name, loan_amount, currency, recommendation, risk_level, analyst_name, created_at, ai_conclusion')
              .order('created_at', { ascending: false }).limit(5),
            supabase.from('counterparty_assessments')
              .select('bank_name, country, total_score, reliability_category, recommended_limit_usd, created_at')
              .order('created_at', { ascending: false }).limit(5),
            supabase.from('counterparty_financials')
              .select('code, counterparty_type, p1_label, p2_label, currency, ai_conclusion, created_at')
              .order('created_at', { ascending: false }).limit(3),
            supabase.from('operational_incidents')
              .select('incident_number, risk_level, business_process, incident_status, loss_amount_tjs')
              .order('created_at', { ascending: false }).limit(20),
          ])
          if (creditRes.data?.length) {
            const a = creditRes.data.filter(c => c.recommendation === 'Одобрить').length
            const r = creditRes.data.filter(c => c.recommendation === 'Отклонить').length
            text += `КРЕДИТНЫЙ РИСК — последние ${creditRes.data.length} заключений (Одобрено: ${a} | Отклонено: ${r}):\n`
            creditRes.data.forEach(c => {
              text += `• ${c.borrower_name} | ${Number(c.loan_amount).toLocaleString()} ${c.currency} | ${c.recommendation} [${c.risk_level}]\n`
              if (c.ai_conclusion) text += `  Заключение: ${c.ai_conclusion.slice(0, 300)}...\n`
            })
            text += '\n'
          }
          if (assessRes.data?.length) {
            text += `РЫНОЧНЫЙ РИСК — контрагенты (${assessRes.data.length}):\n`
            assessRes.data.forEach(a => {
              text += `• ${a.bank_name} (${a.country}) | Балл: ${a.total_score} | ${a.reliability_category} | Лимит: $${Number(a.recommended_limit_usd || 0).toLocaleString()}\n`
            })
            text += '\n'
          }
          if (finRes.data?.length) {
            text += `ФИНАНСОВЫЙ АНАЛИЗ КОНТРАГЕНТОВ (${finRes.data.length}):\n`
            finRes.data.forEach(f => {
              text += `• ${f.code} (${f.counterparty_type}) | ${f.p1_label} → ${f.p2_label}\n`
              if (f.ai_conclusion) text += `  Анализ: ${f.ai_conclusion.slice(0, 300)}...\n`
            })
            text += '\n'
          }
          if (opRes.data?.length) {
            const extreme = opRes.data.filter(i => i.risk_level === 'Экстремальные').length
            const high = opRes.data.filter(i => i.risk_level === 'Высокий').length
            const totalLoss = opRes.data.reduce((s, i) => s + (Number(i.loss_amount_tjs) || 0), 0)
            text += `ОПЕРАЦИОННЫЙ РИСК — ${opRes.data.length} инцидентов | Экстремальных: ${extreme} | Высоких: ${high} | Потери: ${totalLoss.toLocaleString('ru-RU')} TJS\n`
          }

        } else if (context.includes('Операционный риск')) {
          const { data } = await supabase
            .from('operational_incidents')
            .select('incident_number, incident_status, risk_level, factor, business_process, loss_amount_tjs, incident_date, case_description, department')
            .order('created_at', { ascending: false })
            .limit(50)
          if (data && data.length > 0) {
            const open = data.filter(i => i.incident_status === 'Открыт').length
            const inProg = data.filter(i => i.incident_status === 'В процессе').length
            const extreme = data.filter(i => i.risk_level === 'Экстремальные').length
            const high = data.filter(i => i.risk_level === 'Высокий').length
            const totalLoss = data.reduce((s, i) => s + (Number(i.loss_amount_tjs) || 0), 0)
            text = `Операционный риск — последние ${data.length} инцидентов:\n`
            text += `Открытых: ${open} | В процессе: ${inProg} | Экстремальный: ${extreme} | Высокий: ${high}\n`
            text += `Суммарные потери: ${totalLoss.toLocaleString('ru-RU')} TJS\n\n`
            const critical = data.filter(i => i.risk_level === 'Экстремальные' || i.risk_level === 'Высокий').slice(0, 15)
            if (critical.length > 0) {
              text += `Критические инциденты:\n`
              critical.forEach(i => {
                text += `• №${i.incident_number} [${i.risk_level}] ${i.business_process} — ${(i.case_description || '').slice(0, 80)} | ${i.incident_status}\n`
              })
            }
          }

        } else if (context.includes('Кредитный риск')) {
          const { data } = await supabase
            .from('credit_conclusions')
            .select('borrower_name, business_type, loan_amount, loan_term_months, interest_rate, currency, recommendation, risk_level, analyst_name, created_at, ai_conclusion, p1_label, p2_label, p1_net_profit, p2_net_profit, p1_net_rev, p2_net_rev, p1_total_assets, p2_total_assets')
            .order('created_at', { ascending: false })
            .limit(10)
          if (data && data.length > 0) {
            const approved = data.filter(c => c.recommendation === 'Одобрить').length
            const rejected = data.filter(c => c.recommendation === 'Отклонить').length
            const cond = data.filter(c => c.recommendation === 'Условно одобрить').length
            text = `КРЕДИТНЫЙ РИСК — последние ${data.length} заключений МСБ:\n`
            text += `Одобрено: ${approved} | Отклонено: ${rejected} | Условно: ${cond}\n\n`
            data.forEach((c, i) => {
              text += `━━━ Заключение ${i + 1}: ${c.borrower_name} ━━━\n`
              text += `Вид деятельности: ${c.business_type || '—'} | Аналитик: ${c.analyst_name || '—'} | Дата: ${c.created_at?.slice(0, 10)}\n`
              text += `Кредит: ${Number(c.loan_amount).toLocaleString()} ${c.currency} | Срок: ${c.loan_term_months} мес. | Ставка: ${c.interest_rate}%\n`
              text += `Периоды: ${c.p1_label || 'П1'} → ${c.p2_label || 'П2'}\n`
              if (c.p2_net_rev || c.p2_total_assets) {
                text += `Выручка: ${Number(c.p1_net_rev || 0).toLocaleString()} → ${Number(c.p2_net_rev || 0).toLocaleString()} | Активы: ${Number(c.p1_total_assets || 0).toLocaleString()} → ${Number(c.p2_total_assets || 0).toLocaleString()}\n`
                text += `Чистая прибыль: ${Number(c.p1_net_profit || 0).toLocaleString()} → ${Number(c.p2_net_profit || 0).toLocaleString()}\n`
              }
              text += `РЕШЕНИЕ: ${c.recommendation} | РИСК: ${c.risk_level}\n`
              if (c.ai_conclusion) text += `\nЗАКЛЮЧЕНИЕ АНАЛИТИКА:\n${c.ai_conclusion}\n`
              text += '\n'
            })
          }

        } else if (context.includes('Рыночный риск')) {
          const [assessRes, finRes] = await Promise.all([
            supabase
              .from('counterparty_assessments')
              .select('bank_name, country, total_score, reliability_category, recommended_limit_usd, created_at')
              .order('created_at', { ascending: false })
              .limit(10),
            supabase
              .from('counterparty_financials')
              .select('code, counterparty_type, p1_label, p2_label, currency, ai_conclusion, created_at')
              .order('created_at', { ascending: false })
              .limit(5),
          ])
          if (assessRes.data && assessRes.data.length > 0) {
            text = `РЫНОЧНЫЙ РИСК — оценки надёжности контрагентов (${assessRes.data.length}):\n`
            assessRes.data.forEach(a => {
              text += `• ${a.bank_name} (${a.country}) | Балл: ${a.total_score} | ${a.reliability_category} | Лимит: $${Number(a.recommended_limit_usd || 0).toLocaleString()}\n`
            })
            text += '\n'
          }
          if (finRes.data && finRes.data.length > 0) {
            text += `ФИНАНСОВЫЙ АНАЛИЗ КОНТРАГЕНТОВ — последние ${finRes.data.length}:\n`
            finRes.data.forEach((f, i) => {
              text += `━━━ Анализ ${i + 1}: ${f.code} (${f.counterparty_type}) ━━━\n`
              text += `Периоды: ${f.p1_label || 'П1'} → ${f.p2_label || 'П2'} | Валюта: ${f.currency} | Дата: ${f.created_at?.slice(0, 10)}\n`
              if (f.ai_conclusion) text += `\nЗАКЛЮЧЕНИЕ:\n${f.ai_conclusion}\n`
              text += '\n'
            })
          }

        } else if (context.toLowerCase().includes('ликвидност')) {
          const { data } = await supabase
            .from('liquidity_stress_tests')
            .select('test_date, period, results, analyst_name')
            .order('created_at', { ascending: false })
            .limit(5)
          if (data && data.length > 0) {
            text = `Стресс-тесты ликвидности (последние ${data.length}):\n`
            data.forEach(t => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const res = t.results as any
              text += `• Период: ${t.period} | Дата: ${t.test_date}`
              if (res?.pessimistic?.t30) {
                text += ` | Пессим. T+30: покрытие ${Number(res.pessimistic.t30.coverage_cash_equiv || 0).toFixed(1)}%`
              }
              text += ` | Аналитик: ${t.analyst_name}\n`
            })
          }
        }

        setLiveData(text)
      } catch {
        setLiveData('')
      } finally {
        setLiveLoading(false)
      }
    }
    fetchLive()
  }, [context])

  async function openChat(id: string) {
    setChatId(id)
    setShowHist(false)
    const { data } = await supabase.from('ai_messages').select('id, role, content').eq('chat_id', id).order('created_at')
    setMessages((data || []) as Message[])
  }

  async function newChat() {
    if (!userId) return
    const { data } = await supabase.from('ai_chats').insert({ title: 'Новый чат', context: '', user_id: userId }).select().single()
    if (data) {
      setChatId(data.id)
      setMessages([])
      setDocs([])
      setInput('')
      setShowHist(false)
      loadChats()
    }
  }

  async function deleteChat(id: string) {
    await supabase.from('ai_messages').delete().eq('chat_id', id)
    await supabase.from('ai_chats').delete().eq('id', id)
    if (chatId === id) { setChatId(null); setMessages([]) }
    loadChats()
  }

  async function extractFileText(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const toBase64 = async (f: File) => {
      const ab = await f.arrayBuffer()
      return btoa(Array.from(new Uint8Array(ab), b => String.fromCharCode(b)).join(''))
    }
    const callApi = async (url: string, base64: string) => {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: base64 }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json.text as string
    }

    if (ext === 'docx') return callApi('/api/extract-docx', await toBase64(file))
    if (ext === 'pdf') return callApi('/api/extract-pdf', await toBase64(file))
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = (await import('xlsx')).default
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab)
      const parts: string[] = []
      wb.SheetNames.forEach(name => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
        if (csv.trim()) parts.push(`[Лист: ${name}]\n${csv}`)
      })
      return parts.join('\n\n')
    }
    return file.text()
  }

  async function handleKBFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (kbFileRef.current) kbFileRef.current.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase()
    const supported = ['txt', 'md', 'csv', 'json', 'docx', 'pdf', 'xlsx', 'xls']
    if (!supported.includes(ext || '')) {
      alert('Поддерживаются: TXT, MD, CSV, JSON, DOCX, PDF, XLSX')
      return
    }
    try {
      const text = await extractFileText(file)
      setKbTitle(file.name.replace(/\.[^.]+$/, ''))
      setKbContent(text.slice(0, 15000))
    } catch (err) {
      alert('Ошибка чтения файла: ' + String(err))
    }
  }

  async function addKBDoc() {
    if (!kbTitle.trim() || !kbContent.trim()) return
    setKbSaving(true)
    const { error } = await supabase.from('knowledge_documents').insert({ title: kbTitle.trim(), content: kbContent.trim() })
    if (!error) { setKbTitle(''); setKbContent(''); await loadKBDocs() }
    setKbSaving(false)
  }

  async function removeKBDoc(id: string) {
    await supabase.from('knowledge_documents').delete().eq('id', id)
    setKbDocs(prev => prev.filter(d => d.id !== id))
  }

  async function saveEdit(msgId: string) {
    if (!editText.trim() || !chatId) return
    await supabase.from('ai_messages').update({ content: editText }).eq('id', msgId)
    const idx = messages.findIndex(m => m.id === msgId)
    const msgsAfter = messages.slice(idx + 1)
    for (const m of msgsAfter) await supabase.from('ai_messages').delete().eq('id', m.id)
    const updatedMsgs = messages.slice(0, idx).concat([{ id: msgId, role: 'user', content: editText }])
    setMessages(updatedMsgs)
    setEditId(null); setEditText('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/ai-agent', {
        method: 'POST',
        body: JSON.stringify({ messages: updatedMsgs.map(m => ({ role: m.role, content: m.content })), context, live_data: liveData || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const aiMsg: Message = { id: Date.now() + '_a', role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, aiMsg])
      await supabase.from('ai_messages').insert({ chat_id: chatId, role: 'assistant', content: data.reply })
    } catch (e: unknown) {
      setMessages(prev => [...prev, { id: Date.now() + '_e', role: 'assistant', content: '⚠️ ' + (e instanceof Error ? e.message : String(e)) }])
    }
    setLoading(false)
  }

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    let activeChatId = chatId
    if (!activeChatId) {
      if (!userId) return
      const { data } = await supabase.from('ai_chats').insert({ title: content.slice(0, 60), context, user_id: userId }).select().single()
      if (!data) return
      activeChatId = data.id
      setChatId(data.id)
      loadChats()
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    await supabase.from('ai_messages').insert({ chat_id: activeChatId, role: 'user', content })

    try {
      const docCtx = docs.length > 0 ? docs.map(d => `=== ${d.name} ===\n${d.content}`).join('\n\n') : undefined
      const res = await apiFetch('/api/ai-agent', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context,
          document_context: docCtx,
          live_data: liveData || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const aiMsg: Message = { id: Date.now() + '_a', role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, aiMsg])
      await supabase.from('ai_messages').insert({ chat_id: activeChatId, role: 'assistant', content: data.reply })
      await supabase.from('ai_chats').update({ updated_at: new Date().toISOString() }).eq('id', activeChatId)
      loadChats()
    } catch (e: unknown) {
      setMessages(prev => [...prev, { id: Date.now() + '_e', role: 'assistant', content: '⚠️ ' + (e instanceof Error ? e.message : String(e)) }])
    }
    setLoading(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await extractFileText(file)
      setDocs(prev => [...prev, { name: file.name, content: text.slice(0, 8000) }])
    } catch (err) {
      alert('Ошибка чтения файла: ' + String(err))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function copyMsg(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0 sticky top-0 bg-[#F5F8F6] z-10 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-xl flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">Рисковик</h1>
            <p className="text-xs text-gray-500">AI-ассистент · Базель II/III · НБТ · ISO 31000</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Context with live data indicator */}
          <div className="relative flex items-center">
            <select value={context} onChange={e => setContext(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-gray-600 pr-7">
              {CONTEXTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {context && (
              <span className="absolute right-2 flex items-center">
                {liveLoading
                  ? <Loader2 className="w-2.5 h-2.5 text-[#1B8A4C] animate-spin" />
                  : liveData
                  ? <span className="w-2 h-2 rounded-full bg-green-500" title="Живые данные загружены" />
                  : <span className="w-2 h-2 rounded-full bg-gray-300" />
                }
              </span>
            )}
          </div>

          {/* Knowledge Base */}
          <div className="relative">
            <button onClick={() => { setShowKB(v => !v); setShowHist(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-colors ${showKB ? 'border-[#1B8A4C] bg-green-50 text-[#1B8A4C]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <BookOpen className="w-3.5 h-3.5" />
              База знаний
              {kbDocs.length > 0 && <span className="bg-[#1B8A4C] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{kbDocs.length}</span>}
            </button>
            {showKB && (
              <div className="absolute right-0 top-9 z-50 w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div>
                    <span className="text-xs font-semibold text-gray-700">База знаний</span>
                    <p className="text-[10px] text-gray-400">Документы всегда доступны AI в каждом чате</p>
                  </div>
                  <button onClick={() => setShowKB(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {kbDocs.length === 0
                    ? <p className="text-xs text-gray-400 text-center py-6">База знаний пуста</p>
                    : kbDocs.map(d => (
                      <div key={d.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50">
                        <FileText className="w-3.5 h-3.5 text-[#1B8A4C] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{d.title}</p>
                          <p className="text-[10px] text-gray-400 truncate">{d.content.slice(0, 60)}...</p>
                        </div>
                        {isAdmin && (
                          <button onClick={() => removeKBDoc(d.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  }
                </div>
                {isAdmin && (
                  <div className="p-3 border-t border-gray-100 space-y-2 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500 font-medium">Добавить документ</p>
                      <button onClick={() => kbFileRef.current?.click()}
                        className="flex items-center gap-1 text-[10px] text-[#1B8A4C] hover:underline">
                        <Paperclip className="w-3 h-3" /> Загрузить файл
                      </button>
                    </div>
                    <input ref={kbFileRef} type="file" accept=".txt,.md,.csv,.json,.docx,.pdf,.xlsx,.xls" onChange={handleKBFile} className="hidden" />
                    <input value={kbTitle} onChange={e => setKbTitle(e.target.value)}
                      placeholder="Название (напр. «Политика ОР 2024»)"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] bg-white" />
                    <textarea value={kbContent} onChange={e => setKbContent(e.target.value)}
                      placeholder="Содержание документа..."
                      rows={3}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B8A4C] resize-none bg-white" />
                    <button onClick={addKBDoc} disabled={kbSaving || !kbTitle.trim() || !kbContent.trim()}
                      className="w-full py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                      {kbSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Добавить в базу знаний
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* История чатов */}
          <div className="relative">
            <button onClick={() => { setShowHist(v => !v); setShowKB(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              <History className="w-3.5 h-3.5" /> История <ChevronDown className="w-3 h-3" />
            </button>
            {showHist && (
              <div className="absolute right-0 top-8 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">История чатов</span>
                  <button onClick={() => setShowHist(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {chats.length === 0
                    ? <p className="text-xs text-gray-400 text-center py-4">Нет чатов</p>
                    : chats.map(c => (
                      <div key={c.id} className={`flex items-center border-b border-gray-50 ${chatId === c.id ? 'bg-green-50' : ''}`}>
                        <button onClick={() => openChat(c.id)} className="flex-1 text-left px-3 py-2 hover:bg-gray-50">
                          <p className="text-xs font-medium text-gray-700 truncate">{c.title}</p>
                          <p className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString('ru-RU', { day:'2-digit', month:'short', year:'numeric' })}</p>
                        </button>
                        <button onClick={() => deleteChat(c.id)} className="px-2 py-2 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
          <button onClick={newChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B8A4C] text-white rounded-lg text-xs font-medium hover:bg-[#177040]">
            <Plus className="w-3.5 h-3.5" /> Новый чат
          </button>
        </div>
      </div>

      {/* Live data badge */}
      {liveData && (
        <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
          <Zap className="w-3 h-3 flex-shrink-0" />
          <span>Живые данные подключены — AI видит актуальные данные из системы</span>
        </div>
      )}

      {/* Session docs */}
      {docs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-2 flex-shrink-0">
          {docs.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-xs text-blue-700">
              <FileText className="w-3 h-3" />
              <span className="max-w-32 truncate">{d.name}</span>
              <button onClick={() => setDocs(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="overflow-y-auto space-y-4 pb-3" style={{ minHeight: "300px", maxHeight: "calc(100vh - 300px)" }}>
        {messages.length === 0 && (
          <div className="text-center pt-6 pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Привет, я Рисковик!</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-1">Знаю Базель II/III, нормативы НБТ, ISO 31000.</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">Выберите модуль выше — AI подключится к живым данным системы.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#1B8A4C] hover:bg-green-50 transition-all text-left">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[82%] group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {editId === msg.id ? (
                <div className="w-full">
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    rows={3} autoFocus
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-[#1B8A4C]/10 border-2 border-[#1B8A4C] text-gray-900 resize-none focus:outline-none" />
                  <div className="flex justify-end gap-2 mt-1.5">
                    <button onClick={() => { setEditId(null); setEditText('') }}
                      className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Отмена</button>
                    <button onClick={() => saveEdit(msg.id)}
                      className="px-3 py-1 text-xs bg-[#1B8A4C] text-white rounded-lg hover:bg-[#177040]">Отправить</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#1B8A4C] text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                    {msg.role === 'assistant'
                      ? <div dangerouslySetInnerHTML={{ __html: fmtText(msg.content) }} />
                      : msg.content}
                  </div>
                  <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.role === 'assistant' && (
                      <button onClick={() => copyMsg(msg.id, msg.content)} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        {copied === msg.id ? <><Check className="w-3 h-3 text-green-500" /> Скопировано</> : <><Copy className="w-3 h-3" /> Копировать</>}
                      </button>
                    )}
                    {msg.role === 'user' && (
                      <button onClick={() => { setEditId(msg.id); setEditText(msg.content) }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <Edit2 className="w-3 h-3" /> Изменить
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-2 h-2 bg-[#1B8A4C] rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border border-gray-200 rounded-2xl shadow-sm p-3 mt-2">
        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.docx,.pdf,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 text-gray-400 hover:text-[#1B8A4C] hover:bg-green-50 rounded-xl flex items-center justify-center transition-colors border border-gray-200">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Задайте вопрос... (Enter — отправить, Shift+Enter — новая строка)"
            rows={2}
            className="flex-1 resize-none border-0 outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent leading-relaxed" />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 bg-[#1B8A4C] text-white rounded-xl flex items-center justify-center hover:bg-[#177040] disabled:opacity-40 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">📎 TXT/PDF для сессии · 📚 База знаний — постоянные документы · История сохраняется автоматически</p>
      </div>
    </div>
  )
}

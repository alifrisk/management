'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/supabase/client'
import { Send, Bot, User, Loader2, Copy, Check, Paperclip, X, FileText, Plus, History, ChevronDown } from 'lucide-react'

interface Message { id: string; role: 'user' | 'assistant'; content: string }
interface Chat { id: string; title: string; created_at: string }
interface DocFile { name: string; content: string }

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Load chat list
  const loadChats = useCallback(async () => {
    const { data } = await supabase.from('ai_chats').select('id, title, created_at').order('updated_at', { ascending: false }).limit(20)
    setChats(data || [])
  }, [])

  // Load most recent chat on mount
  useEffect(() => {
    async function init() {
      await loadChats()
      const { data: chatsData } = await supabase.from('ai_chats').select('id').order('updated_at', { ascending: false }).limit(1)
      if (chatsData && chatsData.length > 0) {
        await openChat(chatsData[0].id)
      }
    }
    init()
  }, [])

  async function openChat(id: string) {
    setChatId(id)
    setShowHist(false)
    const { data } = await supabase.from('ai_messages').select('id, role, content').eq('chat_id', id).order('created_at')
    setMessages((data || []) as Message[])
  }

  async function newChat() {
    const { data } = await supabase.from('ai_chats').insert({ title: 'Новый чат', context: '' }).select().single()
    if (data) {
      setChatId(data.id)
      setMessages([])
      setDocs([])
      setInput('')
      setShowHist(false)
      loadChats()
    }
  }

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    let activeChatId = chatId
    if (!activeChatId) {
      const { data } = await supabase.from('ai_chats').insert({ title: content.slice(0, 60), context }).select().single()
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
      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context, document_context: docCtx,
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
    const text = await file.text()
    setDocs(prev => [...prev, { name: file.name, content: text.slice(0, 8000) }])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function copyMsg(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
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
          <select value={context} onChange={e => setContext(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-gray-600">
            {CONTEXTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {/* История чатов */}
          <div className="relative">
            <button onClick={() => setShowHist(v => !v)}
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
                      <button key={c.id} onClick={() => openChat(c.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 ${chatId === c.id ? 'bg-green-50' : ''}`}>
                        <p className="text-xs font-medium text-gray-700 truncate">{c.title}</p>
                        <p className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString('ru-RU', { day:'2-digit', month:'short', year:'numeric' })}</p>
                      </button>
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

      {/* Docs */}
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
      <div className="flex-1 overflow-y-auto space-y-4 pb-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center pt-6 pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Привет, я Рисковик!</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">Знаю Базель II/III, нормативы НБТ, ISO 31000. История чатов сохраняется.</p>
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
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#1B8A4C] text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                {msg.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: fmtText(msg.content) }} />
                  : msg.content}
              </div>
              {msg.role === 'assistant' && (
                <button onClick={() => copyMsg(msg.id, msg.content)} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {copied === msg.id ? <><Check className="w-3 h-3 text-green-500" /> Скопировано</> : <><Copy className="w-3 h-3" /> Копировать</>}
                </button>
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
          <input ref={fileRef} type="file" accept=".txt,.pdf,.md,.csv" onChange={handleFile} className="hidden" />
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
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">📎 TXT/PDF — Рисковик прочитает · История сохраняется автоматически</p>
      </div>
    </div>
  )
}

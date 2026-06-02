'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Trash2, Copy, Check, Paperclip, X, FileText } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface DocFile {
  name: string
  content: string
}

const SUGGESTED = [
  'Какой норматив достаточности капитала требует НБТ?',
  'Как рассчитывается LCR и какой минимум по Базель III?',
  'Объясни PAR30 и Coverage Rate простыми словами',
  'Как провести стресс-тест ликвидности T+1/T+7/T+30?',
  'Что такое ERM и три линии защиты?',
  'Как оценить операционный риск по методу BIA?',
  'Какие инструкции НБТ регулируют кредитные риски?',
  'Объясни ICAAP и зачем он нужен Алиф Банку',
]

const CONTEXTS = [
  { value: '', label: '💬 Общий вопрос' },
  { value: 'Пользователь работает в модуле Операционный риск.', label: '🛡️ Операционный риск' },
  { value: 'Пользователь работает в модуле Кредитный риск — PAR30, Coverage Rate, стресс-тест.', label: '📄 Кредитный риск' },
  { value: 'Пользователь работает в модуле Рыночный риск — Монте Карло, анализ контрагентов.', label: '📈 Рыночный риск' },
  { value: 'Пользователь работает в модуле Риск ликвидности — стресс-тест T+1/T+7/T+30.', label: '💧 Ликвидность' },
  { value: 'Пользователь работает со стратегическими задачами ERM.', label: '🎯 ERM / Стратегия' },
]

function fmt(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^#{1,3} (.+)$/gm, '<p class="font-semibold text-gray-900 mt-2 mb-1">$1</p>')
    .replace(/^• (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
    .replace(/\n/g, '<br/>')
}

export default function RiskovikPage() {
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [context,   setContext]   = useState('')
  const [docs,      setDocs]      = useState<DocFile[]>([])
  const [copied,    setCopied]    = useState<string | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Read uploaded file
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // Truncate to ~8000 chars to fit context
    const truncated = text.slice(0, 8000) + (text.length > 8000 ? '\n...[документ обрезан]' : '')
    setDocs(prev => [...prev, { name: file.name, content: truncated }])
    if (fileRef.current) fileRef.current.value = ''
  }

  const docContext = docs.length > 0
    ? docs.map(d => `=== ${d.name} ===\n${d.content}`).join('\n\n')
    : undefined

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context,
          document_context: docContext,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, {
        id: Date.now() + '_a', role: 'assistant', content: data.reply, timestamp: new Date(),
      }])
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        id: Date.now() + '_e', role: 'assistant',
        content: '⚠️ ' + (e instanceof Error ? e.message : String(e)),
        timestamp: new Date(),
      }])
    }
    setLoading(false)
  }

  async function copyMsg(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  return (
    // full-width layout — sidebar stays but content takes max space
    <div className="flex flex-col max-w-4xl mx-auto" style={{ height: "calc(100vh - 8rem)" }}>

      {/* Header */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-xl flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">Рисковик</h1>
            <p className="text-xs text-gray-500">AI-ассистент · Базель III · НБТ · ISO 31000</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={context} onChange={e => setContext(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-gray-600">
            {CONTEXTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button onClick={() => { if (confirm('Очистить чат?')) { setMessages([]); setDocs([]) } }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Uploaded docs */}
      {docs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-2 flex-shrink-0">
          {docs.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-xs text-blue-700">
              <FileText className="w-3 h-3" />
              <span className="max-w-32 truncate">{d.name}</span>
              <button onClick={() => setDocs(prev => prev.filter((_, j) => j !== i))}
                className="hover:text-red-500 transition-colors ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-3">

        {/* Welcome screen */}
        {messages.length === 0 && (
          <div className="text-center pt-4 pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Привет, я Рисковик!</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Знаю Базель III, нормативы НБТ, ISO 31000 и все модули платформы. Могу анализировать загруженные документы.
            </p>
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

        {/* Messages */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[82%] group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1B8A4C] text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                  : msg.content}
              </div>
              <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-gray-400">
                  {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && (
                  <button onClick={() => copyMsg(msg.id, msg.content)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    {copied === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied === msg.id ? 'Скопировано' : 'Копировать'}
                  </button>
                )}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0,150,300].map(d => (
                  <div key={d} className="w-2 h-2 bg-[#1B8A4C] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-white border border-gray-200 rounded-2xl shadow-sm p-3">
        <div className="flex gap-2 items-end">
          {/* File upload */}
          <input ref={fileRef} type="file" accept=".txt,.pdf,.md,.csv" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            title="Загрузить документ (.txt, .pdf, .md)"
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
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          📎 Загрузи документ (TXT/PDF) — Рисковик его прочитает и ответит на вопросы по нему
        </p>
      </div>
    </div>
  )
}

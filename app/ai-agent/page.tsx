'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Trash2, Copy, Check, ChevronDown } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  'Что такое PAR30 и как его интерпретировать?',
  'Какие нормативы ликвидности требует Базель III?',
  'Как провести стресс-тест операционного риска?',
  'Что такое Coverage Rate и какой норматив?',
  'Объясни методологию Монте Карло для рыночного риска',
  'Какие требования НБТ по достаточности капитала?',
  'Как оценить надёжность банка-контрагента?',
  'Что включает в себя ERM framework?',
]

const CONTEXT_OPTIONS = [
  { value: '', label: '💬 Общий вопрос' },
  { value: 'Пользователь работает в модуле Операционный риск — реестр инцидентов и стресс-тестирование.', label: '🛡️ Операционный риск' },
  { value: 'Пользователь работает в модуле Кредитный риск — анализ PAR30, Coverage Rate, стресс-тест.', label: '📄 Кредитный риск' },
  { value: 'Пользователь работает в модуле Рыночный риск — Монте Карло, анализ контрагентов.', label: '📈 Рыночный риск' },
  { value: 'Пользователь работает в модуле Риск ликвидности — стресс-тест T+1/T+7/T+30.', label: '💧 Риск ликвидности' },
  { value: 'Пользователь работает со стратегическими задачами ERM и управлением рисками на уровне банка.', label: '🎯 Стратегия / ERM' },
]

function formatMessage(text: string) {
  // Simple markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm font-mono">$1</code>')
    .replace(/\n/g, '<br/>')
}

export default function RiskovikPage() {
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [context,   setContext]   = useState('')
  const [copied,    setCopied]    = useState<string | null>(null)
  const [showSugg,  setShowSugg]  = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setShowSugg(false)

    try {
      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_a',
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }])
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: '⚠️ Ошибка: ' + (e instanceof Error ? e.message : String(e)),
        timestamp: new Date(),
      }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function clearChat() {
    if (!confirm('Очистить историю чата?')) return
    setMessages([])
    setShowSugg(true)
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-5rem)] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Рисковик</h1>
            <p className="text-xs text-gray-500">AI-ассистент по управлению рисками · Алиф Банк</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Context selector */}
          <select value={context} onChange={e => setContext(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B8A4C] bg-white text-gray-600 max-w-44">
            {CONTEXT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button onClick={clearChat}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">

        {/* Welcome */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Привет, я Рисковик!</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Я знаю Базель II/III, нормативы НБТ и все модули вашей платформы.
              Задайте любой вопрос по управлению рисками.
            </p>
          </div>
        )}

        {/* Suggested questions */}
        {showSugg && messages.length === 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 text-center">Частые вопросы</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#1B8A4C] hover:bg-green-50 transition-all">
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
              <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] group ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1B8A4C] text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  : msg.content
                }
              </div>
              <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-gray-400">
                  {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && (
                  <button onClick={() => copyMessage(msg.id, msg.content)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    {copied === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied === msg.id ? 'Скопировано' : 'Копировать'}
                  </button>
                )}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1B8A4C] to-[#145c32] rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-[#1B8A4C] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#1B8A4C] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#1B8A4C] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border border-gray-200 rounded-2xl shadow-sm p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Задайте вопрос по управлению рисками... (Enter — отправить, Shift+Enter — новая строка)"
            rows={2}
            className="flex-1 resize-none border-0 outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent leading-relaxed"
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 bg-[#1B8A4C] text-white rounded-xl flex items-center justify-center hover:bg-[#177040] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 px-1">
          Рисковик знает Базель II/III, нормативы НБТ и все модули платформы. Данные клиентов не передаются.
        </p>
      </div>
    </div>
  )
}

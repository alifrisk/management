// Single AI provider abstraction. To switch to Gemini: set AI_PROVIDER=gemini in env.
const PROVIDER = (process.env.AI_PROVIDER || 'claude') as 'claude' | 'gemini'

export async function aiGenerateText(prompt: string, maxTokens = 2000): Promise<string> {
  return PROVIDER === 'gemini' ? geminiText(prompt, maxTokens) : claudeText(prompt, maxTokens)
}

export async function aiExtractFromImage(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  prompt: string,
  maxTokens = 3000
): Promise<string> {
  return PROVIDER === 'gemini'
    ? geminiVision(imageBase64, mimeType, prompt, maxTokens)
    : claudeVision(imageBase64, mimeType, prompt, maxTokens)
}

export async function aiExtractFromPDF(pdfBase64: string, maxTokens = 4000): Promise<string> {
  return PROVIDER === 'gemini'
    ? geminiText(`Извлеки весь текст из прикреплённого PDF документа. Сохрани структуру: заголовки, таблицы (в виде текста), абзацы.`, maxTokens)
    : claudePDF(pdfBase64, maxTokens)
}

// ── Claude ──────────────────────────────────────────────────────────────────
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY || ''

async function claudeText(prompt: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  return parseClaude(res)
}

async function claudeVision(imageBase64: string, mimeType: string, prompt: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  return parseClaude(res)
}

async function claudePDF(pdfBase64: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY(),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Извлеки весь текст из этого PDF документа. Сохрани структуру: заголовки, таблицы (в виде текста), абзацы. Верни только текст без лишних пояснений.' },
        ],
      }],
    }),
  })
  return parseClaude(res)
}

async function parseClaude(res: Response): Promise<string> {
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude: ${data?.error?.message || res.status}`)
  const text = data.content?.[0]?.text || ''
  if (!text) throw new Error('Claude вернул пустой ответ')
  return text
}

// ── Gemini ───────────────────────────────────────────────────────────────────
const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GEMINI_KEY = () => process.env.GEMINI_API_KEY || ''

async function geminiText(prompt: string, maxTokens: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent?key=${GEMINI_KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    }
  )
  return parseGemini(res)
}

async function geminiVision(imageBase64: string, mimeType: string, prompt: string, maxTokens: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent?key=${GEMINI_KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  )
  return parseGemini(res)
}

async function parseGemini(res: Response): Promise<string> {
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message || res.status}`)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) throw new Error('Gemini вернул пустой ответ')
  return text
}

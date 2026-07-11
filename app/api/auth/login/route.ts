import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 10
const TTL_MINUTES  = 15

// Strip accidental /rest/v1 suffix — supabase-js appends it internally
function baseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
}

// Service role — only for login_attempts table (bypasses RLS)
function adminClient() {
  return createClient(
    baseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Anon key — for signInWithPassword (standard user auth operation)
function authClient() {
  return createClient(
    baseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getIP(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const ip         = getIP(req)
    const key        = `${ip}:${email.toLowerCase()}`
    const db         = adminClient()
    const anonClient = authClient()
    const now        = new Date()

    const { data: rec, error: selectError } = await db
      .from('login_attempts')
      .select('attempt_count, locked_until, updated_at')
      .eq('key', key)
      .maybeSingle()

    if (selectError) {
      console.error('[login] SELECT error', selectError.code, selectError.message)
      return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
    }

    const ageMin       = rec ? (now.getTime() - new Date(rec.updated_at).getTime()) / 60000 : Infinity
    const isStale      = ageMin >= TTL_MINUTES
    const currentCount = isStale ? 0 : (rec?.attempt_count ?? 0)

    if (!isStale && rec?.locked_until && new Date(rec.locked_until) > now) {
      const retryAfterSeconds = Math.ceil(
        (new Date(rec.locked_until).getTime() - now.getTime()) / 1000
      )
      return NextResponse.json(
        { error: 'Слишком много попыток. Аккаунт временно заблокирован.', retryAfterSeconds },
        { status: 429 }
      )
    }

    const { data, error: signInError } = await anonClient.auth.signInWithPassword({ email, password })

    if (signInError || !data.session) {
      const newCount    = currentCount + 1
      const lockedUntil = newCount >= MAX_ATTEMPTS
        ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null

      if (rec) {
        await db
          .from('login_attempts')
          .update({ attempt_count: newCount, locked_until: lockedUntil, updated_at: now.toISOString() })
          .eq('key', key)
      } else {
        await db
          .from('login_attempts')
          .insert({ key, attempt_count: newCount, locked_until: lockedUntil, updated_at: now.toISOString() })
      }

      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newCount)
      return NextResponse.json(
        { error: 'Неверный email или пароль.', attemptsLeft },
        { status: 401 }
      )
    }

    await db.from('login_attempts').delete().eq('key', key)

    return NextResponse.json({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_id:       data.session.user.id,
    })
  } catch (err) {
    console.error('[login] unexpected error', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

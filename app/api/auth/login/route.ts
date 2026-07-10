import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 10
const TTL_MINUTES  = 15

// Service role — only for login_attempts table (bypasses RLS)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Anon key — for signInWithPassword (standard user auth operation)
function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

    console.log('[login] START', { email, ip, key })
    console.log('[login] ENV check', {
      hasUrl:         !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey:     !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })

    // Read current rate-limit record (service role bypasses RLS)
    const { data: rec, error: selectError } = await db
      .from('login_attempts')
      .select('attempt_count, locked_until, updated_at')
      .eq('key', key)
      .maybeSingle()

    console.log('[login] SELECT login_attempts', {
      rec,
      selectError: selectError ? { message: selectError.message, code: selectError.code, details: selectError.details } : null,
    })

    // Record is stale (older than TTL) or absent → treat as fresh
    const ageMin       = rec ? (now.getTime() - new Date(rec.updated_at).getTime()) / 60000 : Infinity
    const isStale      = ageMin >= TTL_MINUTES
    const currentCount = isStale ? 0 : (rec?.attempt_count ?? 0)

    console.log('[login] rate-limit state', { ageMin, isStale, currentCount })

    // Blocked?
    if (!isStale && rec?.locked_until && new Date(rec.locked_until) > now) {
      const retryAfterSeconds = Math.ceil(
        (new Date(rec.locked_until).getTime() - now.getTime()) / 1000
      )
      console.log('[login] BLOCKED', { retryAfterSeconds })
      return NextResponse.json(
        { error: 'Слишком много попыток. Аккаунт временно заблокирован.', retryAfterSeconds },
        { status: 429 }
      )
    }

    // Attempt sign-in via anon-key client (standard user auth operation)
    console.log('[login] calling signInWithPassword...')
    const { data, error: signInError } = await anonClient.auth.signInWithPassword({ email, password })

    console.log('[login] signInWithPassword result', {
      hasSession: !!data?.session,
      signInError: signInError ? {
        message: signInError.message,
        status:  (signInError as { status?: number }).status,
        name:    signInError.name,
      } : null,
    })

    if (signInError || !data.session) {
      const newCount    = currentCount + 1
      const lockedUntil = newCount >= MAX_ATTEMPTS
        ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null

      console.log('[login] UPSERT login_attempts', { key, newCount, lockedUntil })
      const { error: upsertError } = await db.from('login_attempts').upsert({
        key,
        attempt_count: newCount,
        locked_until:  lockedUntil,
        updated_at:    now.toISOString(),
      })
      console.log('[login] UPSERT result', {
        upsertError: upsertError ? { message: upsertError.message, code: upsertError.code, details: upsertError.details } : null,
      })

      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newCount)
      return NextResponse.json(
        { error: 'Неверный email или пароль.', attemptsLeft },
        { status: 401 }
      )
    }

    // Success — clear counter
    console.log('[login] SUCCESS — clearing counter')
    await db.from('login_attempts').delete().eq('key', key)

    return NextResponse.json({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_id:       data.session.user.id,
    })
  } catch (err) {
    console.error('[login] CATCH', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createServerClient } from '@/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = createServerClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email' | 'recovery' | 'email_change',
      token_hash,
    })
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}

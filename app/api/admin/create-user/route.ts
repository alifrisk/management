import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, department, position } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    // Log for debugging
    console.log('URL:', supabaseUrl ? 'set' : 'MISSING')
    console.log('KEY:', serviceKey ? 'set' : 'MISSING')
    console.log('Email:', email)

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: `Config missing: url=${!!supabaseUrl} key=${!!serviceKey}` }, { status: 500 })
    }

    // Clean URL - remove trailing slash
    const cleanUrl = supabaseUrl.replace(/\/$/, '')

    const supabaseAdmin = createClient(cleanUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) {
      console.error('Auth error:', authErr.message)
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert({
      id: authData.user.id,
      email: email.trim(),
      full_name,
      role: role || 'observer',
      department: department || null,
      position: position || null,
      is_active: true,
    })

    if (profileErr) {
      console.error('Profile error:', profileErr.message)
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role, department, position } = await request.json()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    // Create profile
    const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert({
      id: authData.user.id,
      email,
      full_name,
      role: role || 'observer',
      department: department || null,
      position: position || null,
      is_active: true,
    })

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

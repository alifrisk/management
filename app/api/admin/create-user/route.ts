import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role, department, position } = await request.json()

    // Use service role key - only available server-side
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) throw new Error(authErr.message)

    // Create profile
    const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert({
      id: authData.user.id,
      email,
      full_name,
      role,
      department: department || null,
      position: position || null,
      is_active: true,
    })

    if (profileErr) throw new Error(profileErr.message)

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}

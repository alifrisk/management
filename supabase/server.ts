import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hdxylbhdconhttsdvbwv.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkeHlsYmhkY29uaHR0c2R2Ynd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzY5NTgsImV4cCI6MjA5NDE1Mjk1OH0.XFdtK5JMXD-nJrqQxYIl1APjVscmmKP4gVXwQ-WHxA0'
  )
}

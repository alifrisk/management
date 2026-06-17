import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block direct access to admin routes without a Supabase session cookie
  if (pathname.startsWith('/admin')) {
    const hasSession =
      request.cookies.has('sb-hdxylbhdconhttsdvbwv-auth-token') ||
      request.cookies.has('sb-access-token') ||
      request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

    if (!hasSession) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}

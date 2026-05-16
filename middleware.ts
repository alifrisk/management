import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  const protectedPaths = ['/dashboard', '/operational-risk', '/credit-risk', '/market-risk', '/liquidity', '/admin']
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))

  if (isProtected) {
    // Check for supabase auth cookie
    const hasAuth = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
    if (!hasAuth) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

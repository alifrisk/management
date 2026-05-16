import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const protectedPaths = ['/dashboard', '/operational-risk', '/credit-risk', '/market-risk', '/liquidity', '/admin']
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (isProtected) {
    const supabaseToken = request.cookies.get('sb-hdxylbhdconhttsdvbwv-auth-token')
    if (!supabaseToken) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

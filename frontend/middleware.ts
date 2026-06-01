import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware for standard server-side route protection.
 * Ensures users cannot access protected routes without an active session cookie,
 * preventing any page refresh flicker or client-side redirect flashes.
 */
export function middleware(request: NextRequest): NextResponse {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  // 1. Protect all /dashboard paths
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 2. Redirect logged-in users away from auth pages
  if (pathname === '/login' || pathname === '/register') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // 3. Handle root route redirection
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - static files (_next/static/*, _next/image/*)
     * - asset files (favicon.ico, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

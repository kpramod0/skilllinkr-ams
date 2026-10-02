import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const IS_DEV = process.env.NODE_ENV === 'development'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })



  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, maxAge: 5184000 })
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // Subdomain rewrite: ams.skilllinkr.com -> /ams route
  if (host.startsWith('ams.') && !pathname.startsWith('/ams') && !pathname.startsWith('/api')) {
    const url = request.nextUrl.clone()
    url.pathname = `/ams${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // Redirect to correct login page if accessing protected routes without a session
  if (!user) {
    if (pathname.startsWith('/ams') && pathname !== '/ams/login' && pathname !== '/ams/reset-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/ams/login'
      return NextResponse.redirect(url)
    } else if (pathname.startsWith('/main')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}



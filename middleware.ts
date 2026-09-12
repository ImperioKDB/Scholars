import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from './lib/supabase/middleware'
import { safeNextPath } from './lib/auth/next'

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/applications',
  '/achievements',
  '/scholarships',
  '/discover',
  '/opportunities',
  '/settings',
  '/onboarding',
  '/admin'
]

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/reset-password',
  '/confirm',
  '/privacy',
  '/terms'
]

export async function middleware(request: NextRequest) {
  const { path } = request.nextUrl
  const isProtected = protectedRoutes.some(route => 
    path === route || path.startsWith(route + '/')
  )
  const isPublic = publicRoutes.some(route => 
    path === route || path.startsWith(route + '/')
  )

  // Create authenticated Supabase Client
  const supabase = createClient(request)

  // Refresh session if expired - required for Server Components
  // This could be done in a separate middleware but we do it here for simplicity
  await supabase.auth.getSession()

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect to login if accessing protected route without session
  if (isProtected && !session) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if accessing public route with session
  // Except for the reset password flow
  if (isPublic && session && !path.includes('/reset-password')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Handle admin route protection
  if (path.startsWith('/admin') && session) {
    // Check if user is admin - we'll do this on the server side in the admin pages
    // but this middleware can add a header for quick client-side checks
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Only update last_seen every 5 minutes to reduce DB writes
      const lastSeen = user.user_metadata?.last_seen ? new Date(user.user_metadata.last_seen) : null;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (!lastSeen || lastSeen < fiveMinutesAgo) {
        // Update profile last_seen via service role client (bypass RLS)
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
          
        // Update user metadata for session
        await supabase.auth.updateUser({
          data: { last_seen: new Date().toISOString() }
        });
      }
    }
  }

  // Continue if no redirects are needed
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}

// Helper to create admin client with service role key
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(url, serviceRoleKey)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (local assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|assets).*)',
  ],
}
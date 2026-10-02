import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, { ...options, maxAge: 5184000 })
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
      },
      global: {
        fetch: async (url, options) => {
          let retries = 3;
          while (retries > 0) {
            try {
              return await fetch(url, { ...options, keepalive: false });
            } catch (error: any) {
              if (error.cause?.code === 'ECONNRESET' && retries > 1) {
                retries--;
                await new Promise(res => setTimeout(res, 500));
                continue;
              }
              throw error;
            }
          }
          return fetch(url, options);
        }
      }
    }
  )
}

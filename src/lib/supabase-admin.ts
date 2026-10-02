import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// SEC-005: Hard fail if service role key is missing — do NOT fall back to anon key.
// The anon key does not bypass RLS, causing silent data failures that are hard to debug.
// This error will appear in server startup logs and Vercel build output.
if (!supabaseServiceRoleKey && process.env.NODE_ENV !== 'test') {
    console.error(
        '[supabase-admin] FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Server-side admin operations WILL fail. Set this in your environment variables.'
    );
}

export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : (process.env.NODE_ENV === 'test'
        ? createClient('https://mock.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30')
        : (() => { throw new Error('[supabase-admin] Cannot create admin client: SUPABASE_SERVICE_ROLE_KEY is not set.') })() as any);

/**
 * Robust, supported helper to locate a Supabase Auth user by email address.
 * Replaces non-existent `supabaseAdmin.auth.admin.getUserByEmail` SDK method.
 * Uses O(1) indexed lookup via profiles.auth_id with fallback to listUsers().
 */
export async function getAuthUserByEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return null;

    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('auth_id')
            .eq('id', normalized)
            .maybeSingle();

        if (profile?.auth_id) {
            const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(profile.auth_id);
            if (!error && userData?.user) {
                return userData.user;
            }
        }
    } catch {
        // Fall through to listUsers fallback
    }

    try {
        let page = 1;
        const perPage = 50;
        while (page <= 10) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
            if (error || !data?.users || data.users.length === 0) break;

            const matched = data.users.find((u: any) => u.email?.toLowerCase() === normalized);
            if (matched) return matched;

            if (data.users.length < perPage) break;
            page++;
        }
    } catch {
        // Return null if search fails
    }

    return null;
}

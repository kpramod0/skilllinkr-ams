import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAmsAccess, enforceAmsMfa } from "@/lib/academic-ams-service";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await enforceAmsMfa(supabase); const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin.from("academic_cycles").select(`
      *,
      academic_modules (code, title),
      academic_periods (code, title)
    `, { count: 'exact' });

    if (!access.isSuperAdmin && access.domain) {
      query = query.eq("university_domain", access.domain);
    }

    const { data: cycles, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({ 
      cycles: cycles || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch cycles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    await enforceAmsMfa(supabase); const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { university_domain, academic_module_id, academic_period_id, participation_mode, allowed_domains, min_team_size, max_team_size } = body;

    const domainToUse = access.isSuperAdmin ? university_domain : access.domain;

    const { data: cycle, error } = await supabaseAdmin
      .from("academic_cycles")
      .upsert({
        university_domain: domainToUse,
        academic_module_id,
        academic_period_id,
        participation_mode: participation_mode || "group",
        allowed_domains: allowed_domains || [],
        min_team_size: min_team_size || 1,
        max_team_size: max_team_size || 6,
        status: "open",
        updated_at: new Date().toISOString(),
      }, { onConflict: "university_domain,academic_module_id,academic_period_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ cycle });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save cycle" }, { status: 500 });
  }
}


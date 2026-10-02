import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAmsAccess, enforceAmsMfa } from "@/lib/academic-ams-service";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/ams/faculty-capacity
 * Returns faculty availability/offering records for the Admin's institution.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const access = await checkAmsAccess(user.email);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("faculty_availability")
      .select("*, academic_modules(code, title), academic_periods(code, title)", { count: 'exact' });

    if (!access.isSuperAdmin && access.domain) {
      query = query.eq("university_domain", access.domain);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw error;

    return NextResponse.json({ 
      faculty_offerings: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/ams/faculty-capacity
 * Academic Admin configures faculty offering capacity, domains, audience.
 * Faculty cannot self-publish; only Academic Admin configures this.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    // MFA STEP-UP: Ensure AAL2 for AMS administrative actions
    await enforceAmsMfa(supabase);

    const access = await checkAmsAccess(user.email);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const {
      faculty_id,
      academic_module_id,
      academic_period_id,
      cycle_id,
      capacity_mode,
      max_groups,
      min_students_per_group,
      max_students_per_group,
      max_individual_students,
      max_total_students,
      accepted_domains,
      audience_type,
      selected_student_ids,
      application_deadline,
      is_open,
    } = body;

    if (!faculty_id || !academic_module_id || !academic_period_id || !capacity_mode) {
      return NextResponse.json({ error: "faculty_id, academic_module_id, academic_period_id, capacity_mode are required" }, { status: 400 });
    }

    if (!["GROUPS", "INDIVIDUAL"].includes(capacity_mode)) {
      return NextResponse.json({ error: "Invalid capacity_mode" }, { status: 400 });
    }

    // Derive domain from faculty email or use Admin's domain
    const domainToUse = access.isSuperAdmin
      ? faculty_id.includes("@") ? faculty_id.split("@")[1] : access.domain
      : access.domain!;

    // Validate the faculty belongs to this institution domain
    if (!access.isSuperAdmin) {
      const facultyDomain = faculty_id.includes("@") ? faculty_id.split("@")[1] : null;
      if (facultyDomain && facultyDomain !== domainToUse) {
        return NextResponse.json({ error: "Faculty does not belong to your institution domain" }, { status: 403 });
      }
    }

    // Cannot lower max below existing active allocations
    if (max_groups !== undefined || max_total_students !== undefined) {
      const { count: activeGroups } = await supabaseAdmin
        .from("academic_project_assignments")
        .select("*", { count: "exact", head: true })
        .eq("faculty_id", faculty_id.toLowerCase().trim())
        .eq("academic_module_id", academic_module_id)
        .eq("academic_period_id", academic_period_id)
        .eq("status", "active");

      const { count: activeStudents } = await supabaseAdmin
        .from("academic_student_allocations")
        .select("*", { count: "exact", head: true })
        .eq("faculty_id", faculty_id.toLowerCase().trim())
        .eq("academic_module_id", academic_module_id)
        .eq("academic_period_id", academic_period_id)
        .eq("status", "active");

      if (max_groups !== undefined && max_groups < (activeGroups || 0)) {
        return NextResponse.json({ error: `Cannot lower max_groups below existing active allocations (${activeGroups})` }, { status: 400 });
      }
      if (max_total_students !== undefined && max_total_students < (activeStudents || 0)) {
        return NextResponse.json({ error: `Cannot lower max_total_students below existing active student allocations (${activeStudents})` }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("faculty_availability")
      .upsert({
        university_domain: domainToUse,
        faculty_id: faculty_id.toLowerCase().trim(),
        academic_module_id,
        academic_period_id,
        cycle_id: cycle_id || null,
        capacity_mode,
        max_groups: capacity_mode === "GROUPS" ? (max_groups ?? null) : null,
        min_students_per_group: capacity_mode === "GROUPS" ? (min_students_per_group ?? null) : null,
        max_students_per_group: capacity_mode === "GROUPS" ? (max_students_per_group ?? null) : null,
        max_individual_students: capacity_mode === "INDIVIDUAL" ? (max_individual_students ?? null) : null,
        max_total_students: max_total_students ?? null,
        accepted_domains: accepted_domains || [],
        audience_type: audience_type || "ALL_ELIGIBLE",
        selected_student_ids: audience_type === "SELECTED_STUDENTS" ? (selected_student_ids || []) : [],
        application_deadline: application_deadline || null,
        is_open: is_open !== undefined ? !!is_open : true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "university_domain,faculty_id,academic_module_id,academic_period_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ offering: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    await enforceAmsMfa(supabase); const access = await checkAmsAccess(user.email);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("academic_evaluation_schemes")
      .select(`
        *,
        academic_scheme_components (*)
      `, { count: 'exact' });

    if (!access.isSuperAdmin && access.domain) {
      query = query.eq("university_domain", access.domain);
    }

    const { data: schemes, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;

    return NextResponse.json({ 
      schemes: schemes || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch evaluation schemes" }, { status: 500 });
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

    await enforceAmsMfa(supabase); const access = await checkAmsAccess(user.email);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, total_max_marks, instructions, cycle_id, components } = body;

    const domainToUse = access.domain || "kiit.ac.in";

    // Component max sum validation
    let componentSum = 0;
    if (Array.isArray(components)) {
      for (const comp of components) {
        componentSum += Number(comp.max_marks || 0);
      }
    }

    if (Math.abs(componentSum - Number(total_max_marks)) > 0.01) {
      return NextResponse.json(
        {
          error: `Component maxima sum (${componentSum}) does not match scheme total (${total_max_marks}). Please adjust components or scheme total.`,
        },
        { status: 400 }
      );
    }

    // Insert scheme
    const { data: scheme, error: schemeErr } = await supabaseAdmin
      .from("academic_evaluation_schemes")
      .insert({
        university_domain: domainToUse,
        cycle_id: cycle_id || null,
        name: name.trim(),
        total_max_marks: Number(total_max_marks),
        instructions: instructions || null,
        status: "published",
        created_by: user.email,
      })
      .select()
      .single();

    if (schemeErr) throw schemeErr;

    // Insert components
    if (Array.isArray(components) && components.length > 0) {
      const compRows = components.map((comp: any, index: number) => ({
        scheme_id: scheme.id,
        name: comp.name,
        max_marks: Number(comp.max_marks),
        target_scope: comp.target_scope || "group",
        is_rubric: !!comp.is_rubric,
        rubric_criteria: comp.rubric_criteria || [],
        instructions: comp.instructions || null,
        display_order: index + 1,
        is_required: comp.is_required !== false,
        group_max_marks: comp.group_max_marks ? Number(comp.group_max_marks) : null,
        individual_max_marks: comp.individual_max_marks ? Number(comp.individual_max_marks) : null,
      }));

      const { error: compErr } = await supabaseAdmin
        .from("academic_scheme_components")
        .insert(compRows);

      if (compErr) throw compErr;
    }

    return NextResponse.json({ scheme });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create evaluation scheme" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAmsAccess } from "@/lib/academic-ams-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkAmsAccess(user.id);
    if (!access.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all institutions with admin and cycle counts
    const { data: institutionsRaw } = await supabaseAdmin
      .from("institutions")
      .select(`
        id,
        code,
        name,
        status,
        created_at,
        academic_admin_assignments(count),
        academic_cycles(count),
        academic_admin_invitations(count)
      `)
      .order("name");

    const institutions = (institutionsRaw || []).map((inst: any) => ({
      id: inst.id,
      code: inst.code,
      name: inst.name,
      status: inst.status,
      created_at: inst.created_at,
      adminCount: inst.academic_admin_assignments?.[0]?.count ?? 0,
      cycleCount: inst.academic_cycles?.[0]?.count ?? 0,
      pendingInvites: inst.academic_admin_invitations?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ institutions });
  } catch (err: any) {
    console.error("Institutions list error:", err);
    return NextResponse.json({ error: "Failed to load institutions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkAmsAccess(user.id);
    if (!access.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Institution name and code are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("institutions")
      .insert({ name: name.trim(), code: code.trim().toUpperCase() })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ institution: data });
  } catch (err: any) {
    console.error("Create institution error:", err);
    return NextResponse.json({ error: "Failed to create institution" }, { status: 500 });
  }
}

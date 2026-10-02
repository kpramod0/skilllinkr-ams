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

    const [
      { count: institutionsCount },
      { count: adminsCount },
      { count: cyclesCount },
      { count: projectsCount },
    ] = await Promise.all([
      supabaseAdmin.from("institutions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("academic_admin_assignments").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("academic_cycles").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("academic_project_assignments").select("*", { count: "exact", head: true }).eq("status", "active"),
    ]);

    return NextResponse.json({
      institutions: institutionsCount || 0,
      administrators: adminsCount || 0,
      activeCycles: cyclesCount || 0,
      projects: projectsCount || 0,
    });
  } catch (err: any) {
    console.error("Dashboard metrics error:", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAmsAccess } from "@/lib/academic-ams-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkAmsAccess(user.email);
    if (!access.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Get unique institutions (domains)
    const { data: domainsData } = await supabaseAdmin
      .from("academic_admins")
      .select("university_domain");
      
    const uniqueInstitutions = new Set((domainsData || []).map(d => d.university_domain));

    // 2. Get active administrators count
    const { count: adminsCount } = await supabaseAdmin
      .from("academic_admins")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // 3. Get active cycles count
    const { count: cyclesCount } = await supabaseAdmin
      .from("academic_cycles")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    // 4. Get total allocated projects
    const { count: projectsCount } = await supabaseAdmin
      .from("academic_project_assignments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    return NextResponse.json({
      institutions: uniqueInstitutions.size,
      administrators: adminsCount || 0,
      activeCycles: cyclesCount || 0,
      projects: projectsCount || 0
    });
  } catch (err: any) {
    console.error("Dashboard metrics error:", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}

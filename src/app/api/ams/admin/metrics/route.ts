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
    if (!access.isAdmin && !access.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const institutionId = access.institutionId;

    // For super admin, aggregate across all institutions
    const institutionFilter = institutionId
      ? { institution_id: institutionId }
      : {};

    const [
      { count: eligibleStudents },
      { count: allocatedProjects },
      { count: activeCycles },
    ] = await Promise.all([
      supabaseAdmin
        .from("academic_student_eligibility")
        .select("*", { count: "exact", head: true })
        .match(institutionFilter),
      supabaseAdmin
        .from("academic_project_assignments")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .match(institutionFilter),
      supabaseAdmin
        .from("academic_cycles")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .match(institutionFilter),
    ]);

    return NextResponse.json({
      eligibleStudents: eligibleStudents ?? 0,
      allocatedProjects: allocatedProjects ?? 0,
      activeCycles: activeCycles ?? 0,
    });
  } catch (err: any) {
    console.error("Admin metrics error:", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}

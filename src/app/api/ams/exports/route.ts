import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAmsAccess, sanitizeCsvCell, enforceAmsMfa } from "@/lib/academic-ams-service";
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

    // MFA STEP-UP: Ensure AAL2 for AMS administrative actions
    await enforceAmsMfa(supabase);

    const access = await checkAmsAccess(user.email);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const type = request.nextUrl.searchParams.get("type") || "allocations";

    if (type === "allocations") {
      let query = supabaseAdmin.from("academic_project_assignments").select(`
        project_id_code,
        university_domain,
        faculty_id,
        status,
        started_at,
        teams (name, project_domain)
      `);

      if (!access.isSuperAdmin && access.domain) {
        query = query.eq("university_domain", access.domain);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      // Build CSV with formula sanitization
      const headers = ["Project ID Code", "University Domain", "Team Name", "Domain", "Faculty ID", "Status", "Started At"];
      const csvLines = [headers.join(",")];

      for (const r of rows || []) {
        const line = [
          sanitizeCsvCell(r.project_id_code),
          sanitizeCsvCell(r.university_domain),
          sanitizeCsvCell((r.teams as any)?.name || ""),
          sanitizeCsvCell((r.teams as any)?.project_domain || ""),
          sanitizeCsvCell(r.faculty_id),
          sanitizeCsvCell(r.status),
          sanitizeCsvCell(r.started_at),
        ];
        csvLines.push(line.map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
      }

      const csvContent = csvLines.join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="academic_allocations_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "shared_evaluations") {
      // Return ONLY evaluations explicitly shared with Academic Administration!
      // Must filter by university_domain to prevent cross-institution leaks for Academic Admins
      let query = supabaseAdmin
        .from("academic_evaluations")
        .select(`
          *,
          assignment:academic_project_assignments!inner(university_domain)
        `)
        .eq("share_with_academic", true);

      if (!access.isSuperAdmin && access.domain) {
        query = query.eq("assignment.university_domain", access.domain);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const headers = ["Evaluation ID", "Assignment ID", "Evaluator ID", "Total Score", "Shared At"];
      const csvLines = [headers.join(",")];

      for (const r of rows || []) {
        const line = [
          sanitizeCsvCell(r.id),
          sanitizeCsvCell(r.assignment_id),
          sanitizeCsvCell(r.evaluator_id),
          sanitizeCsvCell(r.total_score),
          sanitizeCsvCell(r.shared_with_academic_at || r.updated_at),
        ];
        csvLines.push(line.map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
      }

      const csvContent = csvLines.join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="academic_shared_evaluations_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid export type requested" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate export" }, { status: 500 });
  }
}

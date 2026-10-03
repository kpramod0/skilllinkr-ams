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
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    let query = supabaseAdmin.from("academic_cycles").select('*', { count: 'exact' });

    if (!access.isSuperAdmin && access.institutionId) {
      query = query.eq("institution_id", access.institutionId);
    } else if (!access.isSuperAdmin) {
      return NextResponse.json({ error: "No institution scope assigned" }, { status: 403 });
    }

    const { data: cycles, error, count } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ cycles: cycles || [] });
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
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    if (process.env.NODE_ENV !== "development" || process.env.AMS_LOCAL_MFA_BYPASS !== "true") {
      await enforceAmsMfa(supabase); 
    }

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (!access.isSuperAdmin && !access.institutionId) return NextResponse.json({ error: "No institution scope assigned" }, { status: 403 });

    const body = await request.json();
    const { name, start_date, end_date, status } = body;

    if (!name || name.trim() === "") return NextResponse.json({ error: "Cycle name is required" }, { status: 400 });

    const sDate = start_date ? new Date(start_date) : null;
    const eDate = end_date ? new Date(end_date) : null;
    if (sDate && eDate && eDate < sDate) return NextResponse.json({ error: "End date cannot be earlier than start date" }, { status: 400 });

    const validStatuses = ["draft", "active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const instToUse = access.isSuperAdmin && body.institution_id ? body.institution_id : access.institutionId;

    const { data: cycle, error } = await supabaseAdmin
      .from("academic_cycles")
      .insert({
        institution_id: instToUse,
        name: name.trim(),
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || "draft",
        created_at: new Date().toISOString(),
      })
      .select().single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: "A cycle with this name already exists for your institution" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ message: "Cycle created successfully", cycle }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create cycle" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    if (process.env.NODE_ENV !== "development" || process.env.AMS_LOCAL_MFA_BYPASS !== "true") {
      await enforceAmsMfa(supabase); 
    }

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { id, name, start_date, end_date, status } = body;

    if (!id) return NextResponse.json({ error: "Cycle ID is required" }, { status: 400 });
    
    const { data: existingCycle } = await supabaseAdmin.from("academic_cycles").select("institution_id").eq("id", id).single();
    if (!existingCycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    if (!access.isSuperAdmin && existingCycle.institution_id !== access.institutionId) return NextResponse.json({ error: "Forbidden: You cannot modify cycles for another institution" }, { status: 403 });

    if (name && name.trim() === "") return NextResponse.json({ error: "Cycle name cannot be empty" }, { status: 400 });
    const validStatuses = ["draft", "active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const sDate = start_date ? new Date(start_date) : null;
    const eDate = end_date ? new Date(end_date) : null;
    if (sDate && eDate && eDate < sDate) return NextResponse.json({ error: "End date cannot be earlier than start date" }, { status: 400 });

    const { data: cycle, error } = await supabaseAdmin
      .from("academic_cycles")
      .update({
        ...(name ? { name: name.trim() } : {}),
        ...(start_date !== undefined ? { start_date: start_date || null } : {}),
        ...(end_date !== undefined ? { end_date: end_date || null } : {}),
        ...(status ? { status } : {})
      })
      .eq("id", id).select().single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: "A cycle with this name already exists for your institution" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ message: "Cycle updated successfully", cycle });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update cycle" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    if (process.env.NODE_ENV !== "development" || process.env.AMS_LOCAL_MFA_BYPASS !== "true") {
      await enforceAmsMfa(supabase); 
    }

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Cycle ID is required" }, { status: 400 });

    const { data: existingCycle } = await supabaseAdmin.from("academic_cycles").select("institution_id").eq("id", id).single();
    if (!existingCycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    if (!access.isSuperAdmin && existingCycle.institution_id !== access.institutionId) return NextResponse.json({ error: "Forbidden: Cannot delete cycle from another institution" }, { status: 403 });

    const { count: studentCount } = await supabaseAdmin.from("academic_student_eligibility").select("*", { count: 'exact', head: true }).eq("cycle_id", id);
    if (studentCount && studentCount > 0) return NextResponse.json({ error: "Cannot delete cycle: There are student eligibility records tied to this cycle. Please archive it instead." }, { status: 409 });
    
    const { count: facultyCount } = await supabaseAdmin.from("faculty_eligibility").select("*", { count: 'exact', head: true }).eq("cycle_id", id);
    if (facultyCount && facultyCount > 0) return NextResponse.json({ error: "Cannot delete cycle: There are faculty eligibility records tied to this cycle. Please archive it instead." }, { status: 409 });

    const { count: moduleCount } = await supabaseAdmin.from("academic_modules").select("*", { count: 'exact', head: true }).eq("cycle_id", id);
    if (moduleCount && moduleCount > 0) return NextResponse.json({ error: "Cannot delete cycle: There are academic modules tied to this cycle. Please archive it instead." }, { status: 409 });

    const { error } = await supabaseAdmin.from("academic_cycles").delete().eq("id", id);
    if (error) {
      if (error.code === '23503') return NextResponse.json({ error: "Cannot delete cycle: It is actively referenced by other modules. Please archive it instead." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ message: "Cycle permanently deleted", success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete cycle" }, { status: 500 });
  }
}
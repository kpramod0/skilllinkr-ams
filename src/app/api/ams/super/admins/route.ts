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

    const { data: admins } = await supabaseAdmin
      .from("academic_admin_assignments")
      .select(`
        id,
        auth_user_id,
        email,
        name,
        status,
        created_at,
        institution:institutions(id, name, code)
      `)
      .order("created_at", { ascending: false });

    const { data: invitations } = await supabaseAdmin
      .from("academic_admin_invitations")
      .select(`
        id,
        email,
        status,
        expires_at,
        created_at,
        institution:institutions(id, name, code)
      `)
      .order("created_at", { ascending: false });

    return NextResponse.json({ 
      admins: admins || [], 
      invitations: invitations || [],
    });
  } catch (err: any) {
    console.error("Admins list error:", err);
    return NextResponse.json({ error: "Failed to load administrators" }, { status: 500 });
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
    const { targetEmail, institutionId, tempPassword, name } = body;

    if (!targetEmail || !institutionId) {
      return NextResponse.json({ error: "Email and institution are required" }, { status: 400 });
    }

    const email = targetEmail.toLowerCase().trim();

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword || Math.random().toString(36).slice(-12) + "Aa1!",
      email_confirm: true,
    });

    let authUserId: string;
    if (authErr) {
      // If already exists, look up the user
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users.find((u: any) => u.email === email);
      if (!existing) throw new Error(`Failed to provision user: ${authErr.message}`);
      authUserId = existing.id;
    } else {
      authUserId = authData.user.id;
    }

    // 2. Create or update assignment
    const { data: assignment, error: assignErr } = await supabaseAdmin
      .from("academic_admin_assignments")
      .upsert({
        auth_user_id: authUserId,
        institution_id: institutionId,
        email,
        name: name || email.split("@")[0],
        status: "active",
      }, { onConflict: "auth_user_id,institution_id" })
      .select()
      .single();

    if (assignErr) throw new Error(`Failed to create assignment: ${assignErr.message}`);

    // 3. Create a pending invitation record for audit
    await supabaseAdmin.from("academic_admin_invitations").insert({
      institution_id: institutionId,
      email,
      status: "accepted",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ success: true, assignment });
  } catch (err: any) {
    console.error("Invite admin error:", err);
    return NextResponse.json({ error: err.message || "Failed to invite administrator" }, { status: 500 });
  }
}

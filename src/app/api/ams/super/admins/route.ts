import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAmsAccess, inviteAcademicAdmin } from "@/lib/academic-ams-service";

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

    const { data: admins } = await supabaseAdmin
      .from("academic_admins")
      .select(`
        id,
        user_id,
        university_domain,
        university_name,
        admin_name,
        admin_position,
        contact_no,
        status,
        created_at
      `)
      .order("created_at", { ascending: false });

    const { data: invitations } = await supabaseAdmin
      .from("academic_admin_invitations")
      .select(`
        id,
        email,
        university_domain,
        status,
        expires_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    return NextResponse.json({ 
      admins: admins || [], 
      invitations: invitations || [] 
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
    
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkAmsAccess(user.email);
    if (!access.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { targetEmail, universityDomain, tempPassword, name, position, contactNo } = body;

    if (!targetEmail || !universityDomain) {
      return NextResponse.json({ error: "Email and university domain are required" }, { status: 400 });
    }
    
    // Auto-derive university name from domain if possible (e.g. mit.edu -> Mit)
    const derivedName = universityDomain.split('.')[0];
    const universityName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);

    // Attempt to invite using the service function
    const invite = await inviteAcademicAdmin(user.email, targetEmail, universityDomain, {
      tempPassword,
      name,
      position,
      contactNo,
      universityName,
    });

    return NextResponse.json({ success: true, invite });
  } catch (err: any) {
    console.error("Invite admin error:", err);
    return NextResponse.json({ error: err.message || "Failed to invite administrator" }, { status: 500 });
  }
}

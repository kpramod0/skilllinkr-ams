import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if the user is an active administrator in AMS
    const { data: adminRow } = await supabaseAdmin
      .from("academic_admin_assignments")
      .select("status")
      .eq("email", email)
      .maybeSingle();

    const { data: superAdmin } = await supabaseAdmin
      .from("academic_super_admin_profiles")
      .select("status")
      .eq("email", email)
      .maybeSingle();

    const isValidAdmin = (adminRow && adminRow.status === "active") || (superAdmin && superAdmin.status === "active");

    if (!isValidAdmin) {
      return NextResponse.json(
        { 
          isAuthorized: false,
          error: "You are not registered as an administrator. Please contact the Authority of SkillLinkr." 
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ isAuthorized: true });
  } catch (err: any) {
    console.error("check-admin-email API error:", err);
    return NextResponse.json({ error: err.message || "Failed to verify admin status" }, { status: 500 });
  }
}

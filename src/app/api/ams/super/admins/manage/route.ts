import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAmsAccess } from "@/lib/academic-ams-service";

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
    const { adminId, inviteId, action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "cancel_invite") {
      if (!inviteId) return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("academic_admin_invitations")
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Pending invitation cancelled." });
    }

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 });
    }

    // First fetch the admin row
    const { data: adminRow } = await supabaseAdmin
      .from("academic_admins")
      .select("*")
      .eq("id", adminId)
      .single();

    if (!adminRow) {
      return NextResponse.json({ error: "Administrator not found" }, { status: 404 });
    }

    if (action === "suspend") {
      // Temporarily revoke access (prohibits login but keeps history)
      const { error } = await supabaseAdmin
        .from("academic_admins")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", adminId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Administrator access temporarily revoked." });
    } 
    
    else if (action === "restore") {
      // Restore access
      const { error } = await supabaseAdmin
        .from("academic_admins")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", adminId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Administrator access restored." });
    }
    
    else if (action === "delete") {
      // Permanent deletion
      // Delete from academic_admins. Since we want to wipe their history, we might also delete their Auth User if they are only an admin, 
      // but deleting from Auth might break other SkillLinkr parts if they are also a faculty/student.
      // So we will just delete their academic_admins record, which cascades/removes their admin authority.
      // If the user wants ALL their records wiped from AMS (like projects, cycles, etc.), that is a heavy operation.
      // For now, removing the academic_admins row means they are treated as a completely new admin if added again.
      
      const { error } = await supabaseAdmin
        .from("academic_admins")
        .delete()
        .eq("id", adminId);
        
      if (error) throw error;

      // Also clean up any pending invitations
      await supabaseAdmin
        .from("academic_admin_invitations")
        .delete()
        .eq("email", adminRow.user_id);

      return NextResponse.json({ success: true, message: "Administrator permanently deleted from AMS." });
    }
    
    else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("Manage admin error:", err);
    return NextResponse.json({ error: err.message || "Failed to manage administrator" }, { status: 500 });
  }
}

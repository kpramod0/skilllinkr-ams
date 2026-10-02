import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { otps } from "@/lib/db-helpers";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword, otp } = body;

    if (!otp || typeof otp !== 'string' || otp.trim() === '') {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    // Normalize email (strip .ams) so it matches academic_admins and invitations
    const realEmail = user.email.endsWith('.ams') ? user.email.slice(0, -4) : user.email;

    // 1. Verify they are currently pending onboarding
    const { data: adminRow } = await supabaseAdmin
      .from("academic_admins")
      .select("id")
      .eq("user_id", realEmail)
      .eq("status", "pending_onboarding")
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: "Not pending onboarding" }, { status: 403 });
    }

    // 2. Verify OTP
    const verifyResult = await otps.consumeReset(realEmail, otp.trim());
    if (!verifyResult.success) {
      if (verifyResult.errorCode === 'TOO_MANY_ATTEMPTS') {
        return NextResponse.json({ error: 'Too many failed attempts. Please request a new code.' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // 3. Update their Auth password
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (authErr) {
      throw new Error(`Failed to update password: ${authErr.message}`);
    }

    // 4. Mark as active in academic_admins
    const { error: adminErr } = await supabaseAdmin
      .from("academic_admins")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", adminRow.id);

    if (adminErr) throw adminErr;

    // 5. Update any pending invitations to accepted
    await supabaseAdmin
      .from("academic_admin_invitations")
      .update({ status: "accepted" })
      .eq("email", realEmail)
      .eq("status", "pending");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Onboarding complete error:", err);
    return NextResponse.json({ error: err.message || "Failed to complete onboarding" }, { status: 500 });
  }
}

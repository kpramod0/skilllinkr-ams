import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminRow } = await supabaseAdmin
      .from("academic_admins")
      .select("*")
      .eq("user_id", user.email)
      .eq("status", "pending_onboarding")
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: "Not pending onboarding" }, { status: 403 });
    }

    return NextResponse.json({ 
      user: { id: user.id, email: user.email }, 
      status: "pending_onboarding",
      adminData: adminRow 
    });
  } catch (err: any) {
    console.error("Onboarding check error:", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}

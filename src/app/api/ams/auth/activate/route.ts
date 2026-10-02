import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { activateAcademicAdmin } from "@/lib/academic-ams-service";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 });
    }

    await activateAcademicAdmin(user.email, invitationId);

    return NextResponse.json({ success: true, message: "AMS administrator access activated successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to activate invitation" },
      { status: err.message.includes("Verification") ? 403 : 400 }
    );
  }
}

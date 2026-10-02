import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAmsAccess } from "@/lib/academic-ams-service";

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

    const access = await checkAmsAccess(user.id);

    if (!access.isAdmin && !access.isSuperAdmin && access.status !== 'pending_onboarding') {
      return NextResponse.json(
        { error: "AMS Access Denied: Active administrator assignment required", access },
        { status: 403 }
      );
    }

    return NextResponse.json({ access, user: { id: user.id, email: user.email } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify AMS access" }, { status: 500 });
  }
}


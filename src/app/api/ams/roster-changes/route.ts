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
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("academic_roster_change_requests")
      .select(`
        *,
        teams (name, project_id_code),
        requested_by_profile:profiles!requested_by (full_name, email)
      `, { count: 'exact' })
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data: requests, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ 
      requests: requests || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch roster change requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { requestId, status, feedback } = body;

    // Call approve_roster_change_request RPC
    const { data, error } = await supabaseAdmin.rpc("approve_roster_change_request", {
      p_request_id: requestId,
      p_admin_id: user.email,
      p_status: status,
      p_feedback: feedback || null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, result: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process roster change request" }, { status: 500 });
  }
}


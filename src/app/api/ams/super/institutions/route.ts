import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAmsAccess } from "@/lib/academic-ams-service";

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

    // A registered institution is currently defined by having at least one Academic Admin,
    // Invitation, or Active Cycle. We'll group them by domain from these sources.
    
    const [
      { data: admins },
      { data: cycles },
      { data: invites }
    ] = await Promise.all([
      supabaseAdmin.from("academic_admins").select("university_domain, status, created_at"),
      supabaseAdmin.from("academic_cycles").select("university_domain, status"),
      supabaseAdmin.from("academic_admin_invitations").select("university_domain, status")
    ]);

    const domainMap = new Map<string, any>();

    const getDomain = (d: string) => {
      const normalized = d.toLowerCase().trim();
      if (!domainMap.has(normalized)) {
        domainMap.set(normalized, {
          domain: normalized,
          adminCount: 0,
          cycleCount: 0,
          pendingInvites: 0,
          firstSeen: new Date().toISOString()
        });
      }
      return domainMap.get(normalized);
    };

    if (admins) {
      admins.forEach(a => {
        const d = getDomain(a.university_domain);
        if (a.status === 'active') d.adminCount++;
        if (a.created_at < d.firstSeen) d.firstSeen = a.created_at;
      });
    }

    if (cycles) {
      cycles.forEach(c => {
        const d = getDomain(c.university_domain);
        if (c.status === 'open') d.cycleCount++;
      });
    }

    if (invites) {
      invites.forEach(i => {
        const d = getDomain(i.university_domain);
        if (i.status === 'pending') d.pendingInvites++;
      });
    }

    const institutions = Array.from(domainMap.values()).sort((a, b) => a.domain.localeCompare(b.domain));

    return NextResponse.json({ institutions });
  } catch (err: any) {
    console.error("Institutions list error:", err);
    return NextResponse.json({ error: "Failed to load institutions" }, { status: 500 });
  }
}

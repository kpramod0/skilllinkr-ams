import { supabaseAdmin } from "@/lib/supabase-admin";

export function normalizeAmsEmail(email: string | null | undefined): string {
  if (!email) return "";
  const normalized = email.toLowerCase().trim();
  return normalized.endsWith(".ams") ? normalized.slice(0, -4) : normalized;
}

/**
 * Formula Injection Protection for CSV / XLSX Exports
 * Neutralizes leading formula triggers =, +, -, @, \t, \r
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.length === 0) return "";
  const firstChar = str.charAt(0);
  if (["=", "+", "-", "@", "\t", "\r"].includes(firstChar)) {
    return "'" + str;
  }
  return str;
}

/**
 * Checks AMS administrative access and scope for a given auth user UUID.
 */
export async function checkAmsAccess(authUserId: string): Promise<{
  isSuperAdmin: boolean;
  isAdmin: boolean;
  domain: string | null;
  institutionId: string | null;
  institutionName: string | null;
  name?: string | null;
  status: string;
}> {
  if (!authUserId) {
    return { isSuperAdmin: false, isAdmin: false, domain: null, institutionId: null, institutionName: null, status: "unauthenticated", name: null };
  }

  // 1. Check Super Admin (keyed by auth_user_id UUID)
  const { data: superAdmin } = await supabaseAdmin
    .from("academic_super_admin_profiles")
    .select("status, name")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle();

  if (superAdmin) {
    return { isSuperAdmin: true, isAdmin: true, domain: "*", institutionId: null, institutionName: "All Institutions", status: "active", name: superAdmin.name };
  }

  // 2. Check Academic Admin (keyed by auth_user_id UUID), join institution name
  const { data: adminRow } = await supabaseAdmin
    .from("academic_admin_assignments")
    .select("institution_id, status, name, institution:institutions(id, name, code)")
    .eq("auth_user_id", authUserId)
    .in("status", ["active", "pending_onboarding"])
    .maybeSingle();

  if (adminRow) {
    const inst = adminRow.institution as any;
    return {
      isSuperAdmin: false,
      isAdmin: adminRow.status === "active",
      domain: inst?.code ?? adminRow.institution_id,
      institutionId: adminRow.institution_id,
      institutionName: inst?.name ?? adminRow.institution_id,
      status: adminRow.status,
        name: adminRow.name,
    };
  }

  return { isSuperAdmin: false, isAdmin: false, domain: null, institutionId: null, institutionName: null, status: "denied", name: null };
}

/**
 * Enforces MFA (AAL2) for sensitive AMS administrative operations.
 * Must be called with the authenticated user's Supabase client.
 */
export async function enforceAmsMfa(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(`Failed to check MFA status: ${error.message}`);
  }

  // AAL2 means the user has completed an MFA challenge in this session.
  if (aal.currentLevel !== 'aal2') {
    const error: any = new Error("MFA verification required for this administrative operation.");
    error.status = 403;
    error.code = 'MFA_REQUIRED';
    // If they have enrolled factors but haven't verified them this session:
    if (aal.nextLevel === 'aal2') {
      error.message = "Please complete your multi-factor authentication challenge to proceed.";
      error.needsChallenge = true;
    } else {
      // If they haven't enrolled in MFA yet at all:
      error.message = "You must enroll in multi-factor authentication before accessing AMS administration.";
      error.needsEnrollment = true;
    }
    throw error;
  }
}

/**
 * Bootstrap Super Admin privilege tied to verified auth user UUID/email.
 */
export async function bootstrapSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) throw new Error("User ID is required");
  const email = userId.toLowerCase().trim();

  const { error } = await supabaseAdmin
    .from("academic_super_admins")
    .upsert({ user_id: email, status: "active" }, { onConflict: "user_id" });

  if (error) throw error;
  return true;
}

/**
 * Invites an Academic Admin to an institution domain.
 * This creates a pending invitation instead of direct assignment.
 */
export async function inviteAcademicAdmin(
  actorId: string,
  targetEmail: string,
  universityDomain: string,
  extra?: {
    tempPassword?: string;
    name?: string;
    position?: string;
    contactNo?: string;
    universityName?: string;
  }
) {
  const access = await checkAmsAccess(actorId);
  if (!access.isSuperAdmin) {
    throw new Error("Unauthorized: Super Admin access required");
  }

  const email = targetEmail.toLowerCase().trim();
  const domain = universityDomain.toLowerCase().trim();

  // If a temporary password is provided, we can directly provision the account
  if (extra?.tempPassword) {
    const amsAuthEmail = `${email}.ams`;
    
    // 1. Create the user in Auth with .ams suffix to separate identity
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: amsAuthEmail,
      password: extra.tempPassword,
      email_confirm: true,
    });
    
    // Ignore error if user is already registered in the system
    let alreadyExisted = false;
    if (authErr) {
      if (authErr.message.toLowerCase().includes("already been registered") || authErr.message.toLowerCase().includes("already registered")) {
        alreadyExisted = true;
      } else {
        throw new Error(`Failed to provision user: ${authErr.message}`);
      }
    }

    // 2. Ensure profile exists and update with optional details
    const [firstName, ...lastNameParts] = (extra.name || "").split(" ");
    await supabaseAdmin.from("profiles").upsert({
      id: email,
      first_name: firstName || undefined,
      last_name: lastNameParts.join(" ") || undefined,
    }, { onConflict: "id" });

    // 3. Create academic_admins record with pending_onboarding status
    const { error: adminErr } = await supabaseAdmin.from("academic_admins").upsert({
      user_id: email,
      university_domain: domain,
      assigned_by: actorId,
      status: "pending_onboarding",
      university_name: extra.universityName,
      admin_name: extra.name,
      admin_position: extra.position,
      contact_no: extra.contactNo,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,university_domain" });

    if (adminErr) throw adminErr;
    
    return { status: "provisioned", alreadyExisted };
  }

  // Fallback to standard invitation (no temporary password)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("academic_admin_invitations")
    .insert({
      email,
      university_domain: domain,
      inviter_id: actorId.toLowerCase().trim(),
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Activates a pending academic admin invitation for the currently authenticated user.
 */
export async function activateAcademicAdmin(
  authenticatedUserId: string,
  invitationId: string
) {
  const email = authenticatedUserId.toLowerCase().trim();

  // 1. Fetch pending invitation
  const { data: invite, error: fetchErr } = await supabaseAdmin
    .from("academic_admin_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (fetchErr || !invite) {
    throw new Error("Invitation not found");
  }

  if (invite.status !== "pending") {
    throw new Error(`Invitation is already ${invite.status}`);
  }

  if (invite.email.toLowerCase().trim() !== email) {
    throw new Error("Invitation was sent to a different email address");
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin.from("academic_admin_invitations").update({ status: "expired" }).eq("id", invitationId);
    throw new Error("Invitation has expired");
  }

  // 2. Verify identity existence in profiles (ensures they completed normal SkillLinkr auth/onboarding)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", email)
    .maybeSingle();
    
  if (!profile) {
    throw new Error("Identity verification required: Please complete your SkillLinkr profile first.");
  }

  // 3. Insert into academic_admins and mark accepted
  const { error: assignErr } = await supabaseAdmin
    .from("academic_admins")
    .upsert({
      user_id: email,
      university_domain: invite.university_domain,
      assigned_by: invite.inviter_id,
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,university_domain" });

  if (assignErr) throw assignErr;

  await supabaseAdmin
    .from("academic_admin_invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId);

  return true;
}

/**
 * Dual Capacity Check for Faculty Supervision Acceptance
 */
export async function checkFacultyDualCapacity(
  facultyId: string,
  academicModuleId: string,
  academicPeriodId: string,
  requestingStudentCount: number
): Promise<{
  canAccept: boolean;
  currentGroups: number;
  maxGroups: number | null;
  currentStudents: number;
  maxTotalStudents: number | null;
  reason?: string;
}> {
  const email = facultyId.toLowerCase().trim();

  // 1. Fetch Availability
  const { data: avail } = await supabaseAdmin
    .from("faculty_availability")
    .select("*")
    .eq("faculty_id", email)
    .eq("academic_module_id", academicModuleId)
    .eq("academic_period_id", academicPeriodId)
    .maybeSingle();

  if (!avail || !avail.is_open) {
    return {
      canAccept: false,
      currentGroups: 0,
      maxGroups: null,
      currentStudents: 0,
      maxTotalStudents: null,
      reason: "Faculty offering is unavailable or closed",
    };
  }

  // 2. Count Active Groups & Students
  const { count: groupCount } = await supabaseAdmin
    .from("academic_project_assignments")
    .select("*", { count: "exact", head: true })
    .eq("faculty_id", email)
    .eq("academic_module_id", academicModuleId)
    .eq("academic_period_id", academicPeriodId)
    .eq("status", "active");

  const { count: studentCount } = await supabaseAdmin
    .from("academic_student_allocations")
    .select("*", { count: "exact", head: true })
    .eq("faculty_id", email)
    .eq("academic_module_id", academicModuleId)
    .eq("academic_period_id", academicPeriodId)
    .eq("status", "active");

  const currGroups = groupCount || 0;
  const currStudents = studentCount || 0;

  // Check group capacity
  if (avail.capacity_mode === "GROUPS" && avail.max_groups !== null && currGroups >= avail.max_groups) {
    return {
      canAccept: false,
      currentGroups: currGroups,
      maxGroups: avail.max_groups,
      currentStudents: currStudents,
      maxTotalStudents: avail.max_total_students,
      reason: `Maximum group capacity (${avail.max_groups}) reached`,
    };
  }

  // Check dual total student capacity
  if (avail.max_total_students !== null && (currStudents + requestingStudentCount) > avail.max_total_students) {
    return {
      canAccept: false,
      currentGroups: currGroups,
      maxGroups: avail.max_groups,
      currentStudents: currStudents,
      maxTotalStudents: avail.max_total_students,
      reason: `Total student capacity (${avail.max_total_students}) exceeded`,
    };
  }

  return {
    canAccept: true,
    currentGroups: currGroups,
    maxGroups: avail.max_groups,
    currentStudents: currStudents,
    maxTotalStudents: avail.max_total_students,
  };
}

/**
 * Filter Evaluation Output for Student View (Enforces Teammate Privacy)
 */
export function filterEvaluationForStudent(evaluation: any, studentId: string) {
  if (!evaluation || !evaluation.share_with_students) {
    return null; // Private, not shared with students
  }

  const sId = studentId.toLowerCase().trim();
  const individualScoresMap = evaluation.individual_scores || {};

  return {
    id: evaluation.id,
    assignment_id: evaluation.assignment_id,
    scheme_id: evaluation.scheme_id,
    scheme_version: evaluation.scheme_version,
    group_scores: evaluation.group_scores || {},
    // Expose ONLY target student's individual score!
    my_individual_score: individualScoresMap[sId] ?? null,
    shareable_feedback: evaluation.shareable_feedback || "",
    plagiarism_similarity_percentage: evaluation.plagiarism_similarity_percentage ?? null,
    published_at: evaluation.shared_with_students_at || evaluation.updated_at,
    // Exclude internal notes completely!
  };
}



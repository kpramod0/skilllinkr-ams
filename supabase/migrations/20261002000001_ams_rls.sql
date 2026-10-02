-- ==============================================================================
-- AMS STAGING RLS & SECURITY
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_super_admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_student_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_supervision_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_student_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_roster_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_roster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_roster_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_progress_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_evaluation_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_scheme_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_evaluation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_evaluation_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_audit_events ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM academic_super_admin_profiles
    WHERE auth_user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_institution_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT institution_id FROM academic_admin_assignments
  WHERE auth_user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

-- Policies for Super Admins (Full Access)
CREATE POLICY "Super Admins full access" ON institutions FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON institution_domains FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON external_users FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_super_admin_profiles FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_admin_assignments FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_admin_invitations FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_cycles FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_modules FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_periods FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_student_eligibility FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON faculty_eligibility FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_projects FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_supervision_requests FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_project_assignments FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_student_allocations FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_roster_versions FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_roster_members FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_roster_change_requests FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON roster_consent_records FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_milestones FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_submissions FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_progress_reviews FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_evaluation_schemes FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_scheme_components FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_evaluations FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_evaluation_versions FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_evaluation_releases FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_email_jobs FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON integration_outbox FOR ALL USING (public.is_super_admin());
CREATE POLICY "Super Admins full access" ON academic_audit_events FOR ALL USING (public.is_super_admin());

-- Policies for Academic Admins (Isolated by Institution)
CREATE POLICY "Academic Admins see own institution" ON institutions FOR SELECT USING (id = public.get_admin_institution_id());
CREATE POLICY "Academic Admins see own external users" ON external_users FOR SELECT USING (institution_id = public.get_admin_institution_id());
CREATE POLICY "Academic Admins manage own cycles" ON academic_cycles FOR ALL USING (institution_id = public.get_admin_institution_id());
CREATE POLICY "Academic Admins manage own projects" ON academic_projects FOR ALL USING (institution_id = public.get_admin_institution_id());

-- Academic Admins can read their own assignment row (SELECT only)
CREATE POLICY "Academic Admins read own assignment"
  ON academic_admin_assignments
  FOR SELECT
  USING (auth_user_id = auth.uid());

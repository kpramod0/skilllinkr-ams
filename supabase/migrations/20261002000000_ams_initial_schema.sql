-- ==============================================================================
-- AMS STAGING INITIAL SCHEMA
-- ==============================================================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE institution_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  UNIQUE (domain)
);

CREATE TABLE external_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT DEFAULT 'skilllinkr-main' CHECK (source_system = 'skilllinkr-main'),
  main_auth_user_id UUID NOT NULL,
  main_profile_id UUID NOT NULL,
  verified_email TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'faculty')),
  status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_system, main_auth_user_id)
);

CREATE TABLE academic_super_admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_admin_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, institution_id)
);

CREATE TABLE academic_admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES academic_cycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES academic_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
);

CREATE TABLE academic_student_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES academic_cycles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES external_users(id),
  status TEXT DEFAULT 'eligible' CHECK (status IN ('eligible', 'ineligible', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_id, student_id)
);

CREATE TABLE faculty_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES academic_cycles(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES external_users(id),
  max_capacity INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_id, faculty_id)
);

CREATE TABLE academic_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id),
  cycle_id UUID REFERENCES academic_cycles(id),
  project_code TEXT UNIQUE NOT NULL,
  main_team_id UUID,
  title TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_supervision_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES external_users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES external_users(id),
  role TEXT DEFAULT 'primary_supervisor',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'removed')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ
);

CREATE TABLE academic_student_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES external_users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_roster_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  frozen_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot_data JSONB,
  UNIQUE(project_id, version_number)
);

CREATE TABLE academic_roster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_version_id UUID REFERENCES academic_roster_versions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES external_users(id),
  role TEXT NOT NULL
);

CREATE TABLE academic_roster_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id),
  requested_by UUID REFERENCES external_users(id),
  change_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roster_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID REFERENCES academic_roster_change_requests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES external_users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'consented', 'declined')),
  consented_at TIMESTAMPTZ,
  UNIQUE(change_request_id, student_id)
);

CREATE TABLE academic_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ
);

CREATE TABLE academic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES academic_milestones(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES external_users(id),
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_progress_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES academic_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES external_users(id),
  feedback TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_evaluation_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academic_scheme_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID REFERENCES academic_evaluation_schemes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL
);

CREATE TABLE academic_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES academic_projects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES external_users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'published'))
);

CREATE TABLE academic_evaluation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES academic_evaluations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evaluation_id, version_number)
);

CREATE TABLE academic_evaluation_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_version_id UUID REFERENCES academic_evaluation_versions(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('student', 'academic_admin')),
  released_at TIMESTAMPTZ DEFAULT NOW(),
  released_by UUID NOT NULL
);

CREATE TABLE academic_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE academic_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

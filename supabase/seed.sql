-- Synthetic Data for Phase C Testing

-- 1. Create Synthetic Institutions
INSERT INTO institutions (id, code, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'KIIT', 'Kalinga Institute of Industrial Technology'),
('22222222-2222-2222-2222-222222222222', 'MIT', 'Massachusetts Institute of Technology');

-- 2. Setup Super Admin Auth (We will create the auth.users via API, but we can seed the profile here)
-- Super Admin UUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) VALUES 
('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'super@ams.local', crypt('password123', gen_salt('bf')), NOW(), NULL, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '');

INSERT INTO academic_super_admin_profiles (auth_user_id, email, name) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'super@ams.local', 'Super Admin');

-- 3. Setup Academic Admin for KIIT
-- KIIT Admin UUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) VALUES 
('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'admin@kiit.local', crypt('password123', gen_salt('bf')), NOW(), NULL, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '');

INSERT INTO academic_admin_assignments (auth_user_id, institution_id, email, name) VALUES 
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'admin@kiit.local', 'KIIT Admin');

-- 4. Setup Academic Admin for MIT
-- MIT Admin UUID: 'cccccccc-cccc-cccc-cccc-cccccccccccc'
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) VALUES 
('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'admin@mit.local', crypt('password123', gen_salt('bf')), NOW(), NULL, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '');

INSERT INTO academic_admin_assignments (auth_user_id, institution_id, email, name) VALUES 
('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'admin@mit.local', 'MIT Admin');

-- 5. Setup External Users (Students & Faculty via Main UUIDs)
INSERT INTO external_users (main_auth_user_id, main_profile_id, verified_email, institution_id, user_type) VALUES
('11112222-3333-4444-5555-666677778888', '11112222-3333-4444-5555-666677778888', 'student@kiit.local', '11111111-1111-1111-1111-111111111111', 'student'),
('99998888-7777-6666-5555-444433332222', '99998888-7777-6666-5555-444433332222', 'faculty@kiit.local', '11111111-1111-1111-1111-111111111111', 'faculty');


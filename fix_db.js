const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'http://127.0.0.1:54331',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function fix() {
  await supabase.from('academic_admin_assignments').update({ status: 'pending_onboarding' }).eq('email', 'pramodgupta.1618@gmail.com');
  await supabase.from('academic_admin_invitations').update({ status: 'pending' }).eq('email', 'pramodgupta.1618@gmail.com');
  console.log('Fixed DB statuses for Pramod');
}

fix();
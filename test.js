const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54331',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);
async function test() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'academic_admin_assignments_status_check';" });
  console.log('Result:', JSON.stringify(data));
  console.log('Error:', error);
}
test();
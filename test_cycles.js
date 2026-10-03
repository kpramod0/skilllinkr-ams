const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log('--- TEST: CREATE CYCLE ---');
  const res = await fetch('http://localhost:3000/api/ams/cycles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fall 2026 Test', status: 'draft', start_date: '2026-09-01', end_date: '2026-12-15' })
  });
  console.log(await res.json());
}
runTests();
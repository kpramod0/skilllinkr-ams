const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'http://127.0.0.1:54331',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

const collegeContent = fs.readFileSync('c:/UNIQUE/Work/annnn/old/src/lib/colleges.ts', 'utf8');
const match = collegeContent.match(/export const APPROVED_COLLEGES: College\[\] = \[([\s\S]*?)\];/);

if (!match) {
  console.error('Could not parse colleges list');
  process.exit(1);
}

const collegesJson = '[' + match[1] + ']';
const colleges = eval(collegesJson);

async function sync() {
  console.log('Found ' + colleges.length + ' colleges. Syncing to database...');
  for (const c of colleges) {
    const code = c.domain.trim().toUpperCase();
    const name = c.name.trim();
    
    // Upsert to institutions table
    const { error } = await supabase.from('institutions').upsert(
      { name: name, code: code, status: 'active' },
      { onConflict: 'code' }
    );
    
    if (error) {
      console.error('Error inserting ' + name + ':', error.message);
    }
  }
  console.log('Sync complete!');
}

sync();
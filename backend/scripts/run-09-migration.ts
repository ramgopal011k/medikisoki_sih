import { supabase } from '../src/supabase';

async function runMigration() {
  console.log('Running migration 09_verified_fields...');
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: "ALTER TABLE summaries ADD COLUMN IF NOT EXISTS verified_fields TEXT[] DEFAULT '{}';"
  });
  if (error) {
    console.log('RPC exec_sql not available or failed:', error.message);
  } else {
    console.log('Migration succeeded via exec_sql');
  }
}

runMigration();

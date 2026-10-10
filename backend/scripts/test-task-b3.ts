import { cleanupStaleSessions } from '../src/index';
import { supabase } from '../src/supabase';

async function testB3() {
  console.log('[Test B.3] Inserting dummy stale unverified session (created 25h ago)...');
  const past25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from('sessions')
    .insert({
      patient_name: 'Stale Test Patient',
      created_at: past25h,
      doctor_verified: false
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[Test B.3] Error inserting test session:', insertErr);
    process.exit(1);
  }

  console.log('[Test B.3] Inserted stale session ID:', inserted.id);

  console.log('[Test B.3] Invoking cleanupStaleSessions directly...');
  const count = await cleanupStaleSessions();
  console.log(`[Test B.3] Result: count = ${count}`);

  const { data: check } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', inserted.id)
    .maybeSingle();

  if (check) {
    console.error('[Test B.3] FAIL: Stale session was NOT deleted!');
    process.exit(1);
  }

  console.log('[Test B.3] Verified: Stale session was deleted from database.');
  console.log('[Test B.3] PASS: Session TTL cleanup works end-to-end!');
  process.exit(0);
}

testB3().catch((err) => {
  console.error('[Test B.3] Execution error:', err);
  process.exit(1);
});


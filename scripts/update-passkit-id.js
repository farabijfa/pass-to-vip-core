import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updatePassKitId() {
  const externalId = 'TEST-QR-001';
  const realPassKitId = '123456';  // PassKit external_id for this member

  console.log(`Updating PassKit ID for external_id: ${externalId}`);
  console.log(`New passkit_internal_id: ${realPassKitId}`);

  const { data, error } = await supabase
    .from('passes_master')
    .update({ passkit_internal_id: realPassKitId })
    .eq('external_id', externalId)
    .select();

  if (error) {
    console.error('Error updating record:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('✅ Successfully updated!');
    console.log('Updated record:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️ No record found with external_id:', externalId);
    console.log('You may need to insert a new record first.');
  }
}

updatePassKitId();

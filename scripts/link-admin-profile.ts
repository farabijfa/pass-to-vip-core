import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function linkAdminProfile() {
  console.log('Finding admin user...');
  
  // Get the admin user we created
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users?.find(u => u.email === 'admin@passtovip.com');
  
  if (!adminUser) {
    console.error('Admin user not found!');
    return;
  }
  
  console.log('Admin user ID:', adminUser.id);
  
  // Check if programs table exists and get a program
  const { data: programs, error: programsError } = await supabase
    .from('programs')
    .select('id, name, protocol')
    .limit(1);
    
  if (programsError) {
    console.log('Programs table error:', programsError.message);
    console.log('Will create admin profile without program link...');
  }
  
  const programId = programs?.[0]?.id || null;
  console.log('Program ID to link:', programId);
  
  // Check if admin_profiles table exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('id', adminUser.id)
    .single();
    
  if (checkError && checkError.code !== 'PGRST116') {
    console.log('Error checking admin_profiles:', checkError.message);
  }
  
  if (existingProfile) {
    console.log('Admin profile already exists, updating...');
    const { error: updateError } = await supabase
      .from('admin_profiles')
      .update({ 
        role: 'PLATFORM_ADMIN',
        program_id: programId 
      })
      .eq('id', adminUser.id);
      
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('Profile updated successfully!');
    }
  } else {
    console.log('Creating new admin profile...');
    const { error: insertError } = await supabase
      .from('admin_profiles')
      .insert({
        id: adminUser.id,
        role: 'PLATFORM_ADMIN',
        program_id: programId
      });
      
    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Try to list tables to understand structure
      console.log('\nListing available tables...');
      const { data: tables } = await supabase.rpc('get_tables').catch(() => ({ data: null }));
      console.log('Tables:', tables);
    } else {
      console.log('Admin profile created successfully!');
    }
  }
  
  // Verify
  const { data: profile, error: verifyError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();
    
  if (verifyError) {
    console.log('Verify error:', verifyError.message);
  } else {
    console.log('\nAdmin profile:', profile);
  }
}

linkAdminProfile().catch(console.error);

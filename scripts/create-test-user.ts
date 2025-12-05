import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const email = 'admin@passtovip.com';
  const password = 'TestAdmin123!';
  
  console.log('Creating test admin user...');
  console.log('Email:', email);
  console.log('Password:', password);
  
  // First check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);
  
  if (existingUser) {
    console.log('User already exists, updating password...');
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password
    });
    if (error) {
      console.error('Error updating user:', error);
      return;
    }
    console.log('Password updated successfully!');
  } else {
    console.log('Creating new user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'PLATFORM_ADMIN'
      }
    });
    
    if (error) {
      console.error('Error creating user:', error);
      return;
    }
    console.log('User created successfully!');
  }
  
  console.log('\n========================================');
  console.log('  TEST LOGIN CREDENTIALS');
  console.log('========================================');
  console.log('  Email:    admin@passtovip.com');
  console.log('  Password: TestAdmin123!');
  console.log('========================================');
}

createTestUser().catch(console.error);

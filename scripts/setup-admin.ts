import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = "admin@passtovip.com";
  const password = "Admin2024!";
  const programId = "4c6c936e-ce7f-408a-b4c5-8aeb6096013f"; // Gift Card Rewards
  
  console.log("\n🔐 Setting up admin user...");
  
  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  let adminUser = users?.users?.find(u => u.email === email);
  
  if (!adminUser) {
    console.log("Creating new admin user...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        business_name: "Pass To VIP",
        role: "SUPER_ADMIN",
      },
    });
    
    if (authError) {
      console.error("Failed to create admin:", authError.message);
      process.exit(1);
    }
    
    adminUser = authData.user;
    console.log("✅ Admin user created:", adminUser?.id);
  } else {
    console.log("Admin user already exists:", adminUser.id);
    
    // Update password if needed
    await supabase.auth.admin.updateUserById(adminUser.id, { password });
    console.log("✅ Password updated");
  }
  
  // Check/create admin profile
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", adminUser!.id)
    .single();
    
  if (!profile) {
    console.log("Creating admin profile...");
    const { error: profileError } = await supabase
      .from("admin_profiles")
      .insert({
        id: adminUser!.id,
        program_id: programId,
        role: "SUPER_ADMIN",
      });
      
    if (profileError) {
      console.error("Failed to create profile:", profileError.message);
    } else {
      console.log("✅ Admin profile created");
    }
  } else {
    console.log("Admin profile exists, ensuring SUPER_ADMIN role...");
    await supabase
      .from("admin_profiles")
      .update({ role: "SUPER_ADMIN" })
      .eq("id", adminUser!.id);
  }
  
  // Login and get token
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (loginError) {
    console.error("Login failed:", loginError.message);
    process.exit(1);
  }
  
  const token = loginData.session?.access_token;
  
  console.log("\n========================================");
  console.log("  SUPER_ADMIN LOGIN CREDENTIALS");
  console.log("========================================");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("========================================");
  console.log("\nExport token for testing:");
  console.log(`export TOKEN="${token}"`);
}

main().catch(console.error);

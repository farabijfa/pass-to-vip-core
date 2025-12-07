import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // List users and find admins
  const { data: profiles } = await supabase
    .from("admin_profiles")
    .select("id, role, program_id")
    .in("role", ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    
  console.log("\n📋 Admin profiles:", profiles);
  
  if (!profiles || profiles.length === 0) {
    // Create admin user
    console.log("\n👤 No admin found, creating one...");
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "admin@passtovip.com",
      password: "Admin2024!",
      email_confirm: true,
      user_metadata: {
        business_name: "Pass To VIP",
        role: "SUPER_ADMIN",
      },
    });
    
    if (authError && !authError.message.includes("already been registered")) {
      console.error("Failed to create admin:", authError.message);
      process.exit(1);
    }
    
    // Get or find admin user
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users?.find(u => u.email === "admin@passtovip.com");
    
    if (adminUser) {
      // Create admin profile for Gift Card Rewards
      const { error: profileError } = await supabase
        .from("admin_profiles")
        .insert({
          id: adminUser.id,
          program_id: "4c6c936e-ce7f-408a-b4c5-8aeb6096013f",
          role: "SUPER_ADMIN",
        });
        
      if (profileError && !profileError.message.includes("duplicate")) {
        console.error("Failed to create profile:", profileError.message);
      } else {
        console.log("✅ Admin profile created");
      }
    }
  }
  
  // Login as admin and get token
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: "admin@passtovip.com",
    password: "Admin2024!",
  });
  
  if (loginError) {
    console.error("Login failed:", loginError.message);
    process.exit(1);
  }
  
  console.log("\n✅ Admin token:", loginData.session?.access_token?.slice(0, 50) + "...");
  console.log("\n========================================");
  console.log("  ADMIN LOGIN CREDENTIALS");
  console.log("========================================");
  console.log("  Email:    admin@passtovip.com");
  console.log("  Password: Admin2024!");
  console.log("========================================\n");
  
  // Export token for use in curl
  console.log("TOKEN=" + loginData.session?.access_token);
}

main().catch(console.error);

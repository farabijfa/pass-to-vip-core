import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("\n📋 Listing all programs...\n");
  
  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name, passkit_program_id, dashboard_slug, tenant_id, is_primary, enrollment_url")
    .order("created_at", { ascending: false });
    
  if (programsError) {
    console.error("Error fetching programs:", programsError.message);
    process.exit(1);
  }
  
  console.log("Found programs:");
  for (const p of programs || []) {
    console.log(`  - ${p.name} (ID: ${p.id})`);
    console.log(`    PassKit: ${p.passkit_program_id}`);
    console.log(`    Dashboard Slug: ${p.dashboard_slug}`);
    console.log(`    Enrollment URL: ${p.enrollment_url}`);
    console.log("");
  }
  
  const giftCardProgram = programs?.find(p => p.name?.toLowerCase().includes("gift card"));
  
  if (!giftCardProgram) {
    console.log("\n❌ Gift Card Rewards program not found.");
    process.exit(1);
  }
  
  console.log(`\n✅ Found Gift Card Rewards program: ${giftCardProgram.id}`);
  console.log(`   Dashboard slug: ${giftCardProgram.dashboard_slug}`);
  
  const testEmail = "testclient@passtovip.com";
  const testPassword = "TestClient2024!";
  
  console.log(`\n👤 Creating/updating test client user: ${testEmail}...`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      business_name: "Gift Card Rewards Test",
      role: "CLIENT_ADMIN",
    },
  });
  
  let userId: string;
  
  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("⚠️ User already exists, fetching...");
      
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users?.find(u => u.email === testEmail);
      
      if (!existingUser) {
        console.error("Could not find existing user");
        process.exit(1);
      }
      
      userId = existingUser.id;
      console.log(`   Found existing user: ${userId}`);
    } else {
      console.error("Auth error:", authError.message);
      process.exit(1);
    }
  } else {
    userId = authData.user!.id;
    console.log(`✅ User created: ${userId}`);
  }
  
  // Check/create admin profile
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", userId)
    .single();
    
  if (profile) {
    console.log(`   Profile exists for program: ${profile.program_id}`);
    
    if (profile.program_id !== giftCardProgram.id) {
      console.log(`   Updating profile to Gift Card Rewards...`);
      const { error: updateError } = await supabase
        .from("admin_profiles")
        .update({ program_id: giftCardProgram.id, role: "CLIENT_ADMIN" })
        .eq("id", userId);
        
      if (updateError) {
        console.error("   Failed to update:", updateError.message);
      } else {
        console.log("   ✅ Profile updated!");
      }
    }
  } else {
    console.log("   Creating admin profile...");
    const { error: insertError } = await supabase
      .from("admin_profiles")
      .insert({
        id: userId,
        program_id: giftCardProgram.id,
        role: "CLIENT_ADMIN",
      });
      
    if (insertError) {
      console.error("   Failed to create profile:", insertError.message);
    } else {
      console.log("   ✅ Profile created!");
    }
  }
  
  console.log("\n========================================");
  console.log("  CLIENT LOGIN CREDENTIALS");
  console.log("========================================");
  console.log(`  Email:    ${testEmail}`);
  console.log(`  Password: ${testPassword}`);
  console.log(`  Program:  Gift Card Rewards`);
  console.log(`  Slug:     ${giftCardProgram.dashboard_slug}`);
  console.log(`  URL:      ${process.env.APP_URL}/dashboard`);
  console.log("========================================\n");
}

main().catch(console.error);

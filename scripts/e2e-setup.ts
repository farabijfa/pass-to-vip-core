import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_ADMIN_EMAIL = "test.admin@e2e-tests.local";
const TEST_ADMIN_PASSWORD = "TestAdmin123!";
const TEST_CLIENT_EMAIL = "test.client@e2e-tests.local";
const TEST_CLIENT_PASSWORD = "TestClient123!";
const TEST_PROGRAM_NAME = "E2E Test Restaurant Rewards";
const TEST_PASSKIT_ID = "pk_e2e_test_001";

interface TestData {
  adminUserId?: string;
  clientUserId?: string;
  programId?: string;
}

async function cleanupExistingTestData(): Promise<void> {
  console.log("🧹 Cleaning up existing test data...");

  const { data: existingProgram } = await supabase
    .from("programs")
    .select("id")
    .eq("name", TEST_PROGRAM_NAME)
    .single();

  if (existingProgram) {
    console.log(`   Found existing program: ${existingProgram.id}`);
    
    await supabase
      .from("notification_logs")
      .delete()
      .eq("program_id", existingProgram.id);
    console.log("   ✅ Deleted notification logs");

    await supabase
      .from("passes_master")
      .delete()
      .eq("program_id", existingProgram.id);
    console.log("   ✅ Deleted test members");

    await supabase
      .from("programs")
      .delete()
      .eq("id", existingProgram.id);
    console.log("   ✅ Deleted test program");
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  for (const user of users?.users || []) {
    if (user.email === TEST_ADMIN_EMAIL || user.email === TEST_CLIENT_EMAIL) {
      await supabase.from("admin_profiles").delete().eq("id", user.id);
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`   ✅ Deleted test user: ${user.email}`);
    }
  }

  console.log("✅ Cleanup complete\n");
}

async function createTestAdminUser(): Promise<string> {
  console.log("👤 Creating SUPER_ADMIN test user...");

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      business_name: "E2E Test Platform Admin",
      role: "SUPER_ADMIN",
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create admin user: ${authError?.message}`);
  }

  const userId = authData.user.id;
  console.log(`   User ID: ${userId}`);

  const { error: profileError } = await supabase
    .from("admin_profiles")
    .insert({
      id: userId,
      role: "SUPER_ADMIN",
    });

  if (profileError) {
    throw new Error(`Failed to create admin profile: ${profileError.message}`);
  }

  console.log(`✅ SUPER_ADMIN created: ${TEST_ADMIN_EMAIL}\n`);
  return userId;
}

async function createTestClientWithProgram(): Promise<{ userId: string; programId: string }> {
  console.log("🏢 Creating test client with program...");

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_CLIENT_EMAIL,
    password: TEST_CLIENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      business_name: TEST_PROGRAM_NAME,
      role: "CLIENT_ADMIN",
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create client user: ${authError?.message}`);
  }

  const userId = authData.user.id;
  console.log(`   Client User ID: ${userId}`);

  const { data: programData, error: programError } = await supabase
    .from("programs")
    .insert({
      name: TEST_PROGRAM_NAME,
      passkit_program_id: TEST_PASSKIT_ID,
      protocol: "MEMBERSHIP",
    })
    .select()
    .single();

  if (programError || !programData) {
    throw new Error(`Failed to create program: ${programError?.message}`);
  }

  const programId = programData.id;
  console.log(`   Program ID: ${programId}`);

  const { error: profileError } = await supabase
    .from("admin_profiles")
    .insert({
      id: userId,
      program_id: programId,
      role: "CLIENT_ADMIN",
    });

  if (profileError) {
    throw new Error(`Failed to create client profile: ${profileError.message}`);
  }

  console.log(`✅ CLIENT_ADMIN created: ${TEST_CLIENT_EMAIL}\n`);
  return { userId, programId };
}

async function seedTestMembers(programId: string): Promise<void> {
  console.log("👥 Seeding test members...");

  const testMembers = [
    { external_id: "E2E-PUB-001", status: "INSTALLED", is_active: true, enrollment_source: "SMARTPASS" },
    { external_id: "E2E-CLM-002", status: "INSTALLED", is_active: true, enrollment_source: "CLAIM_CODE" },
    { external_id: "E2E-CSV-003", status: "INSTALLED", is_active: true, enrollment_source: "CSV" },
    { external_id: "E2E-PUB-004", status: "UNINSTALLED", is_active: false, enrollment_source: "SMARTPASS" },
    { external_id: "E2E-CLM-005", status: "INSTALLED", is_active: true, enrollment_source: "CLAIM_CODE" },
    { external_id: "E2E-CSV-006", status: "INSTALLED", is_active: true, enrollment_source: "CSV" },
    { external_id: "E2E-PUB-007", status: "UNINSTALLED", is_active: false, enrollment_source: "SMARTPASS" },
    { external_id: "E2E-CLM-008", status: "INSTALLED", is_active: true, enrollment_source: "CLAIM_CODE" },
  ];

  for (const member of testMembers) {
    const { error } = await supabase
      .from("passes_master")
      .upsert({
        program_id: programId,
        ...member,
        protocol: "MEMBERSHIP",
        passkit_internal_id: `pk_${member.external_id}`,
        last_updated: new Date().toISOString(),
      }, { onConflict: "external_id" });

    if (error) {
      console.error(`   ❌ Failed to insert ${member.external_id}:`, error.message);
    } else {
      console.log(`   ✅ ${member.external_id} (${member.enrollment_source})`);
    }
  }

  console.log("✅ Members seeded\n");
}

async function seedCampaignLogs(programId: string): Promise<void> {
  console.log("📢 Seeding campaign/notification logs...");

  const campaigns = [
    {
      program_id: programId,
      campaign_name: "Holiday Points Promo",
      recipient_count: 156,
      success_count: 148,
      failed_count: 8,
      message_content: "Happy Holidays! Earn 2x points on all purchases this week.",
      target_segment: "All Members",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      program_id: programId,
      campaign_name: "Birthday Rewards Batch",
      recipient_count: 12,
      success_count: 12,
      failed_count: 0,
      message_content: "Happy Birthday! Enjoy 500 bonus points on us.",
      target_segment: "BIRTHDAY",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      program_id: programId,
      campaign_name: "Win-Back Campaign",
      recipient_count: 45,
      success_count: 38,
      failed_count: 7,
      message_content: "We miss you! Come back for 100 bonus points.",
      target_segment: "Inactive 30+ Days",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      program_id: programId,
      campaign_name: "New Menu Announcement",
      recipient_count: 203,
      success_count: 195,
      failed_count: 8,
      message_content: "Check out our new seasonal menu items - members get early access!",
      target_segment: "All Members",
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      program_id: programId,
      campaign_name: "Platinum Exclusive",
      recipient_count: 28,
      success_count: 28,
      failed_count: 0,
      message_content: "VIP Event: Private tasting night for Platinum members only.",
      target_segment: "Platinum Tier",
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const campaign of campaigns) {
    const { error } = await supabase
      .from("notification_logs")
      .insert(campaign);

    if (error) {
      console.error(`   ❌ Failed to insert campaign "${campaign.campaign_name}":`, error.message);
    } else {
      const successRate = Math.round((campaign.success_count / campaign.recipient_count) * 100);
      console.log(`   ✅ ${campaign.campaign_name} (${successRate}% success)`);
    }
  }

  console.log("✅ Campaign logs seeded\n");
}

async function printTestSummary(testData: TestData): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    E2E TEST DATA SUMMARY                       ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("🔐 SUPER_ADMIN (for testing admin features):");
  console.log(`   Email:    ${TEST_ADMIN_EMAIL}`);
  console.log(`   Password: ${TEST_ADMIN_PASSWORD}`);
  console.log(`   User ID:  ${testData.adminUserId}`);
  console.log("");
  console.log("👤 CLIENT_ADMIN (for testing client dashboard):");
  console.log(`   Email:    ${TEST_CLIENT_EMAIL}`);
  console.log(`   Password: ${TEST_CLIENT_PASSWORD}`);
  console.log(`   User ID:  ${testData.clientUserId}`);
  console.log("");
  console.log("🏢 Test Program:");
  console.log(`   Name:       ${TEST_PROGRAM_NAME}`);
  console.log(`   Program ID: ${testData.programId}`);
  console.log(`   PassKit ID: ${TEST_PASSKIT_ID}`);
  console.log("");
  console.log("📊 Seeded Data:");
  console.log("   • 8 test members (6 active, 2 churned)");
  console.log("   • 3 SMARTPASS, 3 CLAIM_CODE, 2 CSV enrollments");
  console.log("   • 5 campaign notification logs");
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                      READY FOR E2E TESTING                     ");
  console.log("═══════════════════════════════════════════════════════════════");
}

async function main() {
  console.log("\n🚀 E2E Test Environment Setup\n");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const testData: TestData = {};

  try {
    await cleanupExistingTestData();

    testData.adminUserId = await createTestAdminUser();

    const { userId, programId } = await createTestClientWithProgram();
    testData.clientUserId = userId;
    testData.programId = programId;

    await seedTestMembers(programId);

    await seedCampaignLogs(programId);

    await printTestSummary(testData);

  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    process.exit(1);
  }
}

main();

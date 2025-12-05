import { createClient } from "@supabase/supabase-js";
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

const TEST_EMAILS = [
  "test.admin@e2e-tests.local",
  "test.client@e2e-tests.local",
];
const TEST_PROGRAM_NAME = "E2E Test Restaurant Rewards";

async function cleanup() {
  console.log("\n🧹 E2E Test Cleanup\n");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const { data: existingProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("name", TEST_PROGRAM_NAME)
      .single();

    if (existingProgram) {
      console.log(`📦 Found test program: ${existingProgram.id}`);
      
      const { error: notifError } = await supabase
        .from("notification_logs")
        .delete()
        .eq("program_id", existingProgram.id);
      
      if (notifError) {
        console.log(`   ⚠️ Notification logs cleanup: ${notifError.message}`);
      } else {
        console.log("   ✅ Deleted notification logs");
      }

      const { error: membersError } = await supabase
        .from("passes_master")
        .delete()
        .eq("program_id", existingProgram.id);
      
      if (membersError) {
        console.log(`   ⚠️ Members cleanup: ${membersError.message}`);
      } else {
        console.log("   ✅ Deleted test members");
      }

      const { error: programError } = await supabase
        .from("programs")
        .delete()
        .eq("id", existingProgram.id);
      
      if (programError) {
        console.log(`   ⚠️ Program cleanup: ${programError.message}`);
      } else {
        console.log("   ✅ Deleted test program");
      }
    } else {
      console.log("📦 No test program found to clean up");
    }

    console.log("\n👤 Cleaning up test users...");

    const { data: users } = await supabase.auth.admin.listUsers();
    let usersDeleted = 0;

    for (const user of users?.users || []) {
      if (TEST_EMAILS.includes(user.email || "")) {
        await supabase.from("admin_profiles").delete().eq("id", user.id);
        
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) {
          console.log(`   ⚠️ Failed to delete ${user.email}: ${error.message}`);
        } else {
          console.log(`   ✅ Deleted: ${user.email}`);
          usersDeleted++;
        }
      }
    }

    if (usersDeleted === 0) {
      console.log("   No test users found to clean up");
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("               E2E TEST CLEANUP COMPLETE                        ");
    console.log("═══════════════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanup();

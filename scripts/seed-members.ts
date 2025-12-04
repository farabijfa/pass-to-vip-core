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

const PROGRAM_ID = process.argv[2];

if (!PROGRAM_ID) {
  console.error("❌ Usage: npx tsx scripts/seed-members.ts <program_id>");
  process.exit(1);
}

const testMembers = [
  {
    external_id: "PUB-member001",
    status: "INSTALLED",
    is_active: true,
    protocol: "MEMBERSHIP",
    enrollment_source: "SMARTPASS",
  },
  {
    external_id: "CLM-member002",
    status: "INSTALLED",
    is_active: true,
    protocol: "MEMBERSHIP",
    enrollment_source: "CLAIM_CODE",
  },
  {
    external_id: "CSV-member003",
    status: "INSTALLED",
    is_active: true,
    protocol: "MEMBERSHIP",
    enrollment_source: "CSV",
  },
  {
    external_id: "PUB-member004",
    status: "UNINSTALLED",
    is_active: false,
    protocol: "MEMBERSHIP",
    enrollment_source: "SMARTPASS",
  },
  {
    external_id: "CLM-member005",
    status: "INSTALLED",
    is_active: true,
    protocol: "MEMBERSHIP",
    enrollment_source: "CLAIM_CODE",
  },
];

async function seedMembers() {
  console.log("🌱 Seeding test members for program:", PROGRAM_ID);
  console.log("");

  for (const member of testMembers) {
    const { data, error } = await supabase
      .from("passes_master")
      .upsert(
        {
          program_id: PROGRAM_ID,
          ...member,
          passkit_internal_id: `pk_${member.external_id}`,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "external_id" }
      )
      .select("id, external_id")
      .single();

    if (error) {
      console.error(`❌ Failed to insert ${member.external_id}:`, error.message);
    } else {
      console.log(`✅ Member ${member.external_id} created - ${member.enrollment_source}`);
    }
  }

  console.log("");
  console.log("🎉 Seeding complete!");
  
  const { count } = await supabase
    .from("passes_master")
    .select("*", { count: "exact", head: true })
    .eq("program_id", PROGRAM_ID);
    
  console.log(`📊 Total members in program: ${count}`);
}

seedMembers().catch(console.error);

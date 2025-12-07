import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check passes_master structure first
  const { data: sample, error } = await supabase
    .from("passes_master")
    .select("id, program_id, external_id, member_email, member_first_name, member_last_name, points_balance, spend_total_cents, spend_tier_level, passkit_internal_id, status")
    .limit(5);
    
  console.log("\n📋 Sample passes (any program):");
  if (sample && sample.length > 0) {
    for (const p of sample) {
      console.log(`  Pass ID: ${p.id?.substring(0, 8)}...`);
      console.log(`    External ID: ${p.external_id}`);
      console.log(`    Email: ${p.member_email}`);
      console.log(`    Name: ${p.member_first_name} ${p.member_last_name}`);
      console.log(`    Program: ${p.program_id?.substring(0, 8)}...`);
      console.log(`    Points: ${p.points_balance || 0}, Spend: ${p.spend_total_cents || 0}`);
      console.log(`    Status: ${p.status}`);
      console.log("");
    }
  } else {
    console.log("  No passes found");
    if (error) console.log("  Error:", error.message);
  }
  
  // Get Gift Card Rewards passes specifically
  const giftCardProgramId = "4c6c936e-ce7f-408a-b4c5-8aeb6096013f";
  const { data: giftPasses, error: giftErr } = await supabase
    .from("passes_master")
    .select("*")
    .eq("program_id", giftCardProgramId)
    .limit(5);
    
  console.log("\n👥 Gift Card Rewards passes:");
  if (giftPasses && giftPasses.length > 0) {
    for (const p of giftPasses) {
      console.log(`  External ID: ${p.external_id}`);
      console.log(`    Email: ${p.member_email}`);
      console.log(`    Status: ${p.status}`);
    }
  } else {
    console.log("  No Gift Card Rewards passes yet");
  }
}

main();

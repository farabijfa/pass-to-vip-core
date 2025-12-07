import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const giftCardProgramId = "4c6c936e-ce7f-408a-b4c5-8aeb6096013f";
  
  // Find passes by exact program ID match
  const { data: passes, error } = await supabase
    .from("passes_master")
    .select("id, program_id, external_id, passkit_internal_id, status, member_email, points_balance, spend_total_cents")
    .eq("program_id", giftCardProgramId)
    .limit(10);
    
  console.log("\n🎁 Gift Card Rewards passes (by program_id):");
  if (error) {
    console.log("  Error:", error.message);
  } else if (passes && passes.length > 0) {
    for (const p of passes) {
      console.log(`  External ID: ${p.external_id}`);
      console.log(`    PassKit ID: ${p.passkit_internal_id}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Points: ${p.points_balance || 0}, Spend: ${p.spend_total_cents || 0} cents`);
      console.log("");
    }
  } else {
    console.log("  No passes found in passes_master for this program");
    console.log("  Note: Passes created via claim flow go directly to PassKit");
    console.log("  They may not have local passes_master records until POS webhook sync");
  }
  
  // Check any program IDs in passes_master
  const { data: programs } = await supabase
    .from("passes_master")
    .select("program_id")
    .limit(50);
    
  if (programs) {
    const uniquePrograms = [...new Set(programs.map(p => p.program_id))];
    console.log("\n📊 Unique program IDs in passes_master:");
    for (const pid of uniquePrograms) {
      console.log(`  - ${pid}`);
    }
  }
}

main();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const giftCardProgramId = "4c6c936e-ce7f-408a-b4c5-8aeb6096013f";
  const passkitProgramId = "20bCfEUuHxQgvo7toZbTTy";
  
  // Find passes by PassKit program ID
  const { data: passes, error } = await supabase
    .from("passes_master")
    .select("*")
    .or(`program_id.eq.${giftCardProgramId},passkit_program_id.eq.${passkitProgramId}`)
    .limit(10);
    
  console.log("\n🎁 Gift Card Rewards passes (by Supabase ID or PassKit ID):");
  if (error) {
    console.log("  Error:", error.message);
    
    // Try alternate query
    const { data: alt, error: altErr } = await supabase
      .from("passes_master")
      .select("id, program_id, external_id, passkit_internal_id, status")
      .limit(20);
      
    if (alt) {
      console.log("\n  All passes (checking program_id):");
      for (const p of alt) {
        if (p.program_id === giftCardProgramId) {
          console.log(`    MATCH: ${p.id} - ${p.external_id}`);
        }
      }
    }
  } else if (passes && passes.length > 0) {
    for (const p of passes) {
      console.log(`  Pass ID: ${p.id}`);
      console.log(`    External ID: ${p.external_id}`);
      console.log(`    Program: ${p.program_id}`);
    }
  } else {
    console.log("  No passes found");
  }
  
  // Also check claim codes that are INSTALLED
  const { data: installed } = await supabase
    .from("claim_codes")
    .select("*")
    .eq("status", "INSTALLED")
    .eq("passkit_program_id", passkitProgramId);
    
  console.log("\n✅ Installed claim codes for Gift Card Rewards:");
  if (installed && installed.length > 0) {
    for (const c of installed) {
      console.log(`  Code: ${c.claim_code}`);
      console.log(`    Install URL: ${c.passkit_install_url}`);
      console.log(`    First/Last: ${c.first_name} ${c.last_name}`);
    }
  } else {
    console.log("  None installed yet");
  }
}

main();

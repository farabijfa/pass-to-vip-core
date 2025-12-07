import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: claims, error } = await supabase
    .from("claim_codes")
    .select("claim_code, status, passkit_program_id, redeemed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
    
  console.log("\n📋 Recent claim codes:");
  if (claims) {
    for (const c of claims) {
      console.log(`  Code: ${c.claim_code}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    Redeemed: ${c.redeemed_at || 'Not yet'}`);
      console.log("");
    }
  }
}

main();

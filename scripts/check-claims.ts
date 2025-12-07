import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: claims, error } = await supabase
    .from("claim_codes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);
    
  console.log("\n📋 Recent claim codes (raw):");
  if (claims) {
    for (const c of claims) {
      console.log(`  Code: ${c.claim_code}`);
      console.log(`    PassKit Program ID: ${c.passkit_program_id}`);
      console.log(`    Supabase Program ID: ${c.program_id}`);
      console.log("");
    }
  }
}

main();

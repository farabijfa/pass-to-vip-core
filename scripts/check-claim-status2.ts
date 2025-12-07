import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get all claim codes
  const { data: claims, error } = await supabase
    .from("claim_codes")
    .select("*")
    .limit(10);
    
  console.log("\n📋 Claim codes table contents:");
  if (error) {
    console.log("  Error:", error.message);
  } else if (claims && claims.length > 0) {
    console.log(`  Found ${claims.length} claim codes`);
    for (const c of claims) {
      console.log(`\n  Code: ${c.claim_code}`);
      console.log(`    Columns:`, Object.keys(c).join(", "));
      console.log(`    Full data:`, JSON.stringify(c, null, 4));
    }
  } else {
    console.log("  No claim codes found in table");
  }
}

main();

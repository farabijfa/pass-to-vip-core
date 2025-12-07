import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get members for Gift Card Rewards program
  const { data: members, error } = await supabase
    .from("passes_master")
    .select("*")
    .eq("program_id", "4c6c936e-ce7f-408a-b4c5-8aeb6096013f")
    .limit(5);
    
  console.log("\n👥 Gift Card Rewards program passes:");
  if (members && members.length > 0) {
    for (const m of members) {
      console.log(`  Pass: ${m.member_id || m.id}`);
      console.log(`    Data:`, JSON.stringify(m, null, 2));
      console.log("");
    }
  } else {
    console.log("  No passes found");
    if (error) console.log("  Error:", error.message);
  }
  
  // Also get any passes
  const { data: allPasses, error: err2 } = await supabase
    .from("passes_master")
    .select("id, member_id, program_id, first_name, last_name, email, points")
    .limit(3);
    
  console.log("\n📋 Sample passes (any program):");
  if (allPasses && allPasses.length > 0) {
    for (const p of allPasses) {
      console.log(`  ID: ${p.id}, Member: ${p.member_id}, Program: ${p.program_id}`);
      console.log(`    Name: ${p.first_name} ${p.last_name}`);
      console.log(`    Points: ${p.points}`);
    }
  } else {
    console.log("  No passes found");
    if (err2) console.log("  Error:", err2.message);
  }
}

main();

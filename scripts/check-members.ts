import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get members for Gift Card Rewards program (4c6c936e-ce7f-408a-b4c5-8aeb6096013f)
  const { data: members, error } = await supabase
    .from("members")
    .select("id, member_id, first_name, last_name, email, points_balance, program_id, passkit_member_id")
    .eq("program_id", "4c6c936e-ce7f-408a-b4c5-8aeb6096013f")
    .limit(5);
    
  console.log("\n👥 Gift Card Rewards program members:");
  if (members && members.length > 0) {
    for (const m of members) {
      console.log(`  Member: ${m.first_name} ${m.last_name} (${m.member_id})`);
      console.log(`    Email: ${m.email}`);
      console.log(`    Points: ${m.points_balance}`);
      console.log(`    PassKit ID: ${m.passkit_member_id || 'N/A'}`);
      console.log("");
    }
  } else {
    console.log("  No members found");
    if (error) console.log("  Error:", error.message);
  }
}

main();

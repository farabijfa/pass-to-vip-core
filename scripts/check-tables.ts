import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // List all tables
  const { data, error } = await supabase.rpc("get_table_names");
  
  if (error) {
    console.log("RPC error, trying alternative method...");
    
    // Try raw SQL
    const { data: tables, error: err2 } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public");
      
    if (err2) {
      console.log("Error:", err2.message);
    } else {
      console.log("Tables:", tables);
    }
  } else {
    console.log("Tables:", data);
  }
}

main();

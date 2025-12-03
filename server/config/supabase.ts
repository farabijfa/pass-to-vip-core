import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./index";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey, serviceRoleKey } = config.supabase;

  if (!url || (!anonKey && !serviceRoleKey)) {
    throw new Error("Missing Supabase URL or API Key in environment variables");
  }

  const key = serviceRoleKey || anonKey;

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return !!(config.supabase.url && (config.supabase.anonKey || config.supabase.serviceRoleKey));
}

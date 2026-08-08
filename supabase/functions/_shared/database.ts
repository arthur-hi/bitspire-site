import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.95.0";
import { requireEnv } from "./config.ts";

let adminClient: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim();

  if (!serviceKey) {
    throw new Error("The Supabase server key is not set.");
  }

  adminClient = createClient(requireEnv("SUPABASE_URL"), serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return adminClient;
}

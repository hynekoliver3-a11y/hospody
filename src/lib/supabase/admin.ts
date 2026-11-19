import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role klient – OBCHÁZÍ RLS. Používat jen na serveru a jen tam,
 * kde je oprávnění ověřeno jinak (token tabletu, cron, správa auth účtů).
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Anonymní klient bez cookies – veřejné stránky (RLS: role anon). */
export function createAnonClient() {
  return createClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface PublicMenu {
  location: { name: string; address: string | null };
  company: { name: string };
  items: { name: string; description: string | null; category: string | null; price: number | null; allergens: number[] }[];
}

export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  const { data, error } = await createAnonClient().rpc("public_allergen_menu", { p_slug: slug });
  if (error || !data) return null;
  return data as PublicMenu;
}

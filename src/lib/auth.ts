import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Company, Employee } from "@/lib/types";

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "no_company"; userId: string; email: string | null }
  | { kind: "owner"; userId: string; email: string | null; displayName: string; company: Company }
  | { kind: "employee"; userId: string; employee: Employee };

/**
 * Kdo je přihlášený. Role se odvozuje z databáze (employees / company_members),
 * nikdy z user_metadata (ta je editovatelná uživatelem).
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return { kind: "anonymous" };
  const email = (claimsData?.claims?.email as string | undefined) ?? null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id, company_id, location_id, user_id, name, active, created_at")
    .eq("user_id", userId)
    .maybeSingle<Employee>();
  if (employee) {
    if (!employee.active) return { kind: "anonymous" };
    return { kind: "employee", userId, employee };
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("display_name, companies(id, name, ico, address, locale)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .order("created_at")
    .limit(1)
    .maybeSingle<{ display_name: string; companies: Company }>();
  if (!membership?.companies) return { kind: "no_company", userId, email };

  return {
    kind: "owner",
    userId,
    email,
    displayName: membership.display_name,
    company: membership.companies,
  };
});

export async function requireOwner() {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") redirect("/login");
  if (viewer.kind === "employee") redirect("/ukoly");
  if (viewer.kind === "no_company") redirect("/onboarding");
  return viewer;
}

export async function requireEmployee() {
  const viewer = await getViewer();
  if (viewer.kind !== "employee") redirect("/tablet");
  return viewer;
}

export function homeFor(viewer: Viewer): string {
  switch (viewer.kind) {
    case "owner":
      return "/admin";
    case "employee":
      return "/ukoly";
    case "no_company":
      return "/onboarding";
    default:
      return "/";
  }
}

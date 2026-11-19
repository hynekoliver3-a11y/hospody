"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getLocale } from "@/i18n/server";
import { getViewer } from "@/lib/auth";
import { installDefaultTemplates } from "@/lib/default-templates";
import { createClient } from "@/lib/supabase/server";
import { fail, firstError, formString, nameSchema, optionalText, type ActionState } from "@/lib/validation";

const schema = z.object({
  companyName: nameSchema,
  ico: z
    .string()
    .trim()
    .regex(/^(\d{8})?$/, "errors.invalidIco"),
  companyAddress: optionalText,
  locationName: nameSchema,
  locationAddress: optionalText,
});

export async function createCompany(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (viewer.kind !== "no_company") return fail("errors.notAllowed", form);
  const parsed = schema.safeParse({
    companyName: formString(form, "companyName"),
    ico: formString(form, "ico"),
    companyAddress: formString(form, "companyAddress"),
    locationName: formString(form, "locationName"),
    locationAddress: formString(form, "locationAddress"),
  });
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const displayName = (user.user?.user_metadata?.display_name as string | undefined) ?? "";

  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_name: d.companyName,
    p_ico: d.ico || null,
    p_address: d.companyAddress ?? null,
    p_display_name: displayName,
  });
  if (error || !companyId) return fail("errors.generic", form);

  const { data: location, error: locError } = await supabase
    .from("locations")
    .insert({ company_id: companyId, name: d.locationName, address: d.locationAddress ?? null })
    .select("id")
    .single();
  if (locError || !location) return fail("errors.generic", form);

  await installDefaultTemplates(supabase, await getLocale(), companyId as string, location.id);
  redirect(`/admin/provozovny/${location.id}`);
}

"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { installDefaultTemplates } from "@/lib/default-templates";
import { hashToken, newDeviceToken, setDeviceCookie } from "@/lib/device";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  firstError,
  formString,
  nameSchema,
  optionalEmail,
  optionalText,
  pinSchema,
  type ActionState,
} from "@/lib/validation";

const locationSchema = z.object({
  name: nameSchema,
  address: optionalText,
  alertEmail: optionalEmail,
});

function parseLocation(form: FormData) {
  return locationSchema.safeParse({
    name: formString(form, "name"),
    address: formString(form, "address"),
    alertEmail: formString(form, "alertEmail"),
  });
}

export async function createLocation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireOwner();
  const parsed = parseLocation(form);
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      company_id: viewer.company.id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      alert_email: parsed.data.alertEmail ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("errors.generic", form);
  await installDefaultTemplates(supabase, await getLocale(), viewer.company.id, data.id);
  redirect(`/admin/provozovny/${data.id}`);
}

export async function updateLocation(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const id = formString(form, "id");
  const parsed = parseLocation(form);
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      alert_email: parsed.data.alertEmail ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return fail("errors.generic", form);
  if (!data?.length) return fail("errors.notAllowed", form);
  revalidatePath(`/admin/provozovny/${id}`);
  return { ok: "common.saved" };
}

// ---------------------------------------------------------------------------
// Zaměstnanci
// ---------------------------------------------------------------------------
const employeeSchema = z.object({ name: nameSchema, pin: pinSchema, locationId: z.uuid() });

export async function addEmployee(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireOwner();
  const parsed = employeeSchema.safeParse({
    name: formString(form, "name"),
    pin: formString(form, "pin"),
    locationId: formString(form, "locationId"),
  });
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const { name, pin, locationId } = parsed.data;
  const supabase = await createClient();

  // 1) řádek zaměstnance přes RLS (ověří, že provozovna patří majiteli)
  const { data: employee, error } = await supabase
    .from("employees")
    .insert({ company_id: viewer.company.id, location_id: locationId, name })
    .select("id")
    .single();
  if (error || !employee) return fail("errors.notAllowed", form);

  // 2) technický auth účet (bez e-mailové schránky) – jen service role
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: `emp-${employee.id}@${serverEnv.employeeEmailDomain()}`,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: { kind: "employee" },
  });
  if (authError || !created.user) {
    await supabase.from("employees").delete().eq("id", employee.id);
    return fail("errors.generic", form);
  }
  await admin.from("employees").update({ user_id: created.user.id }).eq("id", employee.id);

  // 3) PIN (bcrypt v DB, RPC ověří vlastnictví)
  const { error: pinError } = await supabase.rpc("set_employee_pin", { p_employee_id: employee.id, p_pin: pin });
  if (pinError) return fail("errors.generic", form);

  revalidatePath(`/admin/provozovny/${locationId}`);
  return { ok: "common.saved" };
}

export async function changeEmployeePin(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwner();
  const pin = pinSchema.safeParse(formString(form, "pin"));
  if (!pin.success) return fail(firstError(pin.error), form);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_pin", {
    p_employee_id: formString(form, "employeeId"),
    p_pin: pin.data,
  });
  if (error) return fail(error.code === "42501" ? "errors.notAllowed" : "errors.generic", form);
  return { ok: "admin.employees.pinChanged" };
}

export async function setEmployeeActive(form: FormData) {
  await requireOwner();
  const employeeId = formString(form, "employeeId");
  const active = formString(form, "active") === "true";
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .update({ active })
    .eq("id", employeeId)
    .select("user_id, location_id")
    .maybeSingle();
  if (!data) return;
  // Deaktivovaný zaměstnanec se nesmí přihlásit (a jeho tokeny přestanou platit při obnově).
  if (data.user_id) {
    await createAdminClient().auth.admin.updateUserById(data.user_id, {
      ban_duration: active ? "none" : "876000h",
    });
  }
  revalidatePath(`/admin/provozovny/${data.location_id}`);
}

// ---------------------------------------------------------------------------
// Tablety
// ---------------------------------------------------------------------------
export async function pairThisDevice(form: FormData) {
  const viewer = await requireOwner();
  const locationId = formString(form, "locationId");
  const name = formString(form, "name").trim().slice(0, 100) || "Tablet";
  const supabase = await createClient();
  // ověření vlastnictví přes RLS
  const { data: location } = await supabase.from("locations").select("id, company_id").eq("id", locationId).maybeSingle();
  if (!location || location.company_id !== viewer.company.id) return;

  const token = newDeviceToken();
  const { error } = await createAdminClient().from("devices").insert({
    company_id: location.company_id,
    location_id: location.id,
    name,
    token_hash: hashToken(token),
    created_by: viewer.userId,
  });
  if (error) throw error;
  await setDeviceCookie(token);
  // Na sdíleném tabletu nesmí zůstat přihlášený majitel.
  await supabase.auth.signOut();
  redirect("/tablet");
}

export async function revokeDevice(form: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", formString(form, "deviceId"))
    .select("location_id")
    .maybeSingle();
  if (data) revalidatePath(`/admin/provozovny/${data.location_id}`);
}

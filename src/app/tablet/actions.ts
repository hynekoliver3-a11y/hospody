"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPairedDevice, touchDevice } from "@/lib/device";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ employeeId: z.uuid(), pin: z.string().regex(/^\d{4}$/) });

export type PinLoginResult = { error: "tablet.pinInvalid" | "tablet.pinLocked" | "tablet.deviceInvalid" | "errors.generic" };

/**
 * Přihlášení zaměstnance PINem. Podmínky: platný token spárovaného tabletu (cookie)
 * + zaměstnanec patří do stejné provozovny + správný PIN (zámek po 5 pokusech v DB).
 * Poté server vystaví běžnou Supabase session pro technický účet zaměstnance.
 */
export async function pinLogin(employeeId: string, pin: string): Promise<PinLoginResult> {
  const parsed = schema.safeParse({ employeeId, pin });
  if (!parsed.success) return { error: "tablet.pinInvalid" };

  const device = await getPairedDevice();
  if (!device) return { error: "tablet.deviceInvalid" };

  const admin = createAdminClient();
  const { data: status, error } = await admin.rpc("verify_employee_pin", {
    p_employee_id: parsed.data.employeeId,
    p_location_id: device.location_id,
    p_pin: parsed.data.pin,
  });
  if (error) return { error: "errors.generic" };
  if (status === "locked") return { error: "tablet.pinLocked" };
  if (status !== "ok") return { error: "tablet.pinInvalid" };

  const { data: employee } = await admin
    .from("employees")
    .select("user_id")
    .eq("id", parsed.data.employeeId)
    .single();
  if (!employee?.user_id) return { error: "errors.generic" };
  const { data: authUser } = await admin.auth.admin.getUserById(employee.user_id);
  if (!authUser.user?.email) return { error: "errors.generic" };

  // Jednorázový odkaz vygenerovaný na serveru (nic se neposílá e-mailem) → session v cookies.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (linkError || !link.properties?.hashed_token) return { error: "errors.generic" };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) return { error: "errors.generic" };

  await touchDevice(device.id);
  redirect("/ukoly");
}

export async function employeeLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/tablet");
}

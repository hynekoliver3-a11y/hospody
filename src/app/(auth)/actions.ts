"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fail, firstError, formString, type ActionState } from "@/lib/validation";

const loginSchema = z.object({
  email: z.email("errors.invalidEmail"),
  password: z.string().min(1, "errors.required"),
});

function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: formString(form, "email"), password: formString(form, "password") });
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("errors.invalidCredentials", form);
  redirect(safeNext(formString(form, "next")));
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "errors.required").max(100),
  email: z.email("errors.invalidEmail"),
  password: z.string().min(8, "errors.weakPassword"),
});

export async function register(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formString(form, "name"),
    email: formString(form, "email"),
    password: formString(form, "password"),
  });
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.name },
      emailRedirectTo: `${publicEnv.siteUrl()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return fail("errors.emailTaken", form);
    if (error.code === "weak_password") return fail("errors.weakPassword", form);
    return fail("errors.generic", form);
  }
  // Při vypnutém potvrzování e-mailu (lokálně) je session hned k dispozici.
  if (data.session) redirect("/onboarding");
  return { ok: "auth.checkEmail" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

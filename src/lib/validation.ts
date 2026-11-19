import { z } from "zod";

// Chybové zprávy jsou překladové klíče (errors.*), překládá je UI.
export const pinSchema = z.string().regex(/^\d{4}$/, "errors.invalidPin");
export const nameSchema = z.string().trim().min(1, "errors.required").max(200);
export const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("errors.invalidEmail").nullable())
  .optional();

export type ActionState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

/** Chyba + odeslané hodnoty (React po akci formulář resetuje; hesla/PINy se nevracejí). */
export function fail(error: string, form?: FormData): ActionState {
  if (!form) return { error };
  const values: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string" && !/password|pin|^\$/i.test(key)) values[key] = value;
  });
  return { error, values };
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message?.startsWith("errors.") ? error.issues[0].message : "errors.required";
}

export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

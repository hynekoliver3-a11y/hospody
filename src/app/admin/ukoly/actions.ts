"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, firstError, formString, type ActionState } from "@/lib/validation";

const decimal = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => v === "" || /^-?\d+(\.\d+)?$/.test(v), "errors.required")
  .transform((v) => (v === "" ? null : Number(v)));

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "errors.required");

const schema = z
  .object({
    title: z.string().trim().min(1, "errors.required").max(200),
    category: z.enum(["temperature", "cleaning", "goods_receipt", "expiry", "other"]),
    instructions: z
      .string()
      .trim()
      .max(1000)
      .transform((v) => v || null),
    frequency: z.enum(["daily", "morning_evening", "weekly"]),
    due_time: time,
    evening_due_time: time,
    weekday: z.coerce.number().int().min(1).max(7),
    min_value: decimal,
    max_value: decimal,
    unit: z.string().trim().min(1).max(10),
    photo_required: z.boolean(),
    repeatable: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.category === "temperature" && d.min_value == null && d.max_value == null) {
      ctx.addIssue({ code: "custom", message: "admin.templates.limitRequired" });
    }
    if (d.min_value != null && d.max_value != null && d.min_value > d.max_value) {
      ctx.addIssue({ code: "custom", message: "admin.templates.limitOrder" });
    }
  });

function parse(form: FormData) {
  return schema.safeParse({
    title: formString(form, "title"),
    category: formString(form, "category"),
    instructions: formString(form, "instructions"),
    frequency: formString(form, "frequency"),
    due_time: formString(form, "due_time"),
    evening_due_time: formString(form, "evening_due_time") || "21:00",
    weekday: formString(form, "weekday") || "1",
    min_value: formString(form, "min_value"),
    max_value: formString(form, "max_value"),
    unit: formString(form, "unit") || "°C",
    photo_required: form.get("photo_required") === "on",
    repeatable: form.get("repeatable") === "on",
  });
}

function message(error: z.ZodError) {
  const m = error.issues[0]?.message ?? "";
  return m.startsWith("admin.") ? m : firstError(error);
}

export async function saveTemplate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireOwner();
  const parsed = parse(form);
  if (!parsed.success) return fail(message(parsed.error), form);
  const d = parsed.data;
  const hasLimits = d.category === "temperature" || d.category === "goods_receipt";
  const row = {
    ...d,
    min_value: hasLimits ? d.min_value : null,
    max_value: hasLimits ? d.max_value : null,
    weekday: d.frequency === "weekly" ? d.weekday : null,
  };
  const supabase = await createClient();
  const id = formString(form, "id");
  const locationId = formString(form, "locationId");

  const { error } = id
    ? await supabase.from("task_templates").update(row).eq("id", id)
    : await supabase
        .from("task_templates")
        .insert({ ...row, company_id: viewer.company.id, location_id: locationId, sort_order: 1000 });
  if (error) return fail("errors.generic", form);
  revalidatePath("/admin/ukoly");
  return { ok: "common.saved" };
}

export async function setTemplateActive(form: FormData) {
  await requireOwner();
  const supabase = await createClient();
  await supabase
    .from("task_templates")
    .update({ active: formString(form, "active") === "true" })
    .eq("id", formString(form, "id"));
  revalidatePath("/admin/ukoly");
}

export async function deleteTemplate(form: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = formString(form, "id");
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  // FK restrict: šablona se záznamy se nesmaže (auditní stopa) → jen vypnout
  if (error?.code === "23503") {
    await supabase.from("task_templates").update({ active: false }).eq("id", id);
  }
  revalidatePath("/admin/ukoly");
}

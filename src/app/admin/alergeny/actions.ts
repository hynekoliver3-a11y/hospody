"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, firstError, formString, type ActionState } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1, "errors.required").max(200),
  category: z.string().trim().max(100).transform((v) => v || null),
  description: z.string().trim().max(500).transform((v) => v || null),
  price: z
    .string()
    .trim()
    .transform((v) => v.replace(",", ".").replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "errors.required")
    .transform((v) => (v === "" ? null : Number(v))),
  allergens: z.array(z.coerce.number().int().min(1).max(14)),
});

export async function saveMenuItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireOwner();
  const parsed = schema.safeParse({
    name: formString(form, "name"),
    category: formString(form, "category"),
    description: formString(form, "description"),
    price: formString(form, "price"),
    allergens: form.getAll("allergens"),
  });
  if (!parsed.success) return fail(firstError(parsed.error), form);
  const row = { ...parsed.data, allergens: [...new Set(parsed.data.allergens)].sort((a, b) => a - b) };
  const supabase = await createClient();
  const id = formString(form, "id");
  const { error } = id
    ? await supabase.from("menu_items").update(row).eq("id", id)
    : await supabase
        .from("menu_items")
        .insert({ ...row, company_id: viewer.company.id, location_id: formString(form, "locationId"), sort_order: 1000 });
  if (error) return fail("errors.generic", form);
  revalidatePath("/admin/alergeny");
  return { ok: "common.saved" };
}

export async function deleteMenuItem(form: FormData) {
  await requireOwner();
  const supabase = await createClient();
  await supabase.from("menu_items").delete().eq("id", formString(form, "id"));
  revalidatePath("/admin/alergeny");
}

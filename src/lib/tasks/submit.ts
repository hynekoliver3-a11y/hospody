"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecordInput {
  id: string; // generuje klient → idempotentní (offline fronta ve fázi 7)
  template_id: string;
  task_date: string;
  slot: string;
  value?: number | null;
  details?: Record<string, unknown>;
  corrective_action?: string | null;
  note?: string | null;
  performed_at: string;
  photo?: Blob | null;
}

export interface SubmitContext {
  userId: string;
  companyId: string;
  locationId: string;
}

export type SubmitResult = { ok: true } | { ok: false; error: string; retryable: boolean };

const DB_ERRORS: Record<string, string> = {
  corrective_action_required: "tasks.errors.correctiveRequired",
  value_required: "tasks.errors.valueRequired",
  task_date_out_of_range: "tasks.errors.dateOutOfRange",
};

/** Zmenší fotku na max. 1600 px a převede na JPEG (rychlejší nahrání přes slabý signál). */
export async function compressImage(file: Blob, maxSize = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
  } catch {
    return file;
  }
}

export async function submitRecord(
  supabase: SupabaseClient,
  ctx: SubmitContext,
  input: RecordInput,
): Promise<SubmitResult> {
  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${ctx.companyId}/${ctx.locationId}/${input.id}.jpg`;
    const { error } = await supabase.storage
      .from("task-photos")
      .upload(photoPath, input.photo, { contentType: "image/jpeg", upsert: false });
    // "already exists" = předchozí pokus fotku nahrál → pokračujeme
    if (error && !/exists|duplicate/i.test(error.message)) {
      return { ok: false, error: "tasks.errors.photoUpload", retryable: true };
    }
  }

  const { error } = await supabase.from("task_records").insert({
    id: input.id,
    template_id: input.template_id,
    task_date: input.task_date,
    slot: input.slot,
    value: input.value ?? null,
    details: input.details ?? {},
    corrective_action: input.corrective_action?.trim() || null,
    note: input.note?.trim() || null,
    photo_path: photoPath,
    performed_at: input.performed_at,
    performed_by_user_id: ctx.userId,
    // povinné sloupce doplní trigger v DB (snapshot šablony, autor, odchylka)
    company_id: ctx.companyId,
    location_id: ctx.locationId,
    title: "",
    category: "other",
    performer_name: "",
  });

  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: true }; // už uloženo dřívějším pokusem
  const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
  if (known) return { ok: false, error: DB_ERRORS[known], retryable: false };
  const network = !error.code || error.message.toLowerCase().includes("fetch");
  return { ok: false, error: network ? "tasks.errors.network" : "errors.generic", retryable: network };
}

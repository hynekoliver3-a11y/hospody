import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

/** Vloží přednastavené HACCP úkoly do nové provozovny (v jazyce firmy). */
export async function installDefaultTemplates(
  supabase: SupabaseClient,
  locale: Locale,
  companyId: string,
  locationId: string,
) {
  // Všechny řádky musí mít stejné klíče – PostgREST jinak doplní chybějící jako NULL.
  const rows = getMessages(locale).defaultTemplates.map((tpl, index) => {
    const t = tpl as Partial<Record<string, unknown>> & { category: string; title: string };
    return {
      company_id: companyId,
      location_id: locationId,
      sort_order: (index + 1) * 10,
      category: t.category,
      title: t.title,
      instructions: t.instructions ?? null,
      frequency: t.frequency ?? "daily",
      due_time: t.due_time ?? "12:00",
      evening_due_time: t.evening_due_time ?? "21:00",
      weekday: t.weekday ?? null,
      min_value: t.min_value ?? null,
      max_value: t.max_value ?? null,
      repeatable: t.repeatable ?? false,
    };
  });
  const { error } = await supabase.from("task_templates").insert(rows);
  if (error) throw error;
}

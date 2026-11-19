import { SubmitButton } from "@/components/ui";
import { employeeLogout } from "@/app/tablet/actions";
import { getT } from "@/i18n/server";
import { requireEmployee } from "@/lib/auth";
import { occurrencesForDay, recordKey } from "@/lib/tasks/schedule";
import { localDate } from "@/lib/tasks/time";
import { createClient } from "@/lib/supabase/server";
import type { TaskTemplate } from "@/lib/types";
import { Checklist } from "./checklist";
import { IdleLogout } from "./idle-logout";
import type { ChecklistItem, DoneRecord } from "./types";

export const metadata = { title: "Dnešní úkoly" };

export default async function TasksPage() {
  const viewer = await requireEmployee();
  const t = await getT();
  const supabase = await createClient();
  const { employee } = viewer;

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, timezone")
    .eq("id", employee.location_id)
    .single();
  const tz = location?.timezone ?? "Europe/Prague";
  const today = localDate(new Date(), tz);

  const [{ data: templates }, { data: records }] = await Promise.all([
    supabase
      .from("task_templates")
      .select("*")
      .eq("location_id", employee.location_id)
      .eq("active", true)
      .order("sort_order")
      .returns<TaskTemplate[]>(),
    supabase
      .from("task_records")
      .select("id, template_id, task_date, slot, value, is_deviation, performer_name, performed_at, details, corrective_action, photo_path")
      .eq("location_id", employee.location_id)
      .eq("task_date", today)
      .order("performed_at"),
  ]);

  const byKey = new Map<string, DoneRecord[]>();
  for (const r of records ?? []) {
    const list = byKey.get(recordKey(r)) ?? [];
    list.push(r as DoneRecord);
    byKey.set(recordKey(r), list);
  }

  const items: ChecklistItem[] = occurrencesForDay(templates ?? [], today, tz).map((o) => ({
    key: o.key,
    templateId: o.template.id,
    date: o.date,
    slot: o.slot,
    due: o.due.toISOString(),
    title: o.template.title,
    instructions: o.template.instructions,
    category: o.template.category,
    min_value: o.template.min_value,
    max_value: o.template.max_value,
    unit: o.template.unit,
    photoRequired: o.template.photo_required,
    repeatable: o.template.repeatable,
    records: byKey.get(o.key) ?? [],
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-3 py-4 sm:px-4">
      <IdleLogout />
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
          <p className="text-muted">
            {employee.name} · {location?.name}
          </p>
        </div>
        <form action={employeeLogout}>
          <SubmitButton variant="secondary">{t("common.logout")}</SubmitButton>
        </form>
      </header>
      <Checklist
        items={items}
        tz={tz}
        ctx={{ userId: viewer.userId, companyId: employee.company_id, locationId: employee.location_id }}
      />
    </main>
  );
}

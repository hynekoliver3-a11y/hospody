import type { TaskSlot, TaskTemplate } from "@/lib/types";
import { isoWeekday, zonedToUtc } from "./time";

export type ScheduleTemplate = Pick<
  TaskTemplate,
  "id" | "frequency" | "due_time" | "evening_due_time" | "weekday" | "active" | "sort_order"
>;

export interface Occurrence<T extends ScheduleTemplate = ScheduleTemplate> {
  key: string; // `${templateId}:${date}:${slot}`
  template: T;
  date: string;
  slot: TaskSlot;
  due: Date;
}

/** Výskyty úkolů pro jeden den provozovny. */
export function occurrencesForDay<T extends ScheduleTemplate>(templates: T[], date: string, tz: string): Occurrence<T>[] {
  const result: Occurrence<T>[] = [];
  for (const t of templates) {
    if (!t.active) continue;
    const slots: { slot: TaskSlot; time: string }[] = [];
    if (t.frequency === "daily") slots.push({ slot: "day", time: t.due_time });
    if (t.frequency === "morning_evening") {
      slots.push({ slot: "morning", time: t.due_time }, { slot: "evening", time: t.evening_due_time });
    }
    if (t.frequency === "weekly" && t.weekday === isoWeekday(date)) slots.push({ slot: "week", time: t.due_time });
    for (const s of slots) {
      result.push({ key: `${t.id}:${date}:${s.slot}`, template: t, date, slot: s.slot, due: zonedToUtc(date, s.time, tz) });
    }
  }
  return result.sort((a, b) => a.due.getTime() - b.due.getTime() || a.template.sort_order - b.template.sort_order);
}

export type OccurrenceStatus = "done" | "pending" | "overdue";

export interface RecordRef {
  template_id: string;
  task_date: string;
  slot: string;
}

export function recordKey(r: RecordRef): string {
  return `${r.template_id}:${r.task_date}:${r.slot}`;
}

/** Stav výskytu podle existujících záznamů a aktuálního času. */
export function occurrenceStatus(occ: Occurrence, doneKeys: Set<string>, now: Date): OccurrenceStatus {
  if (doneKeys.has(occ.key)) return "done";
  return now.getTime() > occ.due.getTime() ? "overdue" : "pending";
}

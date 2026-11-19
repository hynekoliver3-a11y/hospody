import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Translator } from "@/i18n/translate";
import { dayStats, doneKeySet } from "@/lib/tasks/stats";
import { addDays } from "@/lib/tasks/time";
import type { TaskTemplate } from "@/lib/types";
import type { ReportData, ReportDay, ReportRow } from "./haccp-report";

interface RecordRow {
  template_id: string;
  task_date: string;
  slot: string;
  title: string;
  category: string;
  value: number | null;
  unit: string | null;
  details: Record<string, unknown>;
  is_deviation: boolean;
  corrective_action: string | null;
  note: string | null;
  performer_name: string;
  performed_at: string;
}

export async function buildReport(
  supabase: SupabaseClient,
  t: Translator,
  locale: string,
  opts: { company: ReportData["company"]; location: { id: string; name: string; address: string | null; timezone: string }; from: string; to: string; now: Date },
): Promise<ReportData> {
  const { location, from, to, now } = opts;
  const p = (k: string, v?: Record<string, string | number>) => t(`export.pdf.${k}`, v);

  const [{ data: templates }, { data: records }] = await Promise.all([
    supabase.from("task_templates").select("*").eq("location_id", location.id).returns<(TaskTemplate & { created_at: string })[]>(),
    supabase
      .from("task_records")
      .select("template_id, task_date, slot, title, category, value, unit, details, is_deviation, corrective_action, note, performer_name, performed_at")
      .eq("location_id", location.id)
      .gte("task_date", from)
      .lte("task_date", to)
      .order("performed_at")
      .limit(20000)
      .returns<RecordRow[]>(),
  ]);

  const tz = location.timezone;
  const fmtTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  const num = (v: number) => Number(v).toLocaleString(locale);
  const slotSuffix = (slot: string) => (slot === "morning" || slot === "evening" ? ` (${t(`tasks.slot.${slot}`)})` : "");

  const resultText = (r: RecordRow): string => {
    const dev = r.is_deviation ? ` – ${p("deviation")}` : "";
    switch (r.category) {
      case "temperature":
        return `${r.value != null ? `${num(r.value)} ${r.unit ?? ""}` : "–"}${dev}`;
      case "goods_receipt": {
        const d = r.details;
        return [
          d.supplier,
          d.product,
          r.value != null ? `${num(r.value)} ${r.unit ?? ""}` : null,
          d.package_ok === false ? p("packageDamaged") : p("packageOk"),
        ]
          .filter(Boolean)
          .join(", ") + dev;
      }
      case "expiry":
        return r.details.ok === false ? p("expiryFound") : p("expiryOk");
      default:
        return p("done");
    }
  };

  // dny: všechny dny v období, kde existují záznamy nebo nesplněné úkoly
  const tpl = (templates ?? []).filter((x) => x.active);
  const done = doneKeySet(records ?? []);
  const days: ReportDay[] = [];
  let missedTotal = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const rows: (ReportRow & { sort: number })[] = (records ?? [])
      .filter((r) => r.task_date === d)
      .map((r) => ({
        sort: Date.parse(r.performed_at),
        time: fmtTime.format(new Date(r.performed_at)),
        task: r.title + slotSuffix(r.slot),
        result: resultText(r),
        who: r.performer_name,
        note: [r.corrective_action, r.note].filter(Boolean).join(" · "),
        kind: r.is_deviation ? "deviation" : "ok",
      }));
    const missed = dayStats(tpl, done, d, tz, now).missed.filter((m) => new Date((m.template as { created_at: string }).created_at) < m.due);
    missedTotal += missed.length;
    for (const m of missed) {
      rows.push({
        sort: m.due.getTime(),
        time: "–",
        task: m.template.title + slotSuffix(m.slot),
        result: p("missedRow", { time: fmtTime.format(m.due) }),
        who: "",
        note: "",
        kind: "missed",
      });
    }
    if (rows.length) {
      rows.sort((a, b) => a.sort - b.sort);
      days.push({ label: fmtDay.format(new Date(`${d}T00:00:00Z`)), rows: rows.map((r) => ({ time: r.time, task: r.task, result: r.result, who: r.who, note: r.note, kind: r.kind })) });
    }
  }

  const fmtDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  return {
    company: opts.company,
    location: { name: location.name, address: location.address },
    period: `${fmtDate.format(new Date(`${from}T00:00:00Z`))} – ${fmtDate.format(new Date(`${to}T00:00:00Z`))}`,
    generated: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(now),
    summary: {
      records: records?.length ?? 0,
      deviations: (records ?? []).filter((r) => r.is_deviation).length,
      missed: missedTotal,
    },
    days,
  };
}

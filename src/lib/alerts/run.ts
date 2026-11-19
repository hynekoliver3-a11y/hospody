import "server-only";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translate";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayStats, doneKeySet } from "@/lib/tasks/stats";
import { addDays, localDate } from "@/lib/tasks/time";
import type { TaskTemplate } from "@/lib/types";
import { renderAlertEmail, sendEmail } from "./email";

export interface AlertRunResult {
  locations: number;
  emailsSent: number;
  overdue: number;
  deviations: number;
  errors: string[];
  dryRun: boolean;
}

/**
 * Hodinová kontrola: úkoly po termínu (dnes + včera kvůli pozdním večerním termínům)
 * a nové odchylky. Každá položka se hlásí jen jednou (alert_log.ref_key).
 */
export async function runAlerts(now = new Date(), { dryRun = false } = {}): Promise<AlertRunResult> {
  const admin = createAdminClient();
  const result: AlertRunResult = { locations: 0, emailsSent: 0, overdue: 0, deviations: 0, errors: [], dryRun };

  const { data: locations, error } = await admin
    .from("locations")
    .select("id, company_id, name, timezone, alert_email, companies(locale)");
  if (error) throw error;

  for (const loc of locations ?? []) {
    result.locations++;
    const locale = (loc.companies as unknown as { locale: string } | null)?.locale ?? defaultLocale;
    const t = createTranslator(getMessages(locale === "cs" ? "cs" : defaultLocale));
    const today = localDate(now, loc.timezone);
    const yesterday = addDays(today, -1);

    const [{ data: templates }, { data: records }, { data: devs }] = await Promise.all([
      admin.from("task_templates").select("*").eq("location_id", loc.id).eq("active", true).returns<(TaskTemplate & { created_at: string })[]>(),
      admin.from("task_records").select("template_id, task_date, slot").eq("location_id", loc.id).gte("task_date", yesterday),
      admin
        .from("task_records")
        .select("id, title, value, unit, details, corrective_action, performer_name, performed_at")
        .eq("location_id", loc.id)
        .eq("is_deviation", true)
        .gte("created_at", new Date(now.getTime() - 26 * 3600_000).toISOString())
        .order("performed_at"),
    ]);

    const done = doneKeySet(records ?? []);
    const missed = [yesterday, today]
      .flatMap((d) => dayStats(templates ?? [], done, d, loc.timezone, now).missed)
      // úkol, který v době termínu ještě neexistoval, se nehlásí
      .filter((m) => new Date((m.template as { created_at: string }).created_at) < m.due);

    const candidates = [
      ...missed.map((m) => ({ ref: `overdue:${m.key}`, kind: "overdue" as const })),
      ...(devs ?? []).map((d) => ({ ref: `deviation:${d.id}`, kind: "deviation" as const })),
    ];
    if (!candidates.length) continue;

    const { data: already } = await admin
      .from("alert_log")
      .select("ref_key")
      .in("ref_key", candidates.map((c) => c.ref));
    const sent = new Set((already ?? []).map((a) => a.ref_key));
    const fresh = candidates.filter((c) => !sent.has(c.ref));
    if (!fresh.length) continue;
    const freshRefs = new Set(fresh.map((f) => f.ref));

    const fmtTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: loc.timezone });
    const fmtDateTime = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: loc.timezone });

    const overdueItems = missed
      .filter((m) => freshRefs.has(`overdue:${m.key}`))
      .map((m) => ({
        title: m.template.title,
        slotLabel: m.slot === "day" ? "" : t(`tasks.slot.${m.slot}`),
        due: `${m.date === today ? "" : fmtDateTime.format(m.due).split(" ")[0] + " "}${fmtTime.format(m.due)}`,
      }));
    const devItems = (devs ?? [])
      .filter((d) => freshRefs.has(`deviation:${d.id}`))
      .map((d) => ({
        title: d.title,
        value:
          [
            d.value != null ? `${Number(d.value).toLocaleString(locale)} ${d.unit ?? ""}`.trim() : null,
            d.details?.package_ok === false ? t("tasks.packageDamaged") : null,
          ]
            .filter(Boolean)
            .join(" · ") || t("tasks.deviation"),
        corrective: d.corrective_action ?? "",
        who: d.performer_name,
        when: fmtDateTime.format(new Date(d.performed_at)),
      }));

    result.overdue += overdueItems.length;
    result.deviations += devItems.length;

    // příjemci: e-mail provozovny, jinak všichni majitelé firmy
    let to = loc.alert_email ? [loc.alert_email] : [];
    if (!to.length) {
      const { data: members } = await admin.from("company_members").select("user_id").eq("company_id", loc.company_id);
      for (const m of members ?? []) {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        if (data.user?.email) to.push(data.user.email);
      }
    }
    to = [...new Set(to)];
    if (!to.length) continue;

    const mail = renderAlertEmail(t, {
      locationName: loc.name,
      overdue: overdueItems,
      deviations: devItems,
      dashboardUrl: `${publicEnv.siteUrl()}/admin`,
    });
    if (dryRun) continue;

    const sendResult = await sendEmail(to, mail);
    if (!sendResult.ok) {
      result.errors.push(`${loc.name}: ${sendResult.error}`);
      continue; // nezapisovat do logu → zkusí se znovu za hodinu
    }
    result.emailsSent++;
    await admin.from("alert_log").upsert(
      fresh.map((f) => ({ company_id: loc.company_id, location_id: loc.id, kind: f.kind, ref_key: f.ref })),
      { onConflict: "ref_key", ignoreDuplicates: true },
    );
  }
  return result;
}

import { Card, PageTitle } from "@/components/card";
import { getLocale, getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { dayStats, doneKeySet, lastDays } from "@/lib/tasks/stats";
import { addDays, localDate } from "@/lib/tasks/time";
import { createClient } from "@/lib/supabase/server";
import type { TaskTemplate } from "@/lib/types";

export const metadata = { title: "Přehled" };

interface DeviationRow {
  id: string;
  location_id: string;
  title: string;
  value: number | null;
  unit: string | null;
  details: Record<string, unknown>;
  corrective_action: string | null;
  performer_name: string;
  performed_at: string;
  photo_path: string | null;
}

export default async function Dashboard() {
  const viewer = await requireOwner();
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const now = new Date();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, timezone")
    .eq("company_id", viewer.company.id)
    .order("created_at");
  if (!locations?.length) {
    return (
      <>
        <PageTitle>{t("dashboard.title")}</PageTitle>
        <p className="text-muted">{t("admin.locations.empty")}</p>
      </>
    );
  }

  const tz = locations[0].timezone;
  const today = localDate(now, tz);
  const days = lastDays(today, 7);

  const [{ data: templates }, { data: records }, { data: deviations }] = await Promise.all([
    supabase.from("task_templates").select("*").eq("company_id", viewer.company.id).returns<TaskTemplate[]>(),
    supabase
      .from("task_records")
      .select("location_id, template_id, task_date, slot")
      .eq("company_id", viewer.company.id)
      .gte("task_date", days[0])
      .limit(10000),
    supabase
      .from("task_records")
      .select("id, location_id, title, value, unit, details, corrective_action, performer_name, performed_at, photo_path")
      .eq("company_id", viewer.company.id)
      .eq("is_deviation", true)
      .gte("task_date", addDays(today, -13))
      .order("performed_at", { ascending: false })
      .limit(50)
      .returns<DeviationRow[]>(),
  ]);

  const photoPaths = (deviations ?? []).map((d) => d.photo_path).filter((p): p is string => !!p);
  const signed = photoPaths.length
    ? (await supabase.storage.from("task-photos").createSignedUrls(photoPaths, 3600)).data ?? []
    : [];
  const photoUrl = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const fmtTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const fmtDateTime = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <>
      <PageTitle>{t("dashboard.title")}</PageTitle>

      {locations.map((loc) => {
        const tpl = (templates ?? []).filter((x) => x.location_id === loc.id);
        const done = doneKeySet((records ?? []).filter((r) => r.location_id === loc.id));
        const week = days.map((d) => dayStats(tpl, done, d, loc.timezone, now));
        const todayStats = week[week.length - 1];

        return (
          <section key={loc.id} className="flex flex-col gap-4" aria-labelledby={`loc-${loc.id}`}>
            {locations.length > 1 && (
              <h2 id={`loc-${loc.id}`} className="text-xl font-bold">
                {loc.name}
              </h2>
            )}
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              {/* hero číslo: dnešní plnění */}
              <Card className="flex flex-col gap-2">
                <h3 className="font-semibold text-muted">{t("dashboard.today")}</h3>
                <p className="text-6xl font-bold tabular-nums">
                  {todayStats.percent ?? "–"}
                  {todayStats.percent != null && <span className="text-3xl">&nbsp;%</span>}
                </p>
                <p className="text-muted">
                  {t("dashboard.todayDetail", {
                    done: todayStats.done,
                    total: todayStats.total,
                    overdue: todayStats.overdue,
                  })}
                </p>
              </Card>

              {/* 7 dní: jedna řada → jedna barva, bez legendy; tooltip přes title, tabulka pro čtečky */}
              <Card className="flex flex-col gap-3">
                <h3 className="font-semibold text-muted">{t("dashboard.week")}</h3>
                <div className="flex h-40 items-end gap-0.5 border-b border-line" aria-hidden>
                  {week.map((d) => (
                    <div
                      key={d.date}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                      title={`${fmtDay.format(new Date(`${d.date}T00:00:00Z`))}: ${d.percent ?? "–"} % (${d.done}/${d.total})`}
                    >
                      <span className="pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 -translate-y-full rounded bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                        {d.percent ?? "–"} % · {d.done}/{d.total}
                      </span>
                      <div
                        className={`mx-auto w-3/4 rounded-t ${d.date === today ? "bg-brand" : "bg-brand/70"}`}
                        style={{ height: `${Math.max(d.percent ?? 0, 1)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-0.5 text-center text-xs text-muted" aria-hidden>
                  {week.map((d) => (
                    <span key={d.date} className={`flex-1 ${d.date === today ? "font-bold text-ink" : ""}`}>
                      {fmtDay.format(new Date(`${d.date}T00:00:00Z`))}
                    </span>
                  ))}
                </div>
                <table className="sr-only">
                  <caption>{t("dashboard.weekTable")}</caption>
                  <thead>
                    <tr>
                      <th>{t("dashboard.day")}</th>
                      <th>{t("dashboard.percent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.map((d) => (
                      <tr key={d.date}>
                        <td>{fmtDay.format(new Date(`${d.date}T00:00:00Z`))}</td>
                        <td>{d.percent == null ? t("dashboard.noTasks") : `${d.percent} % (${d.done}/${d.total})`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <Card className="flex flex-col gap-2">
              <h3 className="font-semibold">{t("dashboard.overdueNow")}</h3>
              {todayStats.missed.length === 0 ? (
                <p className="text-ok font-semibold">✓ {t("dashboard.noneOverdue")}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {todayStats.missed.map((m) => (
                    <li key={m.key} className="rounded-lg border-2 border-warn bg-warn-bg px-3 py-2 font-semibold text-warn">
                      ⚠ {m.template.title} {m.slot !== "day" && `(${t(`tasks.slot.${m.slot}`)})`} · {t("tasks.due", { time: fmtTime.format(m.due) })}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })}

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t("dashboard.deviations")}</h2>
        {!deviations?.length ? (
          <p className="text-muted">{t("dashboard.noDeviations")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-ink text-sm">
                  <th className="py-2 pr-3">{t("dashboard.when")}</th>
                  <th className="py-2 pr-3">{t("dashboard.task")}</th>
                  <th className="py-2 pr-3">{t("dashboard.value")}</th>
                  <th className="py-2 pr-3">{t("dashboard.action")}</th>
                  <th className="py-2 pr-3">{t("dashboard.who")}</th>
                  <th className="py-2">{t("dashboard.photo")}</th>
                </tr>
              </thead>
              <tbody>
                {deviations.map((d) => (
                  <tr key={d.id} className="border-b border-line align-top">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtDateTime.format(new Date(d.performed_at))}</td>
                    <td className="py-2 pr-3 font-semibold">
                      {d.title}
                      {locations.length > 1 && <span className="block text-sm font-normal text-muted">{locationName.get(d.location_id)}</span>}
                    </td>
                    <td className="py-2 pr-3 font-bold whitespace-nowrap text-danger">
                      ⚠ {d.value != null ? `${Number(d.value).toLocaleString(locale)} ${d.unit ?? ""}` : t("tasks.deviation")}
                      {d.details?.package_ok === false && <span className="block text-sm">{t("tasks.packageDamaged")}</span>}
                    </td>
                    <td className="py-2 pr-3">{d.corrective_action}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{d.performer_name}</td>
                    <td className="py-2">
                      {d.photo_path && photoUrl.get(d.photo_path) ? (
                        <a href={photoUrl.get(d.photo_path) ?? undefined} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                          {t("dashboard.showPhoto")}
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </>
  );
}

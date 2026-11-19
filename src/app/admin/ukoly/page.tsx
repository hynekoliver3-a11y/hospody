import Link from "next/link";
import { Card, PageTitle } from "@/components/card";
import { SubmitButton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskTemplate } from "@/lib/types";
import { deleteTemplate, setTemplateActive } from "./actions";
import { TemplateForm } from "./template-form";

export const metadata = { title: "Úkoly" };

export default async function TemplatesPage({ searchParams }: PageProps<"/admin/ukoly">) {
  const viewer = await requireOwner();
  const t = await getT();
  const supabase = await createClient();
  const { p } = await searchParams;

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("company_id", viewer.company.id)
    .order("created_at");
  const location = (locations ?? []).find((l) => l.id === p) ?? locations?.[0];
  if (!location) return <p className="text-muted">{t("admin.locations.empty")}</p>;

  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .eq("location_id", location.id)
    .order("sort_order")
    .order("created_at")
    .returns<TaskTemplate[]>();
  const active = (templates ?? []).filter((x) => x.active);
  const inactive = (templates ?? []).filter((x) => !x.active);

  const summary = (x: TaskTemplate) => {
    const time = x.due_time.slice(0, 5);
    if (x.frequency === "morning_evening")
      return t("admin.templates.summary.morning_evening", { morning: time, evening: x.evening_due_time.slice(0, 5) });
    if (x.frequency === "weekly")
      return t("admin.templates.summary.weekly", { day: t(`admin.templates.weekdays.${x.weekday}`), time });
    return t("admin.templates.summary.daily", { time });
  };
  const limits = (x: TaskTemplate) =>
    x.min_value != null || x.max_value != null
      ? ` · ${x.min_value ?? "−∞"} … ${x.max_value ?? "+∞"} ${x.unit}`
      : "";

  const Row = ({ x }: { x: TaskTemplate }) => (
    <li className="py-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <span>
            <span className="text-lg font-semibold">{x.title}</span>
            <span className="block text-sm text-muted">
              {t(`categories.${x.category}`)} · {summary(x)}
              {limits(x)}
            </span>
          </span>
          <span className="rounded-lg border-2 border-ink px-4 py-2 font-semibold group-open:bg-page">{t("common.edit")}</span>
        </summary>
        <div className="mt-4 flex flex-col gap-4 rounded-lg bg-page p-4">
          <TemplateForm template={x} locationId={location.id} />
          <div className="flex flex-wrap gap-3">
            <form action={setTemplateActive}>
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="active" value={String(!x.active)} />
              <SubmitButton size="md" variant={x.active ? "secondary" : "ok"}>
                {x.active ? t("admin.templates.disable") : t("admin.templates.enable")}
              </SubmitButton>
            </form>
            <form action={deleteTemplate}>
              <input type="hidden" name="id" value={x.id} />
              <SubmitButton size="md" variant="danger">
                {t("admin.templates.delete")}
              </SubmitButton>
            </form>
          </div>
          <p className="text-sm text-muted">{t("admin.templates.deleteHasRecords")}</p>
        </div>
      </details>
    </li>
  );

  return (
    <>
      <PageTitle>{t("admin.templates.title")}</PageTitle>
      <p className="text-muted">{t("admin.templates.intro")}</p>
      {(locations?.length ?? 0) > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("admin.templates.location")}>
          {locations!.map((l) => (
            <Link
              key={l.id}
              href={`/admin/ukoly?p=${l.id}`}
              className={`rounded-lg border-2 px-4 py-2 font-semibold ${l.id === location.id ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
            >
              {l.name}
            </Link>
          ))}
        </nav>
      )}
      <Card>
        <h2 className="text-xl font-bold">{location.name}</h2>
        {!active.length && <p className="text-muted">{t("admin.templates.empty")}</p>}
        <ul className="divide-y-2 divide-line">
          {active.map((x) => (
            <Row key={x.id} x={x} />
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("admin.templates.new")}</h2>
        <TemplateForm key={`new-${location.id}-${templates?.length ?? 0}`} locationId={location.id} />
      </Card>
      {inactive.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-muted">{t("admin.templates.inactive")}</h2>
          <ul className="divide-y-2 divide-line">
            {inactive.map((x) => (
              <Row key={x.id} x={x} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

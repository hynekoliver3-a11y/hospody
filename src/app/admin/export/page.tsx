import { Card, PageTitle } from "@/components/card";
import { buttonClass } from "@/components/button-class";
import { getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { addDays, localDate } from "@/lib/tasks/time";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Export" };

export default async function ExportPage() {
  const viewer = await requireOwner();
  const t = await getT();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, timezone")
    .eq("company_id", viewer.company.id)
    .order("created_at");
  const today = localDate(new Date(), locations?.[0]?.timezone ?? "Europe/Prague");
  const input = "min-h-13 rounded-lg border-2 border-line bg-white px-4 text-lg";

  return (
    <>
      <PageTitle>{t("export.title")}</PageTitle>
      <Card className="flex flex-col gap-4">
        <p className="text-muted">{t("export.intro")}</p>
        {/* nativní GET formulář → PDF se otevře v novém panelu (funguje i bez JS) */}
        <form action="/api/export/haccp" method="get" target="_blank" className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <label className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="font-semibold">{t("export.location")}</span>
            <select name="location" className={input}>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("export.from")}</span>
            <input type="date" name="from" required defaultValue={addDays(today, -13)} max={today} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("export.to")}</span>
            <input type="date" name="to" required defaultValue={today} max={today} className={input} />
          </label>
          <button type="submit" className={buttonClass()}>
            {t("export.submit")}
          </button>
        </form>
        <p className="text-sm text-muted">{t("export.rangeError")}</p>
      </Card>
    </>
  );
}

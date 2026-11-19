import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/card";
import { SubmitButton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Device, Employee, Location } from "@/lib/types";
import { pairThisDevice, revokeDevice, setEmployeeActive } from "../actions";
import { AddEmployeeForm, ChangePinForm, LocationForm } from "../forms";

export default async function LocationDetailPage({ params }: PageProps<"/admin/provozovny/[id]">) {
  await requireOwner();
  const { id } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id, company_id, name, address, timezone, public_slug, alert_email")
    .eq("id", id)
    .maybeSingle<Location>();
  if (!location) notFound();

  const [{ data: employees }, { data: devices }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, company_id, location_id, user_id, name, active, created_at")
      .eq("location_id", id)
      .order("active", { ascending: false })
      .order("name")
      .returns<Employee[]>(),
    supabase
      .from("devices")
      .select("id, company_id, location_id, name, created_at, last_seen_at, revoked_at")
      .eq("location_id", id)
      .order("created_at", { ascending: false })
      .returns<Device[]>(),
  ]);

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: location.timezone });

  return (
    <>
      <PageTitle>{location.name}</PageTitle>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("admin.locations.detail")}</h2>
        <LocationForm location={location} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("admin.employees.title")}</h2>
        {!employees?.length && <p className="text-muted">{t("admin.employees.empty")}</p>}
        <ul className="divide-y-2 divide-line">
          {(employees ?? []).map((e) => (
            <li key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className={`text-lg font-semibold ${e.active ? "" : "text-muted line-through"}`}>{e.name}</span>
                {!e.active && <span className="ml-2 text-sm text-muted">({t("common.inactive")})</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {e.active && <ChangePinForm employeeId={e.id} />}
                <form action={setEmployeeActive}>
                  <input type="hidden" name="employeeId" value={e.id} />
                  <input type="hidden" name="active" value={String(!e.active)} />
                  <SubmitButton size="md" variant={e.active ? "danger" : "ok"}>
                    {e.active ? t("admin.employees.deactivate") : t("admin.employees.activate")}
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t("admin.employees.deactivatedNote")}</p>
        <AddEmployeeForm locationId={location.id} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("admin.devices.title")}</h2>
        <p className="text-muted">{t("admin.devices.intro")}</p>
        {!devices?.length && <p className="text-muted">{t("admin.devices.empty")}</p>}
        <ul className="divide-y-2 divide-line">
          {(devices ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <span className="font-semibold">{d.name}</span>
                <span className="block text-sm text-muted">
                  {t("admin.devices.lastSeen", {
                    date: d.last_seen_at ? fmt.format(new Date(d.last_seen_at)) : t("admin.devices.never"),
                  })}
                </span>
              </div>
              {d.revoked_at ? (
                <span className="font-semibold text-muted">{t("admin.devices.revoked")}</span>
              ) : (
                <form action={revokeDevice}>
                  <input type="hidden" name="deviceId" value={d.id} />
                  <SubmitButton size="md" variant="danger">
                    {t("admin.devices.revoke")}
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={pairThisDevice} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="locationId" value={location.id} />
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("admin.devices.deviceName")}</span>
            <input
              name="name"
              defaultValue={t("admin.devices.deviceNameDefault")}
              className="min-h-13 rounded-lg border-2 border-line px-4 text-lg"
            />
          </label>
          <SubmitButton variant="ok">{t("admin.devices.pair")}</SubmitButton>
        </form>
      </Card>
    </>
  );
}

import Link from "next/link";
import { Card, PageTitle } from "@/components/card";
import { getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LocationForm } from "./forms";

export default async function LocationsPage() {
  const viewer = await requireOwner();
  const t = await getT();
  const supabase = await createClient();
  // pozn.: count(*) přes embed nejde – employees má jen sloupcová práva (skrytý pin_hash)
  const [{ data: locations }, { data: employees }] = await Promise.all([
    supabase.from("locations").select("id, name, address").eq("company_id", viewer.company.id).order("created_at"),
    supabase.from("employees").select("id, location_id").eq("company_id", viewer.company.id).eq("active", true),
  ]);
  const counts = new Map<string, number>();
  for (const e of employees ?? []) counts.set(e.location_id, (counts.get(e.location_id) ?? 0) + 1);

  return (
    <>
      <PageTitle>{t("admin.locations.title")}</PageTitle>
      {!locations?.length && <p className="text-muted">{t("admin.locations.empty")}</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {(locations ?? []).map((l) => (
          <li key={l.id}>
            <Link
              href={`/admin/provozovny/${l.id}`}
              className="flex flex-col rounded-xl border-2 border-line bg-white p-5 hover:border-brand"
            >
              <span className="text-lg font-bold">{l.name}</span>
              {l.address && <span className="text-muted">{l.address}</span>}
              <span className="mt-2 text-sm text-muted">
                {t("admin.locations.employeesCount", { count: counts.get(l.id) ?? 0 })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("admin.locations.new")}</h2>
        <LocationForm />
      </Card>
    </>
  );
}

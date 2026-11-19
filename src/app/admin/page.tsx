import Link from "next/link";
import { Card, PageTitle } from "@/components/card";
import { getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const viewer = await requireOwner();
  const t = await getT();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address")
    .eq("company_id", viewer.company.id)
    .order("created_at");
  return (
    <>
      <PageTitle>{t("admin.nav.dashboard")}</PageTitle>
      <Card>
        <p className="text-muted">{t("admin.dashboardSoon")}</p>
      </Card>
      <ul className="grid gap-4 sm:grid-cols-2">
        {(locations ?? []).map((l) => (
          <li key={l.id}>
            <Link href={`/admin/provozovny/${l.id}`} className="block rounded-xl border-2 border-line bg-white p-5 hover:border-brand">
              <span className="text-lg font-bold">{l.name}</span>
              {l.address && <span className="block text-muted">{l.address}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

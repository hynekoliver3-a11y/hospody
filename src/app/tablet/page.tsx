import { redirect } from "next/navigation";
import { Card } from "@/components/card";
import { LinkButton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/auth";
import { getPairedDevice } from "@/lib/device";
import { createAdminClient } from "@/lib/supabase/admin";
import { PinLogin } from "./pin-login";

export const metadata = { title: "Tablet" };

export default async function TabletPage() {
  const t = await getT();
  const viewer = await getViewer();
  const device = await getPairedDevice();

  if (!device) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <Card className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("tablet.notPairedTitle")}</h1>
          <p className="text-lg">{t("tablet.notPairedText")}</p>
          <LinkButton href={viewer.kind === "owner" ? "/admin/provozovny" : "/login"}>{t("tablet.ownerLogin")}</LinkButton>
        </Card>
      </main>
    );
  }
  if (viewer.kind === "employee" && viewer.employee.location_id === device.location_id) redirect("/ukoly");

  // Seznam jmen pro výběr – service role, protože na tabletu ještě nikdo není přihlášen.
  const { data: employees } = await createAdminClient()
    .from("employees")
    .select("id, name")
    .eq("location_id", device.location_id)
    .eq("active", true)
    .not("pin_hash", "is", null)
    .not("user_id", "is", null)
    .order("name");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <p className="text-lg font-semibold text-muted">{device.location.name}</p>
      <PinLogin employees={employees ?? []} />
    </main>
  );
}

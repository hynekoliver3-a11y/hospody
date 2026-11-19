import Link from "next/link";
import QRCode from "qrcode";
import { Card, PageTitle } from "@/components/card";
import { buttonClass } from "@/components/button-class";
import { SubmitButton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { groupByCategory, type MenuItem } from "@/lib/allergens";
import { requireOwner } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { deleteMenuItem } from "./actions";
import { MenuItemForm } from "./menu-item-form";

export const metadata = { title: "Alergeny" };

export default async function AllergensPage({ searchParams }: PageProps<"/admin/alergeny">) {
  const viewer = await requireOwner();
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { p } = await searchParams;

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, public_slug")
    .eq("company_id", viewer.company.id)
    .order("created_at");
  const location = (locations ?? []).find((l) => l.id === p) ?? locations?.[0];
  if (!location) return <p className="text-muted">{t("admin.locations.empty")}</p>;

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, location_id, name, description, category, price, allergens, active, sort_order")
    .eq("location_id", location.id)
    .order("sort_order")
    .order("created_at")
    .returns<MenuItem[]>();

  const publicUrl = `${publicEnv.siteUrl()}/menu/${location.public_slug}`;
  const qrSvg = await QRCode.toString(publicUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const qrHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  const price = new Intl.NumberFormat(locale, { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

  return (
    <>
      <PageTitle>{t("allergensAdmin.title")}</PageTitle>
      <p className="text-muted">{t("allergensAdmin.intro")}</p>
      {(locations?.length ?? 0) > 1 && (
        <nav className="flex flex-wrap gap-2">
          {locations!.map((l) => (
            <Link
              key={l.id}
              href={`/admin/alergeny?p=${l.id}`}
              className={`rounded-lg border-2 px-4 py-2 font-semibold ${l.id === location.id ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
            >
              {l.name}
            </Link>
          ))}
        </nav>
      )}

      <Card className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrHref} alt={publicUrl} width={180} height={180} className="rounded-lg border-2 border-line bg-white" />
        <div className="flex flex-col gap-3">
          <p className="font-semibold">{t("allergensAdmin.publicPage")}</p>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-brand underline">
            {publicUrl}
          </a>
          <p className="text-sm text-muted">{t("allergensAdmin.qrHint")}</p>
          <div className="flex flex-wrap gap-3">
            <a href={`/api/export/allergens?location=${location.id}`} target="_blank" className={buttonClass("primary", "md")}>
              {t("allergensAdmin.pdf")}
            </a>
            <a href={qrHref} download={`qr-alergeny-${location.public_slug}.svg`} className={buttonClass("secondary", "md")}>
              {t("allergensAdmin.downloadQr")}
            </a>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        {!items?.length && <p className="text-muted">{t("allergensAdmin.empty")}</p>}
        {groupByCategory(items ?? []).map(([category, list]) => (
          <div key={category || "-"} className="flex flex-col">
            {category && <h2 className="mt-2 text-lg font-bold">{category}</h2>}
            <ul className="divide-y-2 divide-line">
              {list.map((item) => (
                <li key={item.id} className="py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="text-lg font-semibold">{item.name}</span>
                        {item.price != null && <span className="ml-2 text-muted">{price.format(item.price)}</span>}
                        <span className="block text-sm">
                          {item.allergens.length ? (
                            <>
                              <b>{item.allergens.join(", ")}</b>{" "}
                              <span className="text-muted">({item.allergens.map((a) => t(`allergens.${a}`)).join(", ")})</span>
                            </>
                          ) : (
                            <span className="text-muted">{t("allergensAdmin.none")}</span>
                          )}
                        </span>
                      </span>
                      <span className="rounded-lg border-2 border-ink px-4 py-2 font-semibold group-open:bg-page">{t("common.edit")}</span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-4 rounded-lg bg-page p-4">
                      <MenuItemForm item={item} locationId={location.id} />
                      <form action={deleteMenuItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton size="md" variant="danger">
                          {t("allergensAdmin.delete")}
                        </SubmitButton>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t("allergensAdmin.new")}</h2>
        <MenuItemForm key={`new-${location.id}-${items?.length ?? 0}`} locationId={location.id} />
      </Card>
    </>
  );
}

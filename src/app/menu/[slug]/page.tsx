import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getT } from "@/i18n/server";
import { ALLERGEN_IDS, groupByCategory } from "@/lib/allergens";
import { getPublicMenu } from "@/lib/supabase/anon";

export async function generateMetadata({ params }: PageProps<"/menu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  const t = await getT();
  return { title: menu ? t("menuPublic.title", { location: menu.location.name }) : t("menuPublic.notFound") };
}

export default async function PublicMenuPage({ params }: PageProps<"/menu/[slug]">) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();
  const t = await getT();
  const locale = await getLocale();
  const price = new Intl.NumberFormat(locale, { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 bg-white px-4 py-8 print:py-0">
      <header>
        <p className="text-muted">{menu.company.name}</p>
        <h1 className="text-3xl font-bold">{t("menuPublic.title", { location: menu.location.name })}</h1>
        <p className="mt-2 text-muted">{t("menuPublic.intro")}</p>
      </header>

      {!menu.items.length && <p>{t("menuPublic.noItems")}</p>}
      {groupByCategory(menu.items).map(([category, list]) => (
        <section key={category || "-"} className="flex flex-col gap-1">
          {category && <h2 className="border-b-2 border-ink pb-1 text-xl font-bold">{category}</h2>}
          <ul className="divide-y divide-line">
            {list.map((item, i) => (
              <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-lg font-semibold">{item.name}</p>
                  {item.description && <p className="text-muted">{item.description}</p>}
                  {item.price != null && <p className="text-sm text-muted">{price.format(item.price)}</p>}
                </div>
                <p
                  className="flex shrink-0 flex-wrap gap-1 sm:justify-end"
                  aria-label={item.allergens.map((a) => t(`allergens.${a}`)).join(", ") || t("menuPublic.noAllergens")}
                >
                  {item.allergens.length ? (
                    item.allergens.map((a) => (
                      <span key={a} className="grid h-8 min-w-8 place-items-center rounded-full border-2 border-ink px-1 font-bold tabular-nums">
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">{t("menuPublic.noAllergens")}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-xl border-2 border-line bg-page p-4">
        <h2 className="mb-2 text-lg font-bold">{t("menuPublic.legend")}</h2>
        <ol className="grid gap-1 sm:grid-cols-2">
          {ALLERGEN_IDS.map((id) => (
            <li key={id}>
              <b className="inline-block w-7 tabular-nums">{id}</b>
              {t(`allergens.${id}`)}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-sm text-muted">{t("menuPublic.pdfFooter")}</p>
    </main>
  );
}

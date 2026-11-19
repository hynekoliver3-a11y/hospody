import { redirect } from "next/navigation";
import { Card } from "@/components/card";
import { LinkButton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { getViewer, homeFor } from "@/lib/auth";

export default async function Home() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(homeFor(viewer));
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold text-brand sm:text-4xl">{t("app.name")}</h1>
        <p className="mt-2 text-lg text-muted">{t("app.tagline")}</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t("home.ownerTitle")}</h2>
          <p className="text-muted">{t("home.ownerText")}</p>
          <div className="mt-auto flex flex-col gap-3">
            <LinkButton href="/login">{t("home.ownerLogin")}</LinkButton>
            <LinkButton href="/registrace" variant="secondary">
              {t("home.ownerRegister")}
            </LinkButton>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t("home.tabletTitle")}</h2>
          <p className="text-muted">{t("home.tabletText")}</p>
          <LinkButton href="/tablet" variant="ok" className="mt-auto">
            {t("home.tabletOpen")}
          </LinkButton>
        </Card>
      </div>
    </main>
  );
}

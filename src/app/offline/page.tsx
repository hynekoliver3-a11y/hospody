import { Card } from "@/components/card";
import { LinkButton } from "@/components/ui";
import { getMessages } from "@/i18n/messages";
import { defaultLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";

// Statická stránka (bez cookies) – service worker ji ukládá při instalaci.
export const dynamic = "force-static";

export default function OfflinePage() {
  const t = createTranslator(getMessages(defaultLocale));
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Card className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("offline.page")}</h1>
        <p className="text-lg">{t("offline.pageText")}</p>
        <LinkButton href="/ukoly">{t("tasks.title")}</LinkButton>
      </Card>
    </main>
  );
}

import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/card";
import { getT } from "@/i18n/server";
import { getViewer, homeFor } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "no_company") redirect(homeFor(viewer));
  const t = await getT();
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Card className="flex flex-col gap-5">
        <PageTitle>{t("onboarding.title")}</PageTitle>
        <p className="text-muted">{t("onboarding.intro")}</p>
        <OnboardingForm />
      </Card>
    </main>
  );
}

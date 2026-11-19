import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/card";
import { getT } from "@/i18n/server";
import { getViewer, homeFor } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(homeFor(viewer));
  const t = await getT();
  return (
    <Card className="flex flex-col gap-5">
      <PageTitle>{t("auth.registerTitle")}</PageTitle>
      <RegisterForm />
      <p>
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-brand underline">
          {t("auth.loginLink")}
        </Link>
      </p>
    </Card>
  );
}

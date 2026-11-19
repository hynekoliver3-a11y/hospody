import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/card";
import { getT } from "@/i18n/server";
import { getViewer, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(homeFor(viewer));
  const t = await getT();
  const { next, error } = await searchParams;
  return (
    <Card className="flex flex-col gap-5">
      <PageTitle>{t("auth.loginTitle")}</PageTitle>
      {error === "confirm" && (
        <p className="rounded-lg border-2 border-danger bg-danger-bg px-4 py-3 text-danger">{t("auth.confirmFailed")}</p>
      )}
      <LoginForm next={typeof next === "string" ? next : "/admin"} />
      <p>
        {t("auth.noAccount")}{" "}
        <Link href="/registrace" className="font-semibold text-brand underline">
          {t("auth.registerLink")}
        </Link>
      </p>
    </Card>
  );
}

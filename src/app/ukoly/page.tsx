import { Card } from "@/components/card";
import { SubmitButton } from "@/components/ui";
import { employeeLogout } from "@/app/tablet/actions";
import { getT } from "@/i18n/server";
import { requireEmployee } from "@/lib/auth";

export default async function TasksPage() {
  const viewer = await requireEmployee();
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
          <p className="text-muted">{viewer.employee.name}</p>
        </div>
        <form action={employeeLogout}>
          <SubmitButton variant="secondary">{t("common.logout")}</SubmitButton>
        </form>
      </header>
      <Card>
        <p className="text-muted">{t("tasks.soon")}</p>
      </Card>
    </main>
  );
}

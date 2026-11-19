import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-xl font-bold text-brand">
        {t("app.name")}
      </Link>
      {children}
    </main>
  );
}

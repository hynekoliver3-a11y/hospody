import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { getT } from "@/i18n/server";
import { requireOwner } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireOwner();
  const t = await getT();
  const nav = [
    { href: "/admin", label: t("admin.nav.dashboard") },
    { href: "/admin/provozovny", label: t("admin.nav.locations") },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-lg font-bold">
            {t("app.name")}
          </Link>
          <span className="text-sm opacity-90">{viewer.company.name}</span>
          <form action={logout} className="ml-auto">
            <button type="submit" className="min-h-11 rounded-lg border-2 border-white px-4 font-semibold hover:bg-brand-dark">
              {t("common.logout")}
            </button>
          </form>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-t-lg px-4 py-3 font-semibold hover:bg-brand-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}

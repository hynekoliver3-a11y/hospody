import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: t("app.name"), template: `%s · ${t("app.name")}` }, description: t("app.tagline") };
}

export const viewport: Viewport = {
  themeColor: "#0b3b75",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}

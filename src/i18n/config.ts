// Podporované jazyky. Nový jazyk = přidat soubor messages/<kód>.json a kód sem.
export const locales = ["cs"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "cs";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

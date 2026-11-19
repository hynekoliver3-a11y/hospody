"use client";
import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator, type Translator } from "./translate";

const I18nContext = createContext<{ locale: Locale; t: Translator } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(getMessages(locale)) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx.t;
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used inside I18nProvider");
  return ctx.locale;
}

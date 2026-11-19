import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator } from "./translate";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
});

export async function getT() {
  return createTranslator(getMessages(await getLocale()));
}

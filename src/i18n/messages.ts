import type { Locale } from "./config";
import type { Messages } from "./translate";
import cs from "./messages/cs.json";

// Statický import → zprávy jsou v bundlu i pro offline režim.
const catalog: Record<Locale, Messages> = { cs };

export function getMessages(locale: Locale): Messages {
  return catalog[locale];
}

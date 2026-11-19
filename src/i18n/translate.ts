import type cs from "./messages/cs.json";

export type Messages = typeof cs;
export type TranslateVars = Record<string, string | number>;
export type Translator = (key: string, vars?: TranslateVars) => string;

function lookup(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

/** Vrátí překladovou funkci. Chybějící klíč vrací samotný klíč (snadno vidět v UI). */
export function createTranslator(messages: Messages): Translator {
  return (key, vars) => {
    const value = lookup(messages, key);
    if (typeof value !== "string") return key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

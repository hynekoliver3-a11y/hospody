// Zrcadlí vyhodnocení v DB triggeru (task_records_before_insert) – jen pro okamžitou zpětnou vazbu v UI.
// Rozhodující je vždy databáze.
export interface Limits {
  min_value: number | null;
  max_value: number | null;
}

export function outOfLimits(value: number | null | undefined, l: Limits): boolean {
  if (value == null || Number.isNaN(value)) return false;
  return (l.min_value != null && value < l.min_value) || (l.max_value != null && value > l.max_value);
}

/** "3,5" → 3.5; prázdné/nevalidní → null */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(",", ".").replace("−", "-");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function formatLimits(l: Limits & { unit: string }, locale: string): string {
  const f = (n: number) => n.toLocaleString(locale);
  if (l.min_value != null && l.max_value != null) return `${f(l.min_value)} až ${f(l.max_value)} ${l.unit}`;
  if (l.min_value != null) return `≥ ${f(l.min_value)} ${l.unit}`;
  if (l.max_value != null) return `≤ ${f(l.max_value)} ${l.unit}`;
  return "";
}

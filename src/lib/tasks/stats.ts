import { occurrencesForDay, recordKey, type Occurrence, type RecordRef, type ScheduleTemplate } from "./schedule";
import { addDays } from "./time";

export interface DayStats {
  date: string;
  total: number;
  done: number;
  overdue: number; // termín minul a záznam chybí
  pending: number; // termín ještě nenastal
  percent: number | null; // null = žádné úkoly
}

/**
 * Plnění úkolů za den. Pozn.: počítá se s aktuálními šablonami (i pro minulé dny) –
 * pokud majitel úkol přidal/vypnul, historie se přepočítá podle nového stavu.
 */
export function dayStats<T extends ScheduleTemplate>(
  templates: T[],
  doneKeys: Set<string>,
  date: string,
  tz: string,
  now: Date,
): DayStats & { missed: Occurrence<T>[] } {
  const occ = occurrencesForDay(templates, date, tz);
  let done = 0;
  let pending = 0;
  const missed: Occurrence<T>[] = [];
  for (const o of occ) {
    if (doneKeys.has(o.key)) done++;
    else if (o.due.getTime() < now.getTime()) missed.push(o);
    else pending++;
  }
  return {
    date,
    total: occ.length,
    done,
    overdue: missed.length,
    pending,
    percent: occ.length ? Math.round((done / occ.length) * 100) : null,
    missed,
  };
}

export function doneKeySet(records: RecordRef[]): Set<string> {
  return new Set(records.map(recordKey));
}

/** Posledních `days` dní končících dneškem (nejstarší první). */
export function lastDays(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
}

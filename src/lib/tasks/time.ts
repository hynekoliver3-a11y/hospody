// Časové výpočty v časové zóně provozovny (bez externích knihoven).

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function parts(date: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const { type, value } of dtf(tz).formatToParts(date)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Posun zóny vůči UTC v ms pro daný okamžik. */
function offsetMs(date: Date, tz: string): number {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Místní datum 'YYYY-MM-DD' v zóně tz. */
export function localDate(date: Date, tz: string): string {
  const p = parts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Okamžik odpovídající místnímu datu + času ('HH:MM' nebo 'HH:MM:SS') v zóně tz. */
export function zonedToUtc(dateIso: string, time: string, tz: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  let result = guess - offsetMs(new Date(guess), tz);
  // druhý krok kvůli přechodu letní/zimní čas
  result = guess - offsetMs(new Date(result), tz);
  return new Date(result);
}

/** ISO den v týdnu (1 = pondělí … 7 = neděle) pro datum 'YYYY-MM-DD'. */
export function isoWeekday(dateIso: string): number {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

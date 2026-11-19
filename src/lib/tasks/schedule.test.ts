import { describe, expect, it } from "vitest";
import { occurrencesForDay, occurrenceStatus } from "./schedule";
import { addDays, isoWeekday, localDate, zonedToUtc } from "./time";

const TZ = "Europe/Prague";
const base = { active: true, sort_order: 0, weekday: null, due_time: "09:00:00", evening_due_time: "21:00:00" };

describe("time", () => {
  it("převádí místní čas Prahy na UTC v zimě i v létě", () => {
    expect(zonedToUtc("2026-01-15", "09:00", TZ).toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", TZ).toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });
  it("místní datum kolem půlnoci", () => {
    expect(localDate(new Date("2026-11-19T23:30:00Z"), TZ)).toBe("2026-11-20");
    expect(localDate(new Date("2026-11-19T22:59:00Z"), TZ)).toBe("2026-11-19");
  });
  it("den v týdnu a posun dní", () => {
    expect(isoWeekday("2026-11-16")).toBe(1); // pondělí
    expect(isoWeekday("2026-11-22")).toBe(7); // neděle
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("occurrencesForDay", () => {
  const templates = [
    { ...base, id: "daily", frequency: "daily" as const, due_time: "12:30:00" },
    { ...base, id: "twice", frequency: "morning_evening" as const },
    { ...base, id: "weekly", frequency: "weekly" as const, weekday: 1, due_time: "22:00:00" },
    { ...base, id: "off", frequency: "daily" as const, active: false },
  ];

  it("pondělí: denní, ráno+večer i týdenní; neaktivní ne", () => {
    const occ = occurrencesForDay(templates, "2026-11-16", TZ);
    expect(occ.map((o) => o.key)).toEqual([
      "twice:2026-11-16:morning",
      "daily:2026-11-16:day",
      "twice:2026-11-16:evening",
      "weekly:2026-11-16:week",
    ]);
  });

  it("úterý: bez týdenního úkolu", () => {
    expect(occurrencesForDay(templates, "2026-11-17", TZ).some((o) => o.template.id === "weekly")).toBe(false);
  });

  it("stav: hotovo / čeká / po termínu", () => {
    const [morning] = occurrencesForDay(templates, "2026-11-16", TZ);
    const before = new Date("2026-11-16T07:00:00Z");
    const after = new Date("2026-11-16T08:30:00Z");
    expect(occurrenceStatus(morning, new Set(), before)).toBe("pending");
    expect(occurrenceStatus(morning, new Set(), after)).toBe("overdue");
    expect(occurrenceStatus(morning, new Set([morning.key]), after)).toBe("done");
  });
});

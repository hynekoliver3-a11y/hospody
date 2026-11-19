import { describe, expect, it } from "vitest";
import { dayStats, doneKeySet, lastDays } from "./stats";

const TZ = "Europe/Prague";
const tpl = (id: string, frequency: "daily" | "morning_evening", due = "09:00:00") => ({
  id,
  frequency,
  due_time: due,
  evening_due_time: "21:00:00",
  weekday: null,
  active: true,
  sort_order: 0,
});

describe("dayStats", () => {
  const templates = [tpl("fridge", "morning_evening"), tpl("clean", "daily", "22:00:00")];
  const date = "2026-11-19";

  it("v poledne: ráno splněno, večer a úklid čekají", () => {
    const done = doneKeySet([{ template_id: "fridge", task_date: date, slot: "morning" }]);
    const s = dayStats(templates, done, date, TZ, new Date("2026-11-19T11:00:00Z"));
    expect(s).toMatchObject({ total: 3, done: 1, overdue: 0, pending: 2, percent: 33 });
  });

  it("po půlnoci: chybějící úkoly jsou nesplněné", () => {
    const s = dayStats(templates, new Set(), date, TZ, new Date("2026-11-20T06:00:00Z"));
    expect(s.overdue).toBe(3);
    expect(s.percent).toBe(0);
    expect(s.missed.map((m) => m.slot)).toEqual(["morning", "evening", "day"]);
  });

  it("den bez úkolů → percent null", () => {
    expect(dayStats([], new Set(), date, TZ, new Date()).percent).toBeNull();
  });

  it("lastDays", () => {
    expect(lastDays("2026-11-19", 3)).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
  });
});

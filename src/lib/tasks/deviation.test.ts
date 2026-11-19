import { describe, expect, it } from "vitest";
import { outOfLimits, parseDecimal } from "./deviation";

describe("deviation", () => {
  it("limity lednice 0–5", () => {
    const l = { min_value: 0, max_value: 5 };
    expect(outOfLimits(3.5, l)).toBe(false);
    expect(outOfLimits(5, l)).toBe(false);
    expect(outOfLimits(5.1, l)).toBe(true);
    expect(outOfLimits(-0.5, l)).toBe(true);
  });
  it("mrazák jen maximum, výdej jen minimum", () => {
    expect(outOfLimits(-20, { min_value: null, max_value: -18 })).toBe(false);
    expect(outOfLimits(-15, { min_value: null, max_value: -18 })).toBe(true);
    expect(outOfLimits(58, { min_value: 60, max_value: null })).toBe(true);
  });
  it("parsování desetinné čárky a mínusu", () => {
    expect(parseDecimal("3,5")).toBe(3.5);
    expect(parseDecimal("-18")).toBe(-18);
    expect(parseDecimal("−18,5")).toBe(-18.5);
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });
});

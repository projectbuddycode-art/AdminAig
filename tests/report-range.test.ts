import { describe, expect, it } from "vitest";
import { formatChange, percentChange, resolveReportRange } from "@/lib/report-range";

describe("report ranges", () => {
  const now = new Date("2026-11-15T12:00:00");

  it("uses the previous period of equal length", () => {
    const range = resolveReportRange({ preset: "7d", now });
    expect(range.to.getTime() - range.from.getTime()).toBe(range.previousTo.getTime() - range.previousFrom.getTime());
    expect(range.previousTo.getTime()).toBeLessThan(range.from.getTime());
  });

  it("does not invent a percentage when the previous period is zero", () => {
    expect(percentChange(4, 0)).toBeNull();
    expect(formatChange(null)).toBe("No prior period");
    expect(percentChange(10, 5)).toBe(100);
  });
});

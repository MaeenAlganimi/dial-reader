import { describe, expect, it } from "vitest";
import { checkReading, consumption, dialsToValue, median, normalize, readingValue, toCsv, LoggedReading } from "../src/lib/meter";

const h = (vals: number[]): LoggedReading[] => vals.map((v, i) => ({ id: String(i), takenAt: `2026-0${i + 1}-01`, kind: "electricity", value: v, confidence: 0.9 }));

describe("dial maths", () => {
  it("joins dials into a reading", () => expect(dialsToValue([0, 4, 7, 2, 9])).toBe(4729));
  it("rejects non-digits", () => expect(() => dialsToValue([1, 12])).toThrow());
  it("rejects empty", () => expect(() => dialsToValue([])).toThrow());
  it("falls back to odometer digits", () => expect(readingValue({ dials: [], ambiguousDials: [], odometer: "01 234", confidence: 1, notes: "" })).toBe(1234));
  it("normalizes model output", () => {
    const n = normalize({ dials: [3.6, 11, -1], ambiguousDials: [0, 7], odometer: null, confidence: 4, notes: "x" });
    expect(n.dials).toEqual([4, 9, 0]);
    expect(n.ambiguousDials).toEqual([0]);
    expect(n.confidence).toBe(1);
  });
});

describe("history checks", () => {
  it("flags backwards readings", () => expect(checkReading(90, 0.9, h([100])).some((f) => f.level === "error")).toBe(true));
  it("flags spikes over 3x median", () => expect(checkReading(1000, 0.9, h([100, 200, 300])).some((f) => f.message.includes("3x"))).toBe(true));
  it("passes normal usage", () => expect(checkReading(400, 0.9, h([100, 200, 300]))[0].level).toBe("ok"));
  it("warns on low confidence", () => expect(checkReading(400, 0.3, h([300]))[0].level).toBe("warn"));
  it("computes consumption and median", () => {
    expect(consumption(h([100, 150, 250])).map((c) => c.used)).toEqual([50, 100]);
    expect(median([5, 1, 3, 2])).toBe(2.5);
  });
  it("exports csv", () => expect(toCsv(h([7])).split("\n")[1]).toBe("2026-01-01,electricity,7,0.90"));
});

import { describe, expect, it } from "vitest";
import { arcPoint, clampPercent, confidenceTone } from "@/lib/charts/confidence";

describe("confidence gauge", () => {
  it("clamps values onto 0–100", () => {
    expect(clampPercent(-12)).toBe(0);
    expect(clampPercent(75)).toBe(75);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it("places the indicator on the top semicircle", () => {
    expect(arcPoint(100, 100, 80, 0)).toEqual({ x: 20, y: 100 });
    expect(arcPoint(100, 100, 80, 50)).toEqual({ x: 100, y: 20 });
    expect(arcPoint(100, 100, 80, 100)).toEqual({ x: 180, y: 100 });
  });

  it("maps confidence to CMC-style tones", () => {
    expect(confidenceTone(10)).toBe("#EA3943");
    expect(confidenceTone(40)).toBe("#EA8C00");
    expect(confidenceTone(64)).toBe("#93D900");
    expect(confidenceTone(90)).toBe("#16C784");
  });
});

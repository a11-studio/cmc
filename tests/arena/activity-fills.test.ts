import { describe, expect, it } from "vitest";
import { latestFillBatch } from "@/lib/arena/activity-fills";

function fill(id: string, createdAt: string) {
  return { id, createdAt };
}

describe("latestFillBatch", () => {
  it("keeps fills from the latest 15-minute wave and hides older ones", () => {
    const { latest, older } = latestFillBatch([
      fill("simons", "2026-09-18T11:30:00.000Z"),
      fill("livermore", "2026-09-18T11:20:00.000Z"),
      fill("elon", "2026-09-18T11:20:00.000Z"),
      fill("dennis", "2026-09-18T11:00:00.000Z"),
      fill("donchian", "2026-09-18T10:45:00.000Z"),
    ]);

    expect(latest.map((item) => item.id)).toEqual(["simons", "livermore", "elon"]);
    expect(older.map((item) => item.id)).toEqual(["dennis", "donchian"]);
  });

  it("pads the latest wave to at least three fills", () => {
    const { latest, older } = latestFillBatch([
      fill("elon", "2026-09-18T11:45:00.000Z"),
      fill("simons", "2026-09-18T11:30:00.000Z"),
      fill("livermore", "2026-09-18T11:15:00.000Z"),
      fill("dennis", "2026-09-18T11:00:00.000Z"),
    ]);

    expect(latest.map((item) => item.id)).toEqual(["elon", "simons", "livermore"]);
    expect(older.map((item) => item.id)).toEqual(["dennis"]);
  });

  it("shows every fill when there are fewer than three", () => {
    const { latest, older } = latestFillBatch([
      fill("simons", "2026-09-18T11:30:00.000Z"),
      fill("elon", "2026-09-18T11:00:00.000Z"),
    ]);

    expect(latest.map((item) => item.id)).toEqual(["simons", "elon"]);
    expect(older).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(latestFillBatch([])).toEqual({ latest: [], older: [] });
  });
});

import { describe, expect, it } from "vitest";
import { formatChartTime, formatClockTime, formatRelativeTime } from "@/lib/format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");

  it("formats minutes and hours from a timestamp", () => {
    expect(formatRelativeTime("2026-09-17T11:58:00.000Z", now)).toBe("2 min ago");
    expect(formatRelativeTime("2026-09-17T11:00:00.000Z", now)).toBe("1h ago");
  });
});

describe("formatClockTime", () => {
  it("renders an ISO timestamp in the viewer's timezone", () => {
    expect(formatClockTime("2026-09-18T05:54:43.293Z", "Europe/Bratislava")).toBe("07:54:43");
  });
});

describe("formatChartTime", () => {
  it("renders chart labels in the viewer's timezone", () => {
    expect(formatChartTime("2026-09-18T05:54:43.293Z", "Europe/Bratislava")).toBe("Sep 18, 07:54");
  });
});

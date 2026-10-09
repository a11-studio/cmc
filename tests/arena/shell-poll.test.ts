import { describe, expect, it } from "vitest";
import { shouldPollShellNow } from "@/lib/arena/shell-poll";

describe("shouldPollShellNow", () => {
  it("does not poll when the document is hidden", () => {
    expect(
      shouldPollShellNow({ cycleInProgress: true }, new Date("2026-09-17T11:00:00.000Z"), false)
    ).toBe(false);
  });

  it("polls during the hourly window when visible", () => {
    expect(shouldPollShellNow(null, new Date("2026-09-17T11:00:00.000Z"), true)).toBe(true);
    expect(shouldPollShellNow(null, new Date("2026-09-17T11:30:00.000Z"), true)).toBe(false);
  });

  it("polls while a cycle is in progress even outside the hourly window", () => {
    expect(
      shouldPollShellNow({ cycleInProgress: true }, new Date("2026-09-17T11:30:00.000Z"), true)
    ).toBe(true);
  });
});

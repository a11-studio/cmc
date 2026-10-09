import { describe, expect, it } from "vitest";
import { resetInFlightForTests, runInFlight } from "@/lib/server/in-flight";

describe("runInFlight", () => {
  it("deduplicates concurrent work for the same key", async () => {
    resetInFlightForTests();
    let runs = 0;

    const first = runInFlight("cycle-control", async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "ok";
    });
    const second = runInFlight("cycle-control", async () => {
      runs += 1;
      return "duplicate";
    });

    await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
    expect(runs).toBe(1);
  });
});

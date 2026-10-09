import { describe, expect, it } from "vitest";
import { SHELL_CYCLE_CONTROL_TTL_MS } from "@/lib/agent/cycle-control-constants";

describe("shell cycle-control cache ttl", () => {
  it("uses a five second shell cache window", () => {
    expect(SHELL_CYCLE_CONTROL_TTL_MS).toBe(5_000);
  });
});

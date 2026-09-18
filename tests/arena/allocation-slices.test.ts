import { describe, expect, it } from "vitest";
import { buildAllocationSlices } from "@/components/arena/agent-allocation-card";
import type { MomentumAlphaView } from "@/lib/agent/view";

function book(
  id: string,
  name: string,
  equity: number,
  cash: number,
  deployed: number
): MomentumAlphaView {
  return {
    agent: { id, name, strategy: "Test", equity, dataSource: "live" },
    cash,
    positions: deployed > 0 ? [{ symbol: "BTC", marketValue: deployed, quantity: 1, avgCost: 1 }] : [],
    recentDecisions: [],
    recentFills: [],
  } as unknown as MomentumAlphaView;
}

describe("buildAllocationSlices", () => {
  it("sorts slices from largest to smallest percent", () => {
    const slices = buildAllocationSlices([
      book("a", "Agent A", 10_000, 8_000, 2_000),
      book("b", "Agent B", 10_000, 2_000, 8_000),
      book("c", "Agent C", 10_000, 5_000, 5_000),
    ]);

    const labels = slices.map((slice) => slice.label);
    expect(labels).toEqual(["Cash", "Agent B", "Agent C", "Agent A"]);
  });
});

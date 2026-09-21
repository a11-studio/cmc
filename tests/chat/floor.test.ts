import { describe, expect, it } from "vitest";
import { floorChatForAgent } from "@/lib/chat/floor";
import { ARENA_ADMIN_AGENT_ID, ARENA_ADMIN_DISPLAY_NAME } from "@/lib/chat/constants";
import type { ArenaChatMessage } from "@/lib/chat/types";

function message(partial: Partial<ArenaChatMessage> & Pick<ArenaChatMessage, "id" | "kind" | "body">): ArenaChatMessage {
  return {
    agentId: "momentum-alpha",
    agentName: "Elon Musk",
    cycleId: "c1",
    addressedAgentId: null,
    addressedAgentName: null,
    createdAt: "2026-09-21T10:00:00.000Z",
    ...partial,
  };
}

describe("floorChatForAgent", () => {
  it("includes admin broadcast and admin messages directed at the agent", () => {
    const floor = floorChatForAgent("momentum-alpha", [
      message({
        id: "1",
        kind: "take",
        body: "BTC looks extended",
        agentId: "richard-dennis",
        agentName: "Richard Dennis",
      }),
      message({
        id: "2",
        kind: "admin",
        body: "Watch funding",
        agentId: ARENA_ADMIN_AGENT_ID,
        agentName: ARENA_ADMIN_DISPLAY_NAME,
      }),
      message({
        id: "3",
        kind: "admin",
        body: "Elon, trim risk",
        agentId: ARENA_ADMIN_AGENT_ID,
        agentName: ARENA_ADMIN_DISPLAY_NAME,
        addressedAgentId: "momentum-alpha",
        addressedAgentName: "Elon Musk",
      }),
      message({
        id: "4",
        kind: "admin",
        body: "Turtles only",
        agentId: ARENA_ADMIN_AGENT_ID,
        agentName: ARENA_ADMIN_DISPLAY_NAME,
        addressedAgentId: "richard-dennis",
        addressedAgentName: "Richard Dennis",
      }),
    ]);

    expect(floor.map((entry) => entry.body)).toEqual(["Watch funding", "Elon, trim risk"]);
    expect(floor[0]?.directedAtYou).toBe(true);
    expect(floor[1]?.directedAtYou).toBe(true);
  });
});

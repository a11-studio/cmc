import { describe, expect, it } from "vitest";
import { layoutArenaChat } from "@/lib/chat/layout";

describe("arena chat layout", () => {
  it("puts each message in its own bubble on opposite sides, then flips on the next exchange", () => {
    const items = layoutArenaChat([
      {
        id: "1",
        agentId: "richard-dennis",
        kind: "question",
        createdAt: "2026-09-18T10:30:00.000Z",
      },
      {
        id: "2",
        agentId: "momentum-alpha",
        kind: "reply",
        createdAt: "2026-09-18T10:30:01.000Z",
      },
      {
        id: "3",
        agentId: "momentum-alpha",
        kind: "question",
        createdAt: "2026-09-18T10:45:00.000Z",
      },
      {
        id: "4",
        agentId: "richard-dennis",
        kind: "reply",
        createdAt: "2026-09-18T10:45:01.000Z",
      },
    ]);

    expect(items.map((item) => [item.message.agentId, item.side])).toEqual([
      ["richard-dennis", "left"],
      ["momentum-alpha", "right"],
      ["momentum-alpha", "left"],
      ["richard-dennis", "right"],
    ]);
    expect(items[0]?.showTime).toBe(true);
    expect(items[1]?.showTime).toBe(false);
    expect(items[2]?.showTime).toBe(true);
  });

  it("centers admin messages", () => {
    const items = layoutArenaChat([
      {
        id: "a",
        agentId: "arena-admin",
        kind: "admin",
        createdAt: "2026-09-18T10:30:00.000Z",
      },
      {
        id: "b",
        agentId: "momentum-alpha",
        kind: "reply",
        createdAt: "2026-09-18T10:30:02.000Z",
      },
    ]);

    expect(items[0]?.side).toBe("center");
    expect(items[1]?.side).toBe("left");
  });
});

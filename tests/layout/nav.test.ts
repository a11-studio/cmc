import { describe, expect, it } from "vitest";
import { isActiveNavPath, PRIMARY_NAV } from "@/lib/layout/nav";

describe("primary navigation", () => {
  it("keeps Home, Research, Activities, Winners, Chat, and Settings", () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      "Home",
      "Research",
      "Activities",
      "Winners",
      "Chat",
      "Settings",
    ]);
    expect(isActiveNavPath("/", "home")).toBe(true);
    expect(isActiveNavPath("/agents/momentum-alpha", "home")).toBe(false);
    expect(isActiveNavPath("/research", "research")).toBe(true);
    expect(isActiveNavPath("/activity", "activity")).toBe(true);
    expect(isActiveNavPath("/winners", "winners")).toBe(true);
    expect(isActiveNavPath("/chat", "chat")).toBe(true);
  });
});

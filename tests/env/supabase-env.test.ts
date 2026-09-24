import { describe, expect, it } from "vitest";
import { normalizeSupabaseProjectUrl } from "@/lib/env";

describe("supabase env URL", () => {
  it("strips /rest/v1 from project URL", () => {
    expect(normalizeSupabaseProjectUrl("https://abc.supabase.co/rest/v1/")).toBe(
      "https://abc.supabase.co"
    );
  });
});

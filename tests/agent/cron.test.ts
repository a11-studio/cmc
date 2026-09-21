import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/agent/cron";

function requestWithAuth(token?: string): Request {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  return new Request("http://localhost/api/agents/cycle", { method: "POST", headers });
}

describe("isCronAuthorized", () => {
  it("allows any request in development when CRON_SECRET is unset", () => {
    expect(
      isCronAuthorized(requestWithAuth(), { NODE_ENV: "development", CRON_SECRET: "" }),
    ).toBe(true);
    expect(
      isCronAuthorized(requestWithAuth("wrong"), { NODE_ENV: "development", CRON_SECRET: "" }),
    ).toBe(true);
  });

  it("requires Bearer token in development when CRON_SECRET is set", () => {
    const env = { NODE_ENV: "development", CRON_SECRET: "dev-secret" };
    expect(isCronAuthorized(requestWithAuth(), env)).toBe(false);
    expect(isCronAuthorized(requestWithAuth("dev-secret"), env)).toBe(true);
    expect(isCronAuthorized(requestWithAuth("other"), env)).toBe(false);
  });

  it("denies all requests in production when CRON_SECRET is unset", () => {
    const env = { NODE_ENV: "production", CRON_SECRET: "" };
    expect(isCronAuthorized(requestWithAuth(), env)).toBe(false);
    expect(isCronAuthorized(requestWithAuth("anything"), env)).toBe(false);
  });

  it("requires matching Bearer token in production when CRON_SECRET is set", () => {
    const env = { NODE_ENV: "production", CRON_SECRET: "prod-secret" };
    expect(isCronAuthorized(requestWithAuth(), env)).toBe(false);
    expect(isCronAuthorized(requestWithAuth("prod-secret"), env)).toBe(true);
    expect(isCronAuthorized(requestWithAuth("wrong"), env)).toBe(false);
  });
});

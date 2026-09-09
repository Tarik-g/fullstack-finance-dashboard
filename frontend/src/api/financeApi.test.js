import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories, getDemoSessionId } from "./financeApi";

describe("anonymous demo session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores one UUID and sends it with every API request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    await getCategories();
    await getCategories();

    const firstHeaders = fetch.mock.calls[0][1].headers;
    const secondHeaders = fetch.mock.calls[1][1].headers;
    const sessionId = firstHeaders.get("X-Demo-Session-ID");

    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(secondHeaders.get("X-Demo-Session-ID")).toBe(sessionId);
    expect(getDemoSessionId()).toBe(sessionId);
  });

  it("replaces an invalid stored session ID", () => {
    localStorage.setItem("finance-dashboard-demo-session-id", "invalid");

    const sessionId = getDemoSessionId();

    expect(sessionId).not.toBe("invalid");
    expect(localStorage.getItem("finance-dashboard-demo-session-id")).toBe(
      sessionId,
    );
  });
});

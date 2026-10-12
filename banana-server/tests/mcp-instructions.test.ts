/** Server instructions: agents on the connector (no plugin skills) check for Mobbin first and use both. */
import { describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";

describe("server instructions", () => {
  it("put the Mobbin check before the flow, links only", () => {
    const mobbin = SERVER_INSTRUCTIONS.indexOf("Mobbin connector");
    const flow = SERVER_INSTRUCTIONS.indexOf("Flow:");
    expect(mobbin).toBeGreaterThan(-1);
    expect(mobbin).toBeLessThan(flow);
    expect(SERVER_INSTRUCTIONS).toMatch(/never place Mobbin images/);
    expect(SERVER_INSTRUCTIONS).toMatch(/do not mention Mobbin/);
    expect(SERVER_INSTRUCTIONS).toMatch(/6 to 8 UI and 2 to 4 art/);
  });

  it("is plain and short enough for clients that cap instructions", () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/[—–]/);
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(2500);
  });
});

describe("initialize", () => {
  it("returns the instructions to the client", { timeout: 20_000 }, async () => {
    const { buildMcpHandler } = await import("@/app/api/[transport]/handler");
    const handler = buildMcpHandler([], []);
    const res = await handler(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
        }),
      }),
    );
    expect(await res.text()).toContain("Mobbin connector");
  });
});

/** Server instructions: agents on the connector (no plugin skills) check for Mobbin first and use both. */
import { describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";

describe("server instructions", () => {
  it("put the Mobbin check before the flow, with Mobbin screens hotlinked on the board", () => {
    const mobbin = SERVER_INSTRUCTIONS.indexOf("Mobbin connector");
    const flow = SERVER_INSTRUCTIONS.indexOf("Flow:");
    expect(mobbin).toBeGreaterThan(-1);
    expect(mobbin).toBeLessThan(flow);
    expect(SERVER_INSTRUCTIONS).toMatch(/type: 'screen', imageUrl: image_url, sourceUrl: mobbin_url/);
    expect(SERVER_INSTRUCTIONS).toMatch(/never download them/);
    expect(SERVER_INSTRUCTIONS).toMatch(/Frankenstein part/);
    expect(SERVER_INSTRUCTIONS).toMatch(/never the whole page/);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/never place Mobbin images/);
    expect(SERVER_INSTRUCTIONS).toMatch(/do not mention Mobbin/);
    expect(SERVER_INSTRUCTIONS).toMatch(/sweep: true/);
    expect(SERVER_INSTRUCTIONS).toMatch(/arrange_canvas by_cluster/);
    expect(SERVER_INSTRUCTIONS).toMatch(/explore directions \(recommended, no code\)/);
  });

  it("push summary reads, reconcile before export and one direction at a time", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/get_canvas summary: true first/);
    expect(SERVER_INSTRUCTIONS).toMatch(/Before export_kit, run reconcile_direction/);
    expect(SERVER_INSTRUCTIONS).toMatch(/tell the user about any conflicts/);
    expect(SERVER_INSTRUCTIONS).toMatch(/build one at a time/);
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

/** The web canvas "Delete canvas" request: success, already gone, server error, network error. */
import { describe, expect, it } from "vitest";
import { DELETE_LABELS, requestCanvasDelete } from "@/canvas/DeleteCanvasButton";
import { en } from "@/lib/site/dict/en";

const reply = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("requestCanvasDelete", () => {
  it("sends DELETE to the canvas route", async () => {
    let seen: { url: string; method?: string } | null = null;
    const f = (async (url: string, init?: RequestInit) => {
      seen = { url, method: init?.method };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    expect(await requestCanvasDelete("abc/1", f)).toBeNull();
    expect(seen).toEqual({ url: "/api/canvas/abc%2F1", method: "DELETE" });
  });

  it("treats 404 as gone and reports other failures plainly", async () => {
    expect(await requestCanvasDelete("a", reply(404))).toBeNull();
    expect(await requestCanvasDelete("a", reply(503, { error: "Could not delete this canvas right now." }))).toBe(
      "Could not delete this canvas right now.",
    );
    expect(await requestCanvasDelete("a", reply(500, "x"))).toBe(DELETE_LABELS.deleteFailed);
    const offline = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await requestCanvasDelete("a", offline)).toBe(DELETE_LABELS.deleteFailed);
  });

  it("uses the dashboard's words", () => {
    for (const k of ["deleteCanvas", "deleteTitle", "deleteBody", "deleteUploads", "deleteCancel"] as const) {
      expect(DELETE_LABELS[k]).toBe(en.dashboard[k]);
    }
  });
});

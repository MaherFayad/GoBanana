/** VAL-02: bend_brief fromUpload, the user's own screenshot as the baseline. */
import { describe, expect, it } from "vitest";
import { createMemoryRepos } from "@/lib/db/memory";
import { createBendBriefTool, UPLOAD_NOT_FOUND } from "@/lib/mcp/tools/bend_brief";
import { uploadKey } from "@/lib/uploads/rules";
import type { UploadRecord } from "@/lib/uploads/types";
import { fakeR2 } from "./fake-r2";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const UPLOAD = "33333333-3333-4333-8333-333333333333";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const BRIEF = { brief: "pricing page for a note app", wildness: 3, count: 3, pages: ["pricing page"] };

async function setup(bytes = PNG, owner = ALICE) {
  const bucket = fakeR2();
  const row: UploadRecord = { id: UPLOAD, userId: owner, r2Key: uploadKey(owner, UPLOAD), mime: "image/png", bytes: bytes.byteLength };
  await bucket.put(row.r2Key, new Uint8Array(bytes));
  const tool = createBendBriefTool(() => ({
    repos: createMemoryRepos(),
    uploads: async () => ({ repo: { get: async (id: string) => (id === UPLOAD ? row : null) }, bucket: () => bucket }),
  }));
  return { tool, bucket };
}

describe("bend_brief fromUpload", () => {
  it("shows the owner their screenshot and asks for the parts, using the stitch roles", async () => {
    const { tool } = await setup();
    const res = await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD } }, ALICE);
    expect(res.isError).toBeUndefined();
    const text = (res.content[0] as { text: string }).text;
    expect(text).toContain("Your own page");
    expect(text).toContain("nav, hero");
    expect(res.content.some((c) => c.type === ("image" as string))).toBe(true);
    expect(res.structuredContent?.baseline).toMatchObject({ source: "upload", uploadId: UPLOAD });
  });

  it("writes the baseline line from the roles, dropping names that are not roles", async () => {
    const { tool } = await setup();
    const res = await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD, roles: ["Nav", "hero", "pricing", "banner", "footer"] } }, ALICE);
    const text = (res.content[0] as { text: string }).text;
    expect(text).toContain("Baseline (the user's own page, top to bottom): nav, hero, pricing, footer.");
    expect(text).toContain("Left out, not stitch roles: banner");
    expect(res.content).toHaveLength(1);
    expect(res.structuredContent?.baseline).toMatchObject({ roles: ["nav", "hero", "pricing", "footer"] });
    expect(text).not.toMatch(/[—–]/);
  });

  it("never reveals another user's upload", async () => {
    const { tool } = await setup(PNG, BOB);
    const res = await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD } }, ALICE);
    expect(res.isError).toBe(true);
    expect((res.content[0] as { text: string }).text).toBe(UPLOAD_NOT_FOUND);
  });

  it("needs a sign in and a valid shape", async () => {
    const { tool } = await setup();
    expect((await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD } }, undefined)).isError).toBe(true);
    expect((await tool({ ...BRIEF, fromUpload: { roles: ["nav"] } }, ALICE)).isError).toBe(true);
    expect((await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD, roles: [] } }, ALICE)).isError).toBe(true);
  });

  it("skips the inline image over the cap but still finds the upload", async () => {
    const big = new Uint8Array(1536 * 1024 + 10);
    big.set(PNG);
    const { tool } = await setup(big);
    const res = await tool({ ...BRIEF, fromUpload: { uploadId: UPLOAD } }, ALICE);
    expect(res.content).toHaveLength(1);
    expect((res.content[0] as { text: string }).text).toContain("too big to show here");
  });

  it("changes nothing without fromUpload", async () => {
    const { tool } = await setup();
    const res = await tool(BRIEF, ALICE);
    expect(res.structuredContent).not.toHaveProperty("baseline");
  });
});

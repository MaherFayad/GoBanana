/**
 * A seeded moodboard for the design gates and visual QA (plan Step 4): image tiles on allowed
 * hosts, a link card fallback, notes in several colors, swatches, a type sample and a section.
 *
 * The API and image hosts are mocked with page.route, so no database and no third-party
 * network is needed. Tile images are synthetic gradients drawn here (never anyone's image).
 */
import { crc32, deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

export const SEED_CANVAS_ID = "e2e-seed";

/** An RGB PNG with a diagonal two-color gradient. */
export function gradientPng(width: number, height: number, from: [number, number, number], to: [number, number, number]): Buffer {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      for (let c = 0; c < 3; c++) raw[y * row + 1 + x * 3 + c] = Math.round(from[c]! + (to[c]! - from[c]!) * t);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const GRADIENTS: Record<string, [[number, number, number], [number, number, number]]> = {
  r1: [[186, 222, 255], [74, 108, 170]],
  r2: [[255, 214, 170], [196, 72, 92]],
  r3: [[200, 240, 220], [40, 120, 110]],
  r4: [[236, 226, 255], [96, 70, 170]],
  r5: [[250, 250, 240], [150, 150, 140]],
};

const pin = (n: number, title: string, w = 736, h = 920) => ({
  id: `r${n}`,
  thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
  imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
  sourceUrl: `https://www.pinterest.com/pin/${n}/`,
  sourceSite: "pinterest.com",
  title,
  width: w,
  height: h,
});

const image = (id: string, n: number, x: number, y: number, w: number, h: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "image",
  x,
  y,
  w,
  h,
  ...extra,
  data: {
    imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
    thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    sourceSite: "pinterest.com",
    title,
  },
});

export const SEED_STATE = {
  version: 1,
  viewport: { x: 40, y: 32, zoom: 0.85 },
  nodes: [
    { id: "sec1", type: "section", x: 620, y: 0, w: 640, h: 440, data: { title: "Cold glass checkout" } },
    image("img1", 1, 24, 56, 280, 210, "Frosted vinyl sleeve", { parentId: "sec1" }),
    image("img2", 2, 328, 56, 280, 210, "Glass checkout button", { parentId: "sec1" }),
    { id: "note2", type: "note", x: 24, y: 290, w: 260, h: 120, parentId: "sec1", data: { text: "Keep the blur subtle, it should read as ice, not fog.", color: "blue" } },
    { id: "note1", type: "note", x: 0, y: 0, w: 240, h: 150, data: { text: "Make it feel cold and quiet.", color: "yellow" } },
    { id: "note3", type: "note", x: 0, y: 170, w: 240, h: 110, data: { text: "Avoid neon.", color: "pink" } },
    image("img3", 3, 280, 0, 300, 225, "Mint packaging system"),
    {
      id: "img-broken",
      type: "image",
      x: 0,
      y: 300,
      w: 280,
      h: 210,
      data: {
        imageUrl: "https://cdn.dribbble.com/userupload/broken.png",
        thumbUrl: "https://cdn.dribbble.com/userupload/broken_t.png",
        sourceUrl: "https://dribbble.com/shots/42-broken",
        sourceSite: "dribbble.com",
        title: "Icy dashboard concept",
      },
    },
    { id: "sw1", type: "swatch", x: 300, y: 250, w: 180, h: 200, data: { hex: "#1a56db", oklch: "oklch(0.52 0.21 262)", role: "primary", tag: "ship" } },
    { id: "sw2", type: "swatch", x: 300, y: 470, w: 180, h: 200, data: { hex: "#e8f1ff", oklch: "oklch(0.96 0.02 255)", role: "surface", tag: "explore" } },
    { id: "type1", type: "typeSample", x: 620, y: 470, w: 320, h: 180, data: { pairingId: "space-grotesk-inter", sample: "Cold, calm, clear" } },
  ],
  tray: [pin(4, "Ice typography poster"), pin(5, "Paper texture study"), pin(1, "Frosted vinyl sleeve")],
};

/** Mocks the canvas API (GET and PUT) and the image hosts for SEED_STATE. */
export async function mockSeedCanvas(page: Page, state: unknown = SEED_STATE, id = SEED_CANVAS_ID): Promise<void> {
  let saved: unknown = null;
  let version = 0;
  const stamp = () => new Date(Date.UTC(2026, 9, 11, 10, 0, version)).toISOString();
  await page.route(`**/api/canvas/${id}`, async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      saved = (req.postDataJSON() as { state: unknown }).state;
      version += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: stamp() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: saved ?? state, updatedAt: stamp() }) });
  });
  await page.route(`**/api/canvas/${id}/share`, (route) => {
    const token = "k3Yd9QeV2xLmNpQrStUvWxYz";
    const body = route.request().method() === "DELETE" ? { token: null, url: null } : { token, url: `https://banana.example.com/s/${token}` };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => {
    const n = /\/(r\d+)\.jpg$/.exec(route.request().url())?.[1] ?? "r1";
    const [from, to] = GRADIENTS[n] ?? GRADIENTS.r1!;
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(320, 240, from, to) });
  });
  await page.route(/^https:\/\/cdn\.dribbble\.com\//, (route) => route.abort("blockedbyclient"));
  // Type sample fonts come from Google Fonts in production; keep tests offline with an empty
  // stylesheet (an aborted <link precedence> makes React report an unhandled rejection).
  await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route(/^https:\/\/fonts\.gstatic\.com\//, (route) => route.abort("blockedbyclient"));
}

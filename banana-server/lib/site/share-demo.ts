/**
 * A demo shared canvas for the test-only sign-in bypass (E2E_AUTH_BYPASS, never on in a
 * production build): `/s/e2e-share-demo-token` renders this, so Playwright can screenshot the
 * share page without a database. Image URLs are on an allowed host and mocked by the tests;
 * nothing here is anyone's image.
 */
export const DEMO_SHARE_TOKEN = "e2e-share-demo-token-0000000000";

const image = (id: string, n: number, x: number, y: number, w: number, h: number, title: string, parentId?: string) => ({
  id,
  type: "image",
  x,
  y,
  w,
  h,
  ...(parentId ? { parentId } : {}),
  data: {
    imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
    thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    sourceSite: "pinterest.com",
    title,
  },
});

export const DEMO_SHARE = {
  title: "Cold checkout",
  ownerPlan: "pro_monthly" as const,
  state: {
    version: 1,
    viewport: { x: 40, y: 32, zoom: 0.85 },
    nodes: [
      { id: "sec1", type: "section", x: 620, y: 0, w: 640, h: 440, data: { title: "Cold glass checkout" } },
      image("img1", 1, 24, 56, 280, 210, "Frosted vinyl sleeve", "sec1"),
      image("img2", 2, 328, 56, 280, 210, "Glass checkout button", "sec1"),
      { id: "note2", type: "note", x: 24, y: 290, w: 260, h: 120, parentId: "sec1", data: { text: "Keep the blur subtle, it should read as ice, not fog.", color: "blue" } },
      { id: "note1", type: "note", x: 0, y: 0, w: 240, h: 150, data: { text: "Make it feel cold and quiet.", color: "yellow" } },
      image("img3", 3, 280, 0, 300, 225, "Mint packaging system"),
      { id: "type1", type: "typeSample", x: 0, y: 470, w: 320, h: 180, data: { pairingId: "space-grotesk-inter", sample: "Cold, calm, clear" } },
    ],
    tray: [],
  },
};

/** Directions of the demo share page, for the client review panel under the bypass. */
export const DEMO_REVIEW_TARGET = {
  canvasId: "3b2f6c1e-5d4a-4e8b-9a77-0c1d2e3f4a5b",
  ownerPlan: "pro_monthly" as const,
  directions: [
    { key: "bd-demo0001", title: "Checkout as a frosted vinyl sleeve" },
    { key: "bd-demo0002", title: "Checkout as a 1970s airline ticket" },
  ],
};

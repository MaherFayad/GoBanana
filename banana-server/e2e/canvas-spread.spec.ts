/**
 * Spread layout (P0-13): each direction becomes one horizontal spread (lead art at 2x, the
 * idea note beside it, a 3 by 2 UI grid, swatches and the type sample under it), spreads stack
 * top to bottom. Arranged from the keyboard through the Arrange menu, checked with axe, and
 * captured in light, dark and Arabic (right to left).
 *
 * Screenshots: SPREAD_SHOTS=<dir> also writes spread-<look>.png there (not a gate).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockSeedCanvas } from "./support/seed-canvas";

const CANVAS_ID = "e2e-spread";

const COPY = {
  en: {
    titles: ["Boarding pass checkout", "Night ledger", "Riso receipt"],
    note: (d: number) => `Mechanic ${d + 1}: the plan card tears off like a ticket stub. Twist: a stamped date.`,
  },
  ar: {
    titles: ["دفع بطاقة الصعود", "دفتر الليل", "إيصال الريسو"],
    note: (d: number) => `الفكرة ${d + 1}: بطاقة الباقة تنفصل مثل كعب التذكرة. اللمسة: تاريخ مختوم.`,
  },
};

const image = (id: string, n: number, parentId: string, w: number, h: number, zone?: "art") => ({
  id,
  type: "image",
  x: 16 + (n % 3) * 30,
  y: 60 + n * 8,
  w: 280,
  h: 210,
  parentId,
  data: {
    imageUrl: `https://i.pinimg.com/736x/r${(n % 5) + 1}.jpg`,
    thumbUrl: `https://i.pinimg.com/236x/r${(n % 5) + 1}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    sourceSite: "pinterest.com",
    title: `Shot ${n}`,
    width: w,
    height: h,
    ...(zone ? { zone } : {}),
  },
});

/** Three directions laid out as columns, each with art, a note, 6 UI shots, swatches and a type sample. */
function boardState(lang: "en" | "ar") {
  const nodes: unknown[] = [];
  for (let d = 0; d < 3; d++) {
    const s = `sec${d}`;
    nodes.push({ id: s, type: "section", x: d * 700, y: 0, w: 640, h: 1600, data: { title: COPY[lang].titles[d] } });
    nodes.push(image(`d${d}-art1`, d * 10 + 1, s, 1600, 1000, "art"), image(`d${d}-art2`, d * 10 + 2, s, 900, 900, "art"));
    nodes.push({ id: `d${d}-note`, type: "note", x: 16, y: 300, w: 220, h: 140, parentId: s, data: { text: COPY[lang].note(d), color: "yellow" } });
    for (let u = 0; u < 6; u++) nodes.push(image(`d${d}-ui${u}`, d * 10 + 3 + u, s, 750, 1500 - u * 120));
    nodes.push({ id: `d${d}-sw1`, type: "swatch", x: 16, y: 900, w: 220, h: 250, parentId: s, data: { hex: "#1a1a2e", role: "ink", tag: "ship" } });
    nodes.push({ id: `d${d}-sw2`, type: "swatch", x: 260, y: 900, w: 220, h: 250, parentId: s, data: { hex: "#f4f1de", role: "surface", tag: "explore" } });
    nodes.push({ id: `d${d}-type`, type: "typeSample", x: 16, y: 1200, w: 320, h: 170, parentId: s, data: { pairingId: "space-grotesk-inter", sample: lang === "ar" ? "هادئ وواضح" : "Calm and clear" } });
  }
  return { version: 1, viewport: { x: 40, y: 32, zoom: 0.4 }, nodes, tray: [] };
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

async function position(locator: Locator): Promise<{ x: number; y: number }> {
  const t = await locator.evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(t);
  if (!m) throw new Error(`no transform: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

async function width(locator: Locator): Promise<number> {
  return locator.evaluate((el) => parseFloat((el as HTMLElement).style.width));
}

const LOOKS = [
  { look: "light", lang: "en", scheme: "light" },
  { look: "dark", lang: "en", scheme: "dark" },
  { look: "arabic", lang: "ar", scheme: "light" },
] as const;

test.describe("spread layout", () => {
  for (const { look, lang, scheme } of LOOKS) {
    test(`keyboard arrange makes one spread per direction, stacked; axe passes (${look}) @a11y`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await mockSeedCanvas(page, boardState(lang), CANVAS_ID);
      await page.goto(`/c/${CANVAS_ID}`);
      // The canvas (web and inline) is dark only, whatever the system asks for: "light" checks a
      // system light preference, "arabic" a right to left page.
      if (lang === "ar") {
        await page.evaluate(() => {
          document.documentElement.setAttribute("dir", "rtl");
          document.documentElement.setAttribute("lang", "ar");
        });
      }
      await expect(node(page, "sec2")).toBeVisible();

      // Keyboard only: focus Arrange, open its menu, Spread is the first item.
      const arrange = page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name: "Arrange" });
      await arrange.focus();
      await page.keyboard.press("Enter");
      const spread = page.getByRole("menuitem", { name: "Spread", exact: true });
      await expect(spread).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator(".bn-visually-hidden[aria-live]")).toContainText("Arranged: Spread");

      // Spreads stack top to bottom at the same x, in direction order.
      await expect.poll(() => width(node(page, "d0-art1"))).toBe(560);
      const tops = await Promise.all([0, 1, 2].map((d) => position(node(page, `sec${d}`))));
      expect(new Set(tops.map((t) => t.x)).size).toBe(1);
      expect(tops[0]!.y).toBeLessThan(tops[1]!.y);
      expect(tops[1]!.y).toBeLessThan(tops[2]!.y);
      for (let d = 0; d < 3; d++) {
        const lead = await position(node(page, `d${d}-art1`));
        const note = await position(node(page, `d${d}-note`));
        const ui = await Promise.all([0, 1, 2, 3, 4, 5].map((u) => position(node(page, `d${d}-ui${u}`))));
        const sw = await position(node(page, `d${d}-sw1`));
        expect(note.x).toBeGreaterThan(lead.x + 559);
        expect(new Set(ui.map((p) => p.x)).size).toBe(3);
        expect(Math.min(...ui.map((p) => p.x))).toBeGreaterThan(note.x);
        expect(sw.y).toBeGreaterThan(Math.max(...ui.map((p) => p.y)));
        expect(await width(node(page, `d${d}-ui0`))).toBe(280);
      }

      // Settled pixels for contrast and the screenshot (fit view animates after arrange).
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);

      await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: testInfo.outputPath(`spread-${look}.png`) });
      if (process.env.SPREAD_SHOTS) await page.screenshot({ path: `${process.env.SPREAD_SHOTS}/spread-${look}.png` });

      // One spread up close: select the first direction and zoom to it (Shift+2).
      await node(page, "sec0").locator(".bn-section-title").click();
      await page.keyboard.press("Shift+2");
      await page.waitForTimeout(600);
      // The lead is wide enough to show its full source chip: it stays inside the tile (also right to left).
      const tile = (await node(page, "d0-art1").boundingBox())!;
      const chip = (await node(page, "d0-art1").locator("a.bn-source").boundingBox())!;
      expect(chip.x).toBeGreaterThanOrEqual(tile.x);
      expect(chip.x + chip.width).toBeLessThanOrEqual(tile.x + tile.width);
      await page.screenshot({ path: testInfo.outputPath(`spread-${look}-one.png`) });
      if (process.env.SPREAD_SHOTS) await page.screenshot({ path: `${process.env.SPREAD_SHOTS}/spread-${look}-one.png` });
    });
  }
});

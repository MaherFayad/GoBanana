/**
 * Gate: target size (SC 2.5.8 Target Size (Minimum), plan Step 4).
 *
 * Every focusable element, and every pointer-only target on the canvas (resize handles and
 * edges), is at least 24 by 24 CSS px, counting an invisible ::before/::after hit area, or
 * meets one of the SC's exceptions:
 * - Spacing: a 24px circle centered on the target meets no other target and no other
 *   undersized target's circle.
 * - Inline: a link inside a sentence, sized by the line height of the text around it.
 * - Equivalent: listed in ALLOW below with the control that does the same thing.
 *
 * Runs on /c/:id (E2E sign-in bypass, mocked API) with an item selected so the resize
 * handles and the note color pill are on screen, and on /en, /ar and /en/pricing.
 */
import { expect, test, type Page } from "@playwright/test";
import { mockSeedCanvas, SEED_CANVAS_ID, SEED_STATE } from "./support/seed-canvas";

// Board chrome scales with the board zoom like any design tool; measure at 100%, the zoom a
// canvas opens at and the one Mod+0 returns to.
const AT_100 = { ...SEED_STATE, viewport: { x: 40, y: 40, zoom: 1 } };

/** CSS selector -> why its targets may be under 24px. */
const ALLOW: Record<string, string> = {
  ".react-flow__resize-control.line":
    "Resize edge strips are 12px of hit area so they do not steal drags from the item (DECISIONS.md, WP-A deviation 1). " +
    "SC 2.5.8 'Equivalent' exception: the + and - keys on a focused item and the 'Make bigger' / 'Make smaller' menu items " +
    "resize the same item, and the 24px corner handles remain.",
};

type Finding = { what: string; w: number; h: number; reason: string };

async function undersized(page: Page, allow: Record<string, string>): Promise<Finding[]> {
  return page.evaluate((allowList) => {
    const MIN = 24;
    const FOCUSABLE =
      'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"], .react-flow__resize-control';
    const NATIVE = /^(A|AREA|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|IFRAME)$/;

    const describe = (el: Element) => {
      const name = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40);
      const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
      return `${el.tagName.toLowerCase()}${cls} "${name}"`;
    };

    /** Element box plus any absolutely positioned pseudo-element hit area. */
    const hitRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (const pseudo of ["::before", "::after"]) {
        const s = getComputedStyle(el, pseudo);
        if (s.content === "none" || s.content === "normal" || s.position !== "absolute" || s.pointerEvents === "none") continue;
        const w = parseFloat(s.width);
        const h = parseFloat(s.height);
        const x = parseFloat(s.left);
        const y = parseFloat(s.top);
        if ([w, h, x, y].some((n) => Number.isNaN(n))) continue;
        left = Math.min(left, r.left + x);
        top = Math.min(top, r.top + y);
        right = Math.max(right, r.left + x + w);
        bottom = Math.max(bottom, r.top + y + h);
      }
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    };

    const candidates = [...document.querySelectorAll(FOCUSABLE)].filter((el) => {
      if (!NATIVE.test(el.tagName) && el.getAttribute("tabindex") === "-1" && !el.matches(".react-flow__resize-control")) return false;
      if ((el as HTMLButtonElement).disabled) return false;
      if (el.closest("[inert], [hidden], dialog:not([open])")) return false;
      if (!el.checkVisibility({ visibilityProperty: true })) return false;
      return true;
    });

    const measured = candidates.map((el) => {
      let rect = hitRect(el);
      // Visually hidden until focused (skip link): measure it focused.
      if (rect.width <= 2 || rect.height <= 2) {
        (el as HTMLElement).focus({ preventScroll: true });
        rect = hitRect(el);
        (el as HTMLElement).blur();
      }
      return { el, rect };
    });
    // Still 1px after focus: a visually hidden control whose pointer target is its <label>.
    // Covered (an open menu over the board): the pointer cannot reach it, so it is no target.
    const reachable = (el: Element, r: { left: number; top: number; width: number; height: number }) => {
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
      const hit = document.elementFromPoint(x, y);
      return !hit || el.contains(hit) || hit.contains(el) || !hit.closest('[role="menu"], dialog[open]');
    };
    const targets = measured.filter((m) => m.rect.width > 2 && m.rect.height > 2 && reachable(m.el, m.rect));
    const small = targets.filter((m) => m.rect.width < MIN - 0.01 || m.rect.height < MIN - 0.01);

    const center = (r: { left: number; top: number; width: number; height: number }) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const distToRect = (p: { x: number; y: number }, r: { left: number; top: number; right: number; bottom: number }) =>
      Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));

    const out: { what: string; w: number; h: number; reason: string }[] = [];
    for (const m of small) {
      const allowed = Object.keys(allowList).find((sel) => m.el.matches(sel));
      if (allowed) continue;
      // Inline exception: a link in running text.
      const display = getComputedStyle(m.el).display;
      if (m.el.tagName === "A" && display === "inline") {
        let block: Element | null = m.el.parentElement;
        while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
        const own = (m.el.textContent ?? "").trim().length;
        const all = (block?.textContent ?? "").trim().length;
        if (all > own + 10) continue;
      }
      // Spacing exception.
      const c = center(m.rect);
      const clash = targets.find((o) => {
        if (o === m || o.el.contains(m.el) || m.el.contains(o.el)) return false;
        const oSmall = small.includes(o);
        return oSmall ? Math.hypot(center(o.rect).x - c.x, center(o.rect).y - c.y) < MIN : distToRect(c, o.rect) < MIN / 2;
      });
      if (!clash) continue;
      out.push({ what: describe(m.el), w: Math.round(m.rect.width * 10) / 10, h: Math.round(m.rect.height * 10) / 10, reason: `too close to ${describe(clash.el)}` });
    }
    return out;
  }, allow);
}

test.describe("design gate: target size (SC 2.5.8)", () => {
  test("/c/:id with a selected item", async ({ page }) => {
    await mockSeedCanvas(page, AT_100);
    await page.goto(`/c/${SEED_CANVAS_ID}`);
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    // Select a note: its resize handles, edge strips and color pill come up.
    await page.locator('.react-flow__node[data-id="note1"]').click({ position: { x: 40, y: 40 } });
    await expect(page.locator(".react-flow__resize-control.handle").first()).toBeVisible();
    // The allow-listed strips exist, so the allow-list is exercised, not stale.
    expect(await page.locator(".react-flow__resize-control.line").count()).toBeGreaterThan(0);
    expect(await undersized(page, ALLOW)).toEqual([]);
  });

  test("/c/:id with the node menu open", async ({ page }) => {
    await mockSeedCanvas(page, AT_100);
    await page.goto(`/c/${SEED_CANVAS_ID}`);
    const note = page.locator('.react-flow__node[data-id="note1"]');
    await note.focus();
    await page.keyboard.press("m");
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await undersized(page, ALLOW)).toEqual([]);
  });

  for (const url of ["/en", "/ar", "/en/pricing"]) {
    test(url, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.locator(".site")).toBeVisible();
      expect(await undersized(page, ALLOW)).toEqual([]);
    });
  }
});

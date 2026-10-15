/**
 * Studio primitives (plan Step 0) on the test-only gallery at /__design (app/%5F_design).
 * Covers axe in light, dark, ltr and rtl, the tooltip (SC 1.4.13), the native dialog,
 * toasts, target sizes (SC 2.5.8), mirrored icons, reduced motion and self-hosted fonts.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page, label: string) {
  // axe reads colors from the live frame. Dialogs and toasts fade in, so wait for finite
  // animations to settle or it reads blended mid-fade colors (3.3 to 4.0:1), not the tokens.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations,
    `${label}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })), null, 2)}`,
  ).toEqual([]);
}

/** Hydrated: tooltip bubbles mount in an effect, so their presence means handlers are attached. */
async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await expect(page.locator(".st-tooltip").first()).toBeAttached();
  return res;
}

for (const theme of ["light", "dark"] as const) {
  for (const dir of ["ltr", "rtl"] as const) {
    test(`axe is clean in ${theme} ${dir} @a11y`, async ({ page }) => {
      await open(page, `/__design?theme=${theme}&dir=${dir}`);
      const panel = page.getByTestId(`panel-${theme}-${dir}`);
      await expect(panel).toBeVisible();
      await axe(page, `${theme} ${dir}`);

      await panel.getByRole("button", { name: "Delete account" }).click();
      await expect(panel.getByRole("alertdialog")).toBeVisible();
      await axe(page, `${theme} ${dir}, danger dialog open`);
      await page.keyboard.press("Escape");

      await panel.getByRole("button", { name: "Error toast" }).click();
      await panel.getByRole("button", { name: "Success toast" }).click();
      await expect(page.locator(".st-toast")).toHaveCount(2);
      await axe(page, `${theme} ${dir}, toasts open`);
    });
  }
}

test("the gallery renders all four combinations and 404s nothing in dev", async ({ page }) => {
  const res = await open(page, "/__design");
  expect(res?.status()).toBe(200);
  await expect(page.locator(".design-panel")).toHaveCount(4);
});

test("tooltip opens on hover, stays while hovered, closes on Escape and leave", async ({ page }) => {
  await open(page, "/__design?theme=light&dir=ltr");
  const share = page.getByRole("button", { name: "Share", exact: true });
  const describedBy = await share.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const tip = page.locator(`#${describedBy}`);
  await expect(tip).toHaveAttribute("role", "tooltip");
  await expect(tip).toBeHidden();
  // The description resolves even while hidden.
  await expect(share).toHaveAccessibleDescription("Sign in to share a canvas.");

  await share.hover();
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText("Sign in to share a canvas.");

  // Hoverable: move onto the bubble and wait past the close grace.
  await tip.hover();
  await page.waitForTimeout(400);
  await expect(tip).toBeVisible();

  // Dismissible without moving the pointer.
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  await share.hover();
  await expect(tip).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();
});

test("tooltip opens on keyboard focus and is not a description when it repeats the name", async ({ page }) => {
  await open(page, "/__design?theme=dark&dir=ltr");
  const zoom = page.getByRole("button", { name: "Zoom in" }).first();
  expect(await zoom.getAttribute("aria-describedby")).toBeNull();
  await page.getByRole("button", { name: "Delete canvas" }).first().focus();
  await page.keyboard.press("Tab");
  await expect(zoom).toBeFocused();
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeHidden();
});

test("tooltip in rtl sits above its trigger, inside the viewport", async ({ page }) => {
  await open(page, "/__design?theme=light&dir=rtl");
  const share = page.getByRole("button", { name: "Share", exact: true });
  await share.hover();
  const tip = page.getByRole("tooltip", { name: "Sign in to share a canvas." });
  await expect(tip).toBeVisible();
  const t = await share.boundingBox();
  const b = await tip.boundingBox();
  if (!t || !b) throw new Error("no boxes");
  expect(b.y + b.height).toBeLessThanOrEqual(t.y);
  expect(Math.abs(b.x + b.width / 2 - (t.x + t.width / 2))).toBeLessThan(2);
  await expect(tip).toHaveAttribute("dir", "rtl");
});

test("dialog: showModal, focus to the first control, Escape closes and focus returns", async ({ page }) => {
  await open(page, "/__design?theme=light&dir=ltr");
  const opener = page.getByRole("button", { name: "Share canvas" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Share canvas" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => (d as HTMLDialogElement).open && d.matches(":modal"))).toBe(true);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // The close button closes too and also returns focus.
  await opener.click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // A click on the backdrop closes the default tone.
  await opener.click();
  await page.mouse.click(10, 10);
  await expect(dialog).toBeHidden();
});

test("danger dialog is an alertdialog that ignores backdrop clicks", async ({ page }) => {
  await open(page, "/__design?theme=dark&dir=ltr");
  const opener = page.getByRole("button", { name: "Delete account" });
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(/canvases, uploads and share links are deleted/);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.mouse.click(10, 10);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("toasts: roles, de-duplication, timing, errors persist, pause on hover", async ({ page }) => {
  await page.clock.install();
  await open(page, "/__design?theme=light&dir=ltr");

  await page.getByRole("button", { name: "Error toast" }).click();
  await expect(page.locator(".st-toast")).toHaveCount(1);
  await page.clock.runFor(100);
  await expect(page.getByRole("alert").filter({ hasText: "Could not save" })).toHaveCount(1);
  await page.getByRole("button", { name: "Error toast" }).click();
  await expect(page.locator(".st-toast")).toHaveCount(1);
  await expect(page.locator(".st-toast-count")).toHaveText("×2");

  await page.getByRole("button", { name: "Success toast" }).click();
  await page.clock.runFor(100);
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toHaveCount(1);
  await expect(page.locator(".st-toast")).toHaveCount(2);

  // Hovering the stack pauses every timer.
  await page.locator(".st-toast[data-kind=success]").hover();
  await page.clock.runFor(6000);
  await expect(page.locator(".st-toast[data-kind=success]")).toHaveCount(1);
  await page.mouse.move(5, 5);
  await page.clock.runFor(4100);
  await expect(page.locator(".st-toast[data-kind=success]")).toHaveCount(0);

  // Errors stay until closed.
  await page.clock.runFor(60_000);
  await expect(page.locator(".st-toast[data-kind=error]")).toHaveCount(1);
  await page.getByRole("button", { name: "Close notification" }).click();
  await expect(page.locator(".st-toast")).toHaveCount(0);
});

test("toast stack sits at the block end and inline end corner", async ({ page }) => {
  await open(page, "/__design?theme=dark&dir=ltr");
  await page.getByRole("button", { name: "Warning toast" }).click();
  const box = await page.locator(".st-toast-stack").boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) throw new Error("no box");
  expect(Math.round(vp.width - (box.x + box.width))).toBe(16);
  expect(Math.round(vp.height - (box.y + box.height))).toBe(16);
});

test("every control in the gallery is at least 24 by 24 px", async ({ page }) => {
  await open(page, "/__design");
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a[href], input, textarea, [role=menuitem], [role=menuitemradio]")]
      .filter((el) => el.offsetParent !== null)
      // Links inside a sentence are exempt (SC 2.5.8 inline exception).
      .filter((el) => !(el.tagName === "A" && el.parentElement?.tagName === "P"))
      .map((el) => ({ el: el.outerHTML.slice(0, 80), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 24 || r.height < 24)
      .map(({ el, r }) => `${el} ${r.width}x${r.height}`),
  );
  expect(small).toEqual([]);
});

test("button states: sizes, pressed ring, loading keeps width, yellow primary", async ({ page }) => {
  await open(page, "/__design?theme=light&dir=ltr");
  const heights = await page.evaluate(() =>
    ["xs", "sm", "md", "lg"].map((s) => document.querySelector<HTMLElement>(`.st-btn[data-size="${s}"]`)?.getBoundingClientRect().height),
  );
  expect(heights).toEqual([24, 28, 32, 44]);
  const iconOnly = page.locator('.st-btn[data-size="xs"][data-icon-only]').first();
  const box = await iconOnly.boundingBox();
  expect([box?.width, box?.height]).toEqual([24, 24]);

  const toggle = page.getByTestId("toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // The selected cue is a 1px ring over the whole button (owner decision, d8c7ece: no underline
  // bars on any selected state), not a 2px bar.
  const ring = await toggle.evaluate((el) => {
    const s = getComputedStyle(el, "::after");
    return { width: s.borderTopWidth, style: s.borderTopStyle, height: Number.parseFloat(s.blockSize), button: el.clientHeight };
  });
  // blockSize is the content box: the 1px border on each side brings the ring to the full button height.
  expect({ width: ring.width, style: ring.style, covers: ring.height + 2 === ring.button }).toEqual({ width: "1px", style: "solid", covers: true });

  const primary = page.locator('.st-btn[data-variant="primary"]').first();
  const colors = await primary.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color, border: s.borderTopColor };
  });
  expect(colors).toEqual({ bg: "rgb(255, 216, 77)", fg: "rgb(17, 24, 39)", border: "rgb(122, 92, 0)" });

  const loading = page.locator('.st-btn[data-loading=""]');
  await expect(loading).toHaveCSS("color", "rgba(0, 0, 0, 0)");
});

test("directional icons mirror in rtl only", async ({ page }) => {
  await open(page, "/__design");
  const transform = (dir: string) =>
    page
      .getByTestId(`panel-light-${dir}`)
      .locator('[data-icon="chevron-end"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
  expect(await transform("rtl")).toBe("matrix(-1, 0, 0, 1, 0, 0)");
  expect(await transform("ltr")).toBe("none");
  const plain = await page.getByTestId("panel-light-rtl").locator('[data-icon="search"]').first().evaluate((el) => getComputedStyle(el).transform);
  expect(plain).toBe("none");
});

test("reduced motion zeroes the duration tokens", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/__design?theme=light&dir=ltr");
  const d = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--st-duration-base").trim());
  expect(d).toMatch(/^0m?s$/);
});

test("Inter and IBM Plex Sans Arabic load from this origin", async ({ page }) => {
  const fontHosts = new Set<string>();
  page.on("request", (r) => {
    if (r.resourceType() === "font") fontHosts.add(new URL(r.url()).host);
  });
  await open(page, "/__design?theme=light&dir=rtl");
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")));
  expect(loaded).toContain("Inter Variable");
  expect(loaded).toContain("IBM Plex Sans Arabic");
  const origin = new URL(page.url()).host;
  expect([...fontHosts]).toEqual([origin]);
});

for (const [path, family] of [
  // The site uses the desk font (Instrument Sans) since the desktop redesign (DECISIONS.md 2026-10-12).
  ["/en", "Instrument Sans"],
  ["/ar", "IBM Plex Sans Arabic"],
] as const) {
  test(`site page ${path} renders in ${family}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")));
    expect(loaded).toContain(family);
    const stack = await page.locator(".site").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(stack.startsWith(`"${family}"`)).toBe(true);
  });
}

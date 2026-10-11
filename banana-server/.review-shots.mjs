// Scratch review only: real hotlinked images, screenshots saved outside the repo and deleted after review.
// The browser talks to the local dev server directly; image CDN requests are fetched through the
// agent proxy in Node (undici ProxyAgent) and handed to the page. Nothing is written but the PNGs.
import { chromium } from "@playwright/test";
import { ProxyAgent, fetch } from "undici";
const OUT = process.argv[2];
const url = process.argv[3] ?? "http://localhost:3210";
const shots = JSON.parse(process.argv[4]);
const agent = new ProxyAgent(process.env.HTTPS_PROXY);
const env = { ...process.env };
for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]) delete env[k];
const browser = await chromium.launch({ env, args: ["--no-proxy-server"] });
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.vp ?? { width: 1440, height: 900 }, colorScheme: s.theme ?? "light", reducedMotion: "reduce" });
  await page.route(/^https:\/\/(cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net|i\.pinimg\.com)\//, async (route) => {
    try {
      const r = await fetch(route.request().url(), { dispatcher: agent });
      await route.fulfill({ status: r.status, contentType: r.headers.get("content-type") ?? "image/jpeg", body: Buffer.from(await r.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  await page.goto(url + s.path, { waitUntil: "load", timeout: 90000 });
  if (s.sel) await page.locator(s.sel).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
  if (s.click) await page.locator(s.click).first().click();
  if (s.focus) await page.locator(s.focus).first().focus();
  await page.waitForTimeout(s.wait ?? 2500);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: !!s.full });
  await page.close();
}
await browser.close();

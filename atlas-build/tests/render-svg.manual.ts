// Manual smoke test for lib/render-svg.ts (not part of vitest): npx tsx tests/render-svg.manual.ts
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderMotifs } from "../lib/render-svg.ts";

const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="0" y="40" width="120" height="20" style="fill:var(--motif-1, currentColor)"/><path d="M0 100 L60 70 L120 100" fill="none" stroke="currentColor" stroke-width="6"/></svg>`;
const hard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="0" y="40" width="120" height="20" fill="#b91c1c"/></svg>`;
const empty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"></svg>`;
const res = await renderMotifs([{ id: "good", svg: good }, { id: "hard", svg: hard }, { id: "empty", svg: empty }], join(tmpdir(), "atlas-render-test"));
console.log(JSON.stringify(res, null, 1));

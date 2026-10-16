/**
 * Rebuilds the data line of picker.html from candidates.json, picks.default.json, picks.json (the
 * owner's saved picks, checked on open), the genres in genres.mjs and the style names in
 * lib/styles/styles.json (the "By style" filter). The page stays one file you
 * open by double click (no fetch from file://), so its data is embedded.
 *
 *   node bench/taste/build-picker.mjs
 *
 * Run it after appending candidates (with `genre` set) or changing the defaults or genres.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENRES, genreOf } from "./genres.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));

const candidates = read("candidates.json").candidates;
const ids = new Set();
for (const c of candidates) {
  if (ids.has(c.id)) throw new Error(`candidate id used twice: ${c.id}`);
  ids.add(c.id);
  if (c.genre !== undefined && genreOf(c) !== c.genre) throw new Error(`${c.id}: unknown genre ${c.genre} (add it to genres.mjs)`);
}
const defaults = read("picks.default.json").picks.map((p) => p.id).filter((id) => ids.has(id));
const saved = existsSync(join(dir, "picks.json")) ? read("picks.json").picks.map((p) => p.id).filter((id) => ids.has(id)) : [];

// Style ids and names for the "By style" filter (docs/styles, mirrored in lib/styles/styles.json).
const styleData = JSON.parse(readFileSync(join(dir, "..", "..", "lib", "styles", "styles.json"), "utf8"));
const styles = styleData.styles.map((s) => ({ id: s.id, name: s.name }));
const known = new Set(styles.map((s) => s.id));
for (const c of candidates) for (const id of c.styles ?? []) if (!known.has(id)) throw new Error(`${c.id}: unknown style ${id}`);
const data = `const DATA = ${JSON.stringify({ genres: GENRES, candidates, defaults, saved, styles })};`;
const file = join(dir, "picker.html");
const html = readFileSync(file, "utf8");
const line = /^(?:const DATA = .*;|@@DATA@@)$/m;
if (!line.test(html)) throw new Error("picker.html has no DATA line");
writeFileSync(file, html.replace(line, () => data));
const per = GENRES.map((g) => `${g.label} ${candidates.filter((c) => genreOf(c) === g.id).length}`).join(", ");
const tagged = candidates.filter((c) => c.styles?.length).length;
console.log(`picker.html: ${candidates.length} candidates (${per}), ${defaults.length} defaults, ${saved.length} saved picks, ${tagged} with style tags`);

/**
 * W3C DTCG tokens.json, built in-process from the kit model.
 *
 * The design.md CLI cannot run on Workers and its library entry reads a YAML
 * file from disk at import time, so this mirrors `design.md export --format dtcg`
 * (v0.4.0). tests/export-cli.test.ts checks the two stay identical.
 * The only addition is `$extensions.sources`, so the source links travel with the tokens.
 */
import type { Dim, KitModel } from "./model";
import { scopeSentence } from "./scope";
import { hexToRgb } from "./util";

export const DTCG_SCHEMA_URL = "https://www.designtokens.org/schemas/2025.10/format.json";

const round = (n: number) => Math.round(n * 1000) / 1000;
const dim = (d: Dim) => ({ value: d.value, unit: d.unit });

/** The part of tokens.json that the design.md CLI also emits. */
export function dtcgCore(model: KitModel): Record<string, unknown> {
  const file: Record<string, unknown> = { $schema: DTCG_SCHEMA_URL };
  file.$description = model.description || model.title;

  if (model.ship.length > 0) {
    const group: Record<string, unknown> = { $type: "color" };
    for (const c of model.ship) {
      const [r, g, b] = hexToRgb(c.hex);
      group[c.name] = { $value: { colorSpace: "srgb", components: [round(r / 255), round(g / 255), round(b / 255)], hex: c.hex } };
    }
    file.color = group;
  }
  const dims = (entries: [string, Dim][]) => {
    const group: Record<string, unknown> = { $type: "dimension" };
    for (const [k, d] of entries) group[k] = { $value: dim(d) };
    return group;
  };
  if (model.spacing.length > 0) file.spacing = dims(model.spacing);
  if (model.rounded.length > 0) file.rounded = dims(model.rounded);
  if (model.typography.length > 0) {
    const group: Record<string, unknown> = {};
    for (const t of model.typography) {
      const v: Record<string, unknown> = { fontFamily: t.fontFamily, fontSize: dim(t.fontSize), fontWeight: t.fontWeight };
      if (t.letterSpacing) v.letterSpacing = dim(t.letterSpacing);
      v.lineHeight = t.lineHeight;
      group[t.name] = { $type: "typography", $value: v };
    }
    file.typography = group;
  }
  return file;
}

export function tokensJson(model: KitModel): string {
  const file = dtcgCore(model);
  file.$extensions = {
    scope: {
      scope: model.scope,
      note: scopeSentence(model),
      pages: model.pages,
      appliesTo: model.globs,
      wrapper: model.scope === "page" ? `[data-wild-page="${model.slug}"]` : null,
      platform: model.platform.id,
      ...(model.platform.fluid ? { fluidType: model.platform.fluid } : {}),
    },
    sources: model.references.map((r) => ({ n: r.n, title: r.title, site: r.site, url: r.url })),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

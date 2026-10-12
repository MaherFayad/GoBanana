import { stringify } from "yaml";
import type { ComponentToken, KitModel } from "./model";
import { colorByName, dimText } from "./model";
import { globsText, pagesText, scopeBlock } from "./scope";
import { mdAutolink, mdText, ratioText, wildnessLabel } from "./util";

/** Front matter object in the shape the design.md CLI reads. Only ship colors. */
export function designMdFrontMatter(model: KitModel): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    version: "alpha",
    name: model.title,
    description: model.description,
  };
  if (model.ship.length > 0) fm.colors = Object.fromEntries(model.ship.map((c) => [c.name, c.hex]));
  fm.typography = Object.fromEntries(
    model.typography.map((t) => {
      const v: Record<string, string | number> = {
        fontFamily: t.fontFamily,
        fontSize: dimText(t.fontSize),
        fontWeight: t.fontWeight,
        // Quoted on purpose: design.md 0.4.0 drops a bare YAML number here on export.
        lineHeight: String(t.lineHeight),
      };
      if (t.letterSpacing) v.letterSpacing = dimText(t.letterSpacing);
      return [t.name, v];
    }),
  );
  fm.rounded = Object.fromEntries(model.rounded.map(([k, d]) => [k, dimText(d)]));
  fm.spacing = Object.fromEntries(model.spacing.map(([k, d]) => [k, dimText(d)]));
  if (model.components.length > 0) {
    fm.components = Object.fromEntries(
      model.components.map((c) => {
        const v: Record<string, string> = {};
        if (c.backgroundColor) v.backgroundColor = `{colors.${c.backgroundColor}}`;
        if (c.textColor) v.textColor = `{colors.${c.textColor}}`;
        if (c.typography) v.typography = `{typography.${c.typography}}`;
        if (c.rounded) v.rounded = `{rounded.${c.rounded}}`;
        if (c.padding) v.padding = dimText(c.padding);
        return [c.name, v];
      }),
    );
  }
  return fm;
}

function list(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

function overview(m: KitModel): string {
  const out: string[] = [];
  // Page scope: the scope lines open the Overview (inside a section, so design.md lint stays clean).
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(scope.join("\n"));
  out.push(
    `${mdText(m.title)} is a moodboard built for this brief: ${m.brief ? `"${mdText(m.brief, 500)}"` : "no brief was given"}. ` +
      `Wildness was set to ${wildnessLabel(m.wildness)}${m.lens ? ` with the ${mdText(m.lens)} culture lens` : ""}. ` +
      (m.scope === "page"
        ? `This file turns the board into page level tokens and rules for ${pagesText(m.pages, m.brief)} only, on ${m.platform.label.toLowerCase()}. The rest of the product keeps its own design system.`
        : `This file turns the board into tokens and rules a coding agent can follow, for ${m.platform.label.toLowerCase()}.`),
  );
  const kept = m.directions.filter((d) => d.status === "kept");
  const unrated = m.directions.filter((d) => d.status === "unrated");
  const dropped = m.directions.filter((d) => d.status === "dropped");
  if (kept.length > 0) {
    out.push(
      `Directions kept on the board:\n\n${list(
        kept.map((d) => `**${mdText(d.direction.title)}** (${mdText(d.direction.move)}): ${d.referenceCount} reference${d.referenceCount === 1 ? "" : "s"}.`),
      )}`,
    );
  }
  if (unrated.length > 0) {
    out.push(`Directions not rated yet: ${unrated.map((d) => mdText(d.direction.title)).join("; ")}.`);
  }
  if (dropped.length > 0) {
    out.push(`Directions dropped: ${dropped.map((d) => mdText(d.direction.title)).join("; ")}.`);
  }
  const sites = [...new Set(m.references.map((r) => r.site))];
  out.push(
    m.references.length > 0
      ? `The board holds ${m.references.length} reference${m.references.length === 1 ? "" : "s"} from ${sites.map((s) => mdText(s)).join(", ")}. Each one is listed with its source link under Sources at the end of this file. Reference images belong to their owners: use them for mood, never copy them into the product.`
      : "The board has no references yet.",
  );
  if (m.notes.length > 0) {
    out.push(
      `Notes from the board:\n\n${list(
        m.notes.map((n) => `${mdText(n.text, 600)}${n.referenceN ? ` (on reference ${n.referenceN})` : n.sectionTitle ? ` (in ${mdText(n.sectionTitle)})` : ""}`),
      )}`,
    );
  }
  return out.join("\n\n");
}

function colors(m: KitModel): string {
  const out: string[] = [];
  if (m.ship.length === 0) {
    out.push("No colors are tagged ship yet, so the front matter has no color tokens. Run a palette on the board and tag a swatch ship once it passes contrast.");
  } else if (m.colorsFrom === "fallback") {
    out.push(
      "The images on this board could not be read for color (host or format), so these two neutrals are placeholders that pass 4.5:1. Run reconcile_direction once the direction has JPEG or PNG images from allowed hosts, then export again.",
    );
  } else {
    out.push(
      m.scope === "page"
        ? "These colors are tagged ship. They passed the WCAG 2.2 contrast checks on the board. Use them only on the pages this file applies to, as overrides on top of the project's own colors."
        : "These colors are tagged ship. They passed the WCAG 2.2 contrast checks on the board and are the only colors for production.",
    );
    if (m.colorsFrom === "board") {
      out.push(
        `They come from this direction's own placed images (reconcile_direction), with images rated great counted more. A pair is ship at 4.5:1 for text, or at 3:1 for UI parts, large text and icons only.${m.mood ? ` Board mood: ${mdText(m.mood, 300)}` : ""}`,
      );
    }
    out.push(
      list(
        m.ship.map((c) => {
          const parts = [`**${c.name} (${c.hex}):**`];
          if (c.oklch) parts.push(`${mdText(c.oklch)}.`);
          if (c.canvasRole) parts.push(`Called "${mdText(c.canvasRole)}" on the board.`);
          parts.push(
            c.from === "contrast"
              ? "Text color from a passing contrast check."
              : c.from === "swatch"
                ? "From a swatch on the board."
                : c.from === "fallback"
                  ? "Neutral placeholder."
                  : m.colorsFrom === "board"
                    ? "From this direction's images on the board."
                    : "From the extracted palette.",
          );
          return parts.join(" ");
        }),
      ),
    );
  }
  const checks = m.contrast.slice(0, 16);
  if (checks.length > 0) {
    out.push(
      `Contrast checks from the board (text needs 4.5:1, UI parts need 3:1):\n\n${list(
        checks.map(
          (r) =>
            `${r.fg} on ${r.bg}: ${ratioText(r.ratio)}, ${r.passesText ? "passes text" : "fails text"}, ${r.passesUi ? "passes UI parts" : "fails UI parts"}. Tagged ${r.tag}.`,
        ),
      )}`,
    );
  }
  if (m.explore.length > 0) {
    out.push(
      `Concept only. These colors are tagged explore and are not tokens. Use them in mood boards and concept frames, never in production screens without a design review:\n\n${list(
        m.explore.map((c) => `${c.hex}${c.oklch ? ` (${mdText(c.oklch)})` : ""}${c.role ? `, ${mdText(c.role)}` : ""}: concept only.`),
      )}`,
    );
  } else {
    out.push("There are no explore colors on this board.");
  }
  return out.join("\n\n");
}

function typography(m: KitModel): string {
  const p = m.pairing;
  const out: string[] = [];
  out.push(
    `${p.display.family} for display and ${p.body.family} for body (${p.licence}, from Google Fonts). ` +
      pairingSource(m) +
      ` Mood: ${p.mood.join(", ")}. Load it from ${mdAutolink(p.url)}.`,
  );
  out.push(`Named fonts for this direction (${m.fonts.voice.replace(/-/g, " ")} type voice), so the build never falls back to a system default:\n\n${fontsList(m)}`);
  out.push(
    list(
      m.typography.map(
        (t) =>
          `**${t.name}:** ${t.fontFamily}, ${dimText(t.fontSize)}, weight ${t.fontWeight}, line height ${t.lineHeight}${t.letterSpacing ? `, letter spacing ${dimText(t.letterSpacing)}` : ""}. ${t.use}.`,
      ),
    ),
  );
  if (m.arabic) {
    out.push(
      'This pairing supports Arabic. Set `dir="rtl"` and `lang="ar"` on Arabic pages, and use logical CSS properties (margin-inline-start, not margin-left) so layouts mirror. Never add letter spacing to Arabic text: it breaks the joins between letters. Arabic needs taller lines, so these tokens use a larger line height than a Latin-only system would.',
    );
  } else {
    out.push(`Fallback stacks: ${p.display.family}, ${p.display.fallback} and ${p.body.family}, ${p.body.fallback}. Keep body text at ${m.platform.type.body}px or larger.`);
  }
  if (m.platform.fluid) {
    out.push(`On the web, set display to \`${m.platform.fluid.display}\` and headline to \`${m.platform.fluid.headline}\`; the px tokens above are the largest size.`);
  }
  return out.join("\n\n");
}

/** The four named Google Fonts of the direction's type voice, as a list. */
export function fontsList(m: KitModel): string {
  const f = m.fonts;
  const line = (label: string, x: { family: string; weight: number; fallback: string }) => `**${label}:** ${x.family}, weight ${x.weight} (fallback ${x.fallback}).`;
  return list([
    line("Latin display", f.latinDisplay),
    line("Latin body", f.latinBody),
    line("Arabic display", f.arabicDisplay),
    line("Arabic body", f.arabicBody),
    `All four from Google Fonts in one link: ${mdAutolink(m.fontsUrl)}. Do not swap in Inter, Roboto or Arial.`,
  ]);
}

export function pairingSource(m: KitModel): string {
  if (m.pairingFrom === "canvas") return "This pairing was picked on the board.";
  const voice = m.focus.find((d) => d.detail?.spec)?.detail?.spec?.typeVoice;
  if (m.pairingFrom === "voice" && voice) return `Picked for the direction's ${voice.replace(/-/g, " ")} type voice.`;
  return "No type sample was on the board, so this is the default pairing.";
}

function layout(m: KitModel): string {
  const out: string[] = [];
  out.push(`${m.platform.label}. ${m.platform.layout}`);
  out.push(`Spacing uses a 4px base: ${m.spacing.map(([k, d]) => `${k} ${dimText(d)}`).join(", ")}. Use md inside a block, lg between blocks and xl between page sections. Targets: ${m.platform.targets}.`);
  const sectionCount = m.sections.length;
  if (sectionCount > 0) {
    out.push(
      `The board is split into ${sectionCount} section${sectionCount === 1 ? "" : "s"} (${m.sections.map((s) => mdText(s.title)).join("; ")}). Mirror that grouping in the UI: one idea per block, with clear gaps between groups.`,
    );
  }
  out.push(
    m.wildness >= 4
      ? `Wildness is ${wildnessLabel(m.wildness)}, so the references break the grid on purpose. Keep that energy in hero areas and marketing moments, and keep forms, tables and checkout steps on the regular grid (${m.platform.columns}) so tasks stay easy.`
      : `Wildness is ${wildnessLabel(m.wildness)}. Keep the regular grid (${m.platform.columns}) and let one bold element per screen carry the direction.`,
  );
  return out.join("\n\n");
}

function elevation(m: KitModel): string {
  const surfaces = m.ship.filter((c) => /(surface|neutral|background|paper|base|canvas)/.test(c.name));
  const first =
    surfaces.length > 0
      ? `Show depth with flat color layers rather than heavy shadows: ${surfaces.map((c) => `${c.name} (${c.hex})`).join(" and ")} for cards and panels, with the stronger colors on top for actions.`
      : "Show depth with flat color layers rather than heavy shadows, with the stronger colors on top for actions.";
  return `${first} Use a soft shadow only for things that float, such as menus and dialogs. Never use a shadow alone to show focus or state: pair it with an outline or a text label (WCAG SC 2.4.7 and SC 1.4.1).`;
}

function shapes(m: KitModel): string {
  const r = Object.fromEntries(m.rounded.map(([k, d]) => [k, dimText(d)]));
  return list([
    `**none (${r.none}):** full-bleed images, tables and dividers.`,
    `**sm (${r.sm}):** inputs and small controls.`,
    `**md (${r.md}):** buttons.`,
    `**lg (${r.lg}):** cards and panels.`,
    `**full (${r.full}):** chips, tags and avatars.`,
  ]);
}

function componentLine(m: KitModel, c: ComponentToken): string {
  const bits: string[] = [];
  const bg = colorByName(m, c.backgroundColor);
  const fg = colorByName(m, c.textColor);
  if (bg) bits.push(`background ${bg.name} (${bg.hex})`);
  if (fg) bits.push(`text ${fg.name} (${fg.hex})`);
  if (c.ratio) bits.push(`contrast ${ratioText(c.ratio)}`);
  if (c.typography) bits.push(`${c.typography} type`);
  if (c.rounded) bits.push(`${c.rounded} corners`);
  if (c.padding) bits.push(`${dimText(c.padding)} padding`);
  return `**${c.name}:** ${bits.join(", ")}. ${c.use}.`;
}

function components(m: KitModel): string {
  const out: string[] = [];
  if (m.components.length > 0) out.push(list(m.components.map((c) => componentLine(m, c))));
  else out.push("No components yet, because no colors are tagged ship.");
  out.push(
    "Every interactive part needs a visible focus outline with at least 3:1 contrast against its background (SC 2.4.7 and SC 1.4.11) and a target of at least 24 by 24 px (SC 2.5.8). Show state with text or an icon as well as color (SC 1.4.1).",
  );
  return out.join("\n\n");
}

function dosAndDonts(m: KitModel): string {
  const dos: string[] =
    m.scope === "page"
      ? [
          `Do use these tokens only on ${pagesText(m.pages, m.brief)} (${globsText(m.globs)}), as page level overrides on top of the project's design system.`,
          "Do keep using the project's own components and tokens everywhere else, and its existing DESIGN.md for anything this file does not cover.",
        ]
      : ["Do use only the tokens in the front matter for production screens."];
  dos.push("Do keep text at 4.5:1 contrast or more and UI parts at 3:1 or more.");
  const kept = m.scope === "page" ? m.focus : m.directions.filter((d) => d.kept);
  if (kept.length > 0) {
    dos.push(
      m.scope === "page"
        ? `Do carry ${kept.length === 1 ? "this direction" : "these directions"} into these pages only: ${kept.map((d) => mdText(d.direction.title)).join("; ")}.`
        : `Do carry the kept direction${kept.length === 1 ? "" : "s"} into key screens: ${kept.map((d) => mdText(d.direction.title)).join("; ")}.`,
    );
  }
  dos.push(`Do load ${m.pairing.display.family} and ${m.pairing.body.family} from Google Fonts under their open licence.`);
  const donts: string[] = [];
  if (m.explore.length > 0) donts.push(`Don't use the explore colors (${m.explore.map((c) => c.hex).join(", ")}) in production without a design review.`);
  for (const c of m.components) if (!c.textColor) donts.push(`Don't put text on ${c.name}: it is a fill only.`);
  donts.push("Don't copy reference images into the product or the repo. Link to the source instead.");
  if (m.scope === "page") donts.push("Don't add these tokens to the global theme or change shared components for every page; add a local variant instead.");
  const dropped = m.directions.filter((d) => d.status === "dropped");
  if (dropped.length > 0) donts.push(`Don't drift back to directions that were dropped: ${dropped.map((d) => mdText(d.direction.title)).join("; ")}.`);
  return list([...dos, ...donts]);
}

export function sourcesMarkdown(m: KitModel, withIntro = true): string {
  if (m.references.length === 0) return "No references on the board.";
  const intro = withIntro ? "Reference images belong to their owners. Only links are kept here.\n\n" : "";
  const lines = m.references.map((r) => {
    const link = r.url ? mdAutolink(r.url) : `source link not usable (${mdText(r.rawUrl) || "missing"})`;
    return `${r.n}. ${mdText(r.title)} (${mdText(r.site)}): ${link}`;
  });
  return `${intro}${lines.join("\n")}`;
}

export function designMd(model: KitModel): string {
  const fm = stringify(designMdFrontMatter(model), { lineWidth: 0 }).trimEnd();
  const sections: [string, string][] = [
    ["Overview", overview(model)],
    ["Colors", colors(model)],
    ["Typography", typography(model)],
    ["Layout", layout(model)],
    ["Elevation & Depth", elevation(model)],
    ["Shapes", shapes(model)],
    ["Components", components(model)],
    ["Do's and Don'ts", dosAndDonts(model)],
    ["Sources", sourcesMarkdown(model)],
  ];
  return `---\n${fm}\n---\n\n${sections.map(([h, body]) => `## ${h}\n\n${body}`).join("\n\n")}\n`;
}

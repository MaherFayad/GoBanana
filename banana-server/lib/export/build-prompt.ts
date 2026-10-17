/** BUILD-PROMPT.md: a ready to paste prompt for Claude Code, Cursor, v0 or Lovable. */
import type { KitModel } from "./model";
import { directionRefs } from "./model";
import { globsText, pagesText, scopeBlock } from "./scope";
import { SPEC_AXES, bullets, mechanicLine, exploreLine, fontsLine, kitTitle, refLine, shipLine, typeScaleText } from "./scoped";
import { STITCH_MD_FILE, stitchSection } from "./stitch-md";
import { mdAutolink, mdText } from "./util";

export function buildPromptMd(m: KitModel): string {
  const out: string[] = [`# Build prompt: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  out.push("## Before any code", "");
  if (m.stitches.length > 0) {
    out.push(
      `1. Call get_snapshot on each Frankenstein page and look at it: ${m.stitches.map((st) => `"${mdText(st.title, 120)}" (${st.id})`).join(", ")}.`,
      `2. Read the part notes under Frankenstein pages below (colors, type scale, density, RTL, and the source image with its crop) and \`${m.dir}/${STITCH_MD_FILE}\`.`,
      "3. Compare the page you are about to build with the snapshot and the board's colors. Build only once they match.",
      "",
    );
  } else {
    out.push(
      `1. Open the board${m.webUrl ? ` (${mdAutolink(m.webUrl)})` : ""} and look at this direction's references before writing code.`,
      "2. Use the ship colors and named fonts below, not defaults.",
      "",
    );
  }
  out.push("Paste everything from Before any code down into Claude Code, Cursor, v0 or Lovable. It builds only the pages named in it.", "");

  out.push("## Prompt", "");
  // Look first (get_snapshot is a parts view: each part's source image with its crop rect, never a rendered PNG).
  out.push(
    `Step 1, look: before you write any screen, call the GoBanana get_snapshot tool for the board (its canvasId is in the board link${m.webUrl ? ` ${m.webUrl}` : ""})${m.stitches.length > 0 ? ` and for each Frankenstein page (stitchId ${m.stitches.map((s) => `\`${s.id}\``).join(", ")})` : ""}. Look at every image and build each row from what you see, not from titles. If you cannot see images, say so and ask.`,
    "",
  );
  const where = pagesText(m.pages, m.brief);
  if (m.scope === "page") {
    out.push(
      `Build one wild page for an existing product. Build exactly these pages and nothing else: ${where} (${globsText(m.globs)}). Platform: ${m.platform.label}.`,
      "",
      `Keep the project's own design system, components and DESIGN.md for everything that is not on these pages. Put the new tokens in a wrapper scoped to these pages (\`data-wild-page="${m.slug}"\`, variables from \`${m.dir}/kit/theme.css\`), never in the global theme. Do not change shared components; add a local variant when one needs a new look.`,
      "",
    );
  } else {
    out.push(`Build ${where} on ${m.platform.label} with the design system in DESIGN.md. Use only its tokens.`, "");
  }
  if (m.brief) out.push(`Brief: "${mdText(m.brief, 500)}".`, "");

  out.push("### Direction", "");
  if (m.focus.length > 1) out.push(`There are ${m.focus.length} directions. Build each as its own variant of the page, behind its own route or flag, so they can be compared.`, "");
  if (m.focus.length === 0) out.push("No bend directions were run. Take the mood from the references below.", "");
  for (const d of m.focus) {
    out.push(`**${mdText(d.direction.title)}**${d.detail?.twist ? `: ${mdText(d.detail.twist, 300)}` : ""}`, "");
    if (d.detail?.mechanic) out.push(mechanicLine(d.detail.mechanic), "");
    const spec = d.detail?.spec;
    if (spec) {
      const lines = SPEC_AXES.filter(([k]) => typeof spec[k] === "string" && spec[k]).map(([k, label]) => `${label}: ${mdText(spec[k] as string, 300)}`);
      if (spec.steal.length > 0) lines.push(`Steal: ${spec.steal.map((s) => mdText(s, 200)).join("; ")}.`);
      if (spec.avoid.length > 0) lines.push(`Avoid: ${spec.avoid.map((s) => mdText(s, 200)).join("; ")}.`);
      out.push(bullets(lines), "");
    } else {
      out.push(`No saved visual spec. Read \`${m.dir}/DIRECTION.md\` and the references, and keep the idea to one signature component.`, "");
    }
  }

  out.push(...stitchSection(m, "###", { parts: true }));
  out.push("### Platform constraints", "", bullets([`${m.platform.columns}, ${m.platform.margins}.`, `Targets: ${m.platform.targets}.`, ...m.platform.constraints]), "");
  out.push(
    "### Type and color",
    "",
    bullets([
      `Fonts: ${fontsLine(m)}. Load them with font-display swap.`,
      `Type scale: ${typeScaleText(m)}${m.platform.fluid ? `; on the web use display ${m.platform.fluid.display} and headline ${m.platform.fluid.headline}` : ""}.`,
      shipLine(m),
      exploreLine(m),
    ]),
    "",
  );
  out.push(
    "### Accessibility (WCAG 2.2 AA)",
    "",
    bullets([
      "Text contrast at least 4.5:1; large text, icons and control borders at least 3:1 (SC 1.4.3, 1.4.11).",
      "Visible focus on every control, never hidden under sticky bars (SC 2.4.7, 2.4.11).",
      `Targets: ${m.platform.targets} (SC 2.5.8 sets 24 by 24 CSS px as the floor).`,
      "Every input has a visible label; errors say what to fix in text, not only color (SC 1.4.1, 3.3.1, 3.3.2).",
      "Meaningful images have alt text; decorative textures and art have empty alt.",
      "Text still fits at 200% size, and web pages reflow at 320 CSS px with no sideways scroll (SC 1.4.4, 1.4.10).",
      "Drag interactions also work with a tap or click (SC 2.5.7).",
    ]),
    "",
  );
  out.push(
    "### Motion",
    "",
    bullets([
      ...m.focus.flatMap((d) => (d.detail?.spec?.motion ? [mdText(d.detail.spec.motion, 300)] : [])),
      "Respect prefers-reduced-motion: swap movement for a fade or no animation, and stop parallax and auto play.",
      "Nothing flashes more than three times a second; anything that moves for more than 5 seconds can be paused (SC 2.3.1, 2.2.2).",
    ]),
    "",
  );

  out.push("### References", "", "Do not copy, trace or embed the reference images. Use them for the what to steal notes and, on art references, the UI part each one becomes. Link the source when you mention one.", "");
  const listed = new Set<string>();
  for (const d of m.focus) {
    const { art, ui } = directionRefs(m, d.direction.id);
    for (const r of [...art, ...ui]) listed.add(r.id);
    if (art.length + ui.length === 0) continue;
    out.push(`${mdText(d.direction.title)}:`, "", [...art, ...ui].map(refLine).join("\n"), "");
  }
  const rest = m.focusRefs.filter((r) => !listed.has(r.id));
  if (rest.length > 0) out.push("Other references on the board:", "", rest.map(refLine).join("\n"), "");
  if (m.focusRefs.length === 0) out.push("No references on the board yet.", "");

  out.push(
    "### Done when",
    "",
    bullets([
      `The pages match the direction above and pass every item in \`${m.dir}/REVIEW.md\`.`,
      m.scope === "page"
        ? "`git diff --stat` shows only the page files, their scoped tokens and assets made for them. The global theme, shared components and DESIGN.md are unchanged."
        : "The build uses only the tokens in DESIGN.md.",
      "No reference image is in the repo.",
    ]),
    "",
  );
  return out.join("\n");
}

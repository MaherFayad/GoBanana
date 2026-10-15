/** REVIEW.md: a checklist to grade a built page (or its screenshot) against the direction spec. */
import type { KitModel } from "./model";
import { globsText, pagesText, scopeBlock } from "./scope";
import { SPEC_AXES, focusSources, kitTitle, typeScaleText } from "./scoped";
import { mdText } from "./util";

const item = (label: string, expect: string) => `- [ ] **${label}:** ${expect}${/[.!?:]$/.test(expect) ? "" : "."} Pass or fix:`;

export function reviewMd(m: KitModel): string {
  const out: string[] = [`# Review: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  out.push(
    `Build the page, take screenshots at ${m.platform.screenshots}, then go through every item. Mark each one pass, or fix with a short note. A page ships when every item passes.`,
    "",
  );

  out.push("## Direction", "");
  if (m.focus.length === 0) out.push(item("Mood", "The page carries the mood of the references without copying any of them."));
  for (const d of m.focus) {
    if (m.focus.length > 1) out.push(`### ${mdText(d.direction.title)}`, "");
    const spec = d.detail?.spec;
    if (!spec) {
      out.push(item("Idea", `The page reads as "${mdText(d.direction.title)}" at a glance.`));
      out.push(item("Signature", "One component carries the idea; the rest stays calm and usable."), "");
      continue;
    }
    for (const [k, label] of SPEC_AXES) {
      const v = spec[k];
      if (typeof v === "string" && v) out.push(item(label, mdText(v, 300)));
    }
    for (const s of spec.steal) out.push(item("Steal", `${mdText(s, 200)} shows up in the page.`));
    for (const a of spec.avoid) out.push(item("Avoid", `The page does not do this: ${mdText(a, 200)}`));
    out.push("");
  }
  out.push(item("Type", `${m.pairing.display.family} for display and ${m.pairing.body.family} for body; scale ${typeScaleText(m)}.`));
  out.push(
    item(
      "Color",
      m.ship.length > 0
        ? `Only ship colors (${m.ship.map((c) => c.hex).join(", ")}) and the project's own colors are used; no explore color.`
        : "Only the project's own colors are used; no explore color.",
    ),
    "",
  );

  out.push("## Platform", "", `${m.platform.label}.`, "");
  for (const c of m.platform.checks) out.push(item("Platform", c));
  out.push("");

  out.push("## Accessibility (WCAG 2.2 AA)", "");
  out.push(
    item("1.4.3 Contrast", "Body and label text reach 4.5:1; large text reaches 3:1."),
    item("1.4.11 Non-text contrast", "Icons, borders of inputs and buttons, and focus rings reach 3:1."),
    item("1.4.1 Use of color", "State and errors are shown with text or an icon as well as color."),
    item("2.4.7 and 2.4.11 Focus", "Every control shows a visible focus ring that is not hidden by sticky bars or sheets."),
    item("2.5.8 Target size", `${m.platform.targets}.`),
    item("1.4.4 and 1.4.10 Resize and reflow", "Text works at 200% size; web pages reflow at 320 CSS px with no sideways scroll."),
    item("1.1.1 Text alternatives", "Meaningful images have alt text; decorative art has empty alt."),
    item("3.3.2 Labels", "Every input has a visible label."),
    item("2.5.7 Dragging", "Anything you can drag also works with a tap or click."),
    item("2.3.1 and reduced motion", "Nothing flashes more than three times a second; with prefers-reduced-motion on, movement is replaced or removed."),
    "",
  );

  // Distance from slop (Atlas J8): features most default AI built pages share. Matching fewer
  // than 2 of them is the Bench target (docs/next-step-plan.md section 8).
  if (m.slop.length > 0) {
    out.push(
      "## Distance from slop",
      "",
      "Features most default pages share (Banana Atlas, J8). A page that matches 2 or more of them reads as a default page; change the ones it matches unless the direction asks for them.",
      "",
    );
    for (const r of m.slop) out.push(item(`Slop ${r.feature}`, `The page does not use ${mdText(r.value, 120)} (on ${Math.round(r.share * 100)}% of default pages)`));
    out.push("");
  }

  out.push("## Scope", "");
  if (m.scope === "page") {
    out.push(
      item("Files", `\`git diff --stat\` touches only ${pagesText(m.pages, m.brief)} (${globsText(m.globs)}), their scoped tokens and assets made for them.`),
      item("Design system", "The global theme, shared components and the project's DESIGN.md are unchanged."),
      item("Tokens", `New tokens live in a wrapper on these pages (\`data-wild-page="${m.slug}"\`), not in the global theme.`),
    );
  } else {
    out.push(item("Tokens", "The build uses only the tokens in DESIGN.md."));
  }
  out.push(item("References", "No reference image was copied, traced or embedded; sources are linked where they are mentioned."), "");

  out.push("## Grade", "", "Count the items that pass. Fix every fix item and review again; ship when all pass.", "");
  out.push("## Sources", "", focusSources(m), "");
  return out.join("\n");
}

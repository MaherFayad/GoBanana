/**
 * EXPERIMENT.md (VAL-12): two directions as feature-flagged variants of one page, with event
 * names and a short test plan. Variant A is the first kept direction; B is the second, or the
 * current page ("control") when only one direction is kept. Text only: no flag vendor is assumed.
 */
import type { DirectionSummary, KitModel } from "./model";
import { globsText, pagesText, scopeBlock } from "./scope";
import { bullets, focusSources, kitTitle } from "./scoped";
import { mdText } from "./util";

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "variant";

interface Variant {
  key: string;
  label: string;
  title: string;
  summary: string;
}

function variantOf(d: DirectionSummary, label: string): Variant {
  const spec = d.detail?.spec;
  return {
    key: slugOf(d.direction.title),
    label,
    title: mdText(d.direction.title),
    summary: mdText(spec?.signature || d.detail?.twist || d.direction.move, 240),
  };
}

export function experimentMd(m: KitModel): string {
  const dirs = m.focus.filter((d) => d.status !== "dropped");
  const page = pagesText(m.pages, m.brief);
  const out: string[] = [`# Experiment: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  if (dirs.length === 0) {
    out.push("No kept directions. Rate two directions keep with rate_directions, then export again.", "", "## Sources", "", focusSources(m));
    return out.join("\n");
  }
  const a = dirs[0]!;
  const b = dirs[1];
  const variants: Variant[] = b
    ? [variantOf(a, "A"), variantOf(b, "B")]
    : [{ key: "control", label: "A", title: "Control (the current page)", summary: "The page as it ships today." }, variantOf(a, "B")];
  const flag = `wild_${slugOf(m.slug)}`;
  const evt = (name: string) => `${flag}_${name}`;
  out.push(
    bullets([
      `Page: ${page}. Files: ${globsText(m.globs)}.`,
      `Platform: ${m.platform.label}.`,
      `Feature flag: \`${flag}\` with values ${variants.map((v) => `\`${v.key}\``).join(" and ")}. Default for everyone else: \`${variants[0]!.key}\`.`,
      ...(dirs.length > 2 ? [`${dirs.length - 2} more kept direction${dirs.length - 2 === 1 ? " is" : "s are"} left out. Drop them with rate_directions to choose which two run.`] : []),
    ]),
    "",
    "## Variants",
    "",
  );
  for (const v of variants) out.push(`### Variant ${v.label}: ${v.title}`, "", `Flag value: \`${v.key}\`. ${v.summary}`, "");
  out.push(
    "## Build it behind the flag",
    "",
    bullets([
      "Read the flag once on the server or at the top of the page. Render one variant; never ship both to the client.",
      `Build variant ${variants[1]!.label} from its folder (DIRECTION.md and BUILD-PROMPT.md). Scope its tokens to a wrapper on these pages (\`data-wild-page="${m.slug}"\`).`,
      "Keep the same content, prices and legal text in both variants. Only the look and the one working part change.",
      "Use your own flag tool or a plain config value. Assign a visitor once and keep it for the whole test.",
    ]),
    "",
    "## Events",
    "",
    "Send each event with the properties `variant` (flag value) and `page`.",
    "",
    bullets([
      `\`${evt("viewed")}\`: the page rendered. Fire once per visit.`,
      `\`${evt("engaged")}\`: the visitor used the working part (first tap, drag or focus on it).`,
      `\`${evt("converted")}\`: the main goal of this page was done (${mdText(m.brief || "the page's main action", 160)}).`,
      `\`${evt("abandoned")}\`: the visitor left without converting after engaging.`,
      `\`${evt("error")}\`: a failure the visitor saw. Property: \`reason\`.`,
    ]),
    "",
    "## Test plan",
    "",
    bullets([
      "Hypothesis: the variant lifts the main goal without hurting the guardrails below.",
      `Primary metric: \`${evt("converted")}\` divided by \`${evt("viewed")}\`, per variant.`,
      `Guardrails: error rate (\`${evt("error")}\`), page load time and the accessibility checks in REVIEW.md. Stop the test early if a guardrail gets clearly worse.`,
      "Split: 50 / 50, assigned once per visitor.",
      "Sample size: pick the smallest lift you care about, then size the test with your analytics tool. Do not stop at the first good looking day.",
      "Run at least two full weeks so weekdays and weekends both count.",
      "Decide before you start: ship the winner, ship neither, or iterate. A tie means ship the simpler page.",
    ]),
    "",
    "## Sources",
    "",
    focusSources(m),
  );
  return out.join("\n");
}

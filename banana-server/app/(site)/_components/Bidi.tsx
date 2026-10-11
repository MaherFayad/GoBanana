/**
 * Isolates Latin runs inside Arabic copy (lib/site/bidi.ts): each run becomes a <bdi dir="ltr"> (an
 * explicit direction: a run that opens with neutrals, like ~/.cursor, must not guess), so a
 * term like JSON, FigJam or the product name keeps sentence punctuation on the right side.
 * English text comes back unchanged.
 */
import { Fragment, type ReactNode } from "react";
import { splitLatinRuns } from "@/lib/site/bidi";
import { fmt } from "@/lib/site/i18n";

export function bidi(text: string): ReactNode {
  const parts = splitLatinRuns(text);
  if (parts.length === 1 && !parts[0]!.latin) return text;
  return parts.map((p, i) =>
    p.latin ? (
      <bdi key={i} dir="ltr">
        {p.text}
      </bdi>
    ) : (
      <Fragment key={i}>{p.text}</Fragment>
    ),
  );
}

/** fmt() then bidi(): fills {app} and {key} values, then isolates the Latin runs. */
export function bt(template: string, values?: Record<string, string | number>): ReactNode {
  return bidi(fmt(template, values));
}

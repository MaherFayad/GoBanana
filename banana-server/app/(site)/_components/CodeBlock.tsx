"use client";

/**
 * Code block in Studio's mono style with a copy button. Always left to right (dir="ltr"), also on
 * Arabic pages; the label above it follows the page language. A copy shows a "Copied" toast
 * (role="status"); a failed copy shows an error toast that stays until closed.
 *
 * Code never wraps mid-word: a long line scrolls sideways inside the block, which is a named,
 * focusable region so keyboard users can scroll it too (SC 2.1.1). The page itself never
 * scrolls sideways (SC 1.4.10).
 */
import { useId } from "react";
import { pushToast } from "@/components/studio/Toast";

export type CopyLabels = { done: string; doneBody: string; failed: string; failedBody: string };

type Props = {
  code: string;
  /** Visible label above the code ("Terminal", "~/.cursor/mcp.json"). */
  label: string;
  /** Language of the label (Arabic pages). Labels that are code, like a file path, leave it unset. */
  labelLang?: string;
  /** Verb plus noun: "Copy command". */
  copyLabel: string;
  labels: CopyLabels;
  testId?: string;
  /** "terminal": window dots and a $ prompt. "file": the label reads as an editor tab. */
  variant?: "terminal" | "file";
};

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard not available");
}

export function CodeBlock({ code, label, labelLang, copyLabel, labels, testId, variant }: Props) {
  const labelId = useId();

  async function copy() {
    try {
      await writeClipboard(code);
      pushToast({ kind: "success", title: labels.done, body: labels.doneBody, dedupeKey: "site-copy" });
    } catch {
      pushToast({ kind: "error", title: labels.failed, body: labels.failedBody, dedupeKey: "site-copy-failed" });
    }
  }

  return (
    <figure className="code-block" dir="ltr" data-testid={testId} data-variant={variant}>
      <div className="code-block-bar">
        {variant === "terminal" ? (
          <span className="code-block-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}
        <figcaption
          className="code-block-label"
          id={labelId}
          lang={labelLang ?? "en"}
          dir={labelLang === "ar" ? "rtl" : "ltr"}
          data-prose={labelLang ? "" : undefined}
        >
          {label}
        </figcaption>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-size="sm"
          lang={labelLang}
          aria-describedby={labelId}
          onClick={copy}
        >
          {copyLabel}
        </button>
      </div>
      <pre tabIndex={0} role="region" aria-labelledby={labelId}>
        {variant === "terminal" ? (
          <span className="code-prompt" aria-hidden="true">
            ${" "}
          </span>
        ) : null}
        <code translate="no">{code}</code>
      </pre>
    </figure>
  );
}

"use client";

/**
 * Code block in Studio's mono style with a copy button. Always left to right (dir="ltr"), also on
 * Arabic pages; the label above it follows the page language. A copy shows a "Copied" toast
 * (role="status"); a failed copy shows an error toast that stays until closed.
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
};

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard not available");
}

export function CodeBlock({ code, label, labelLang, copyLabel, labels, testId }: Props) {
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
    <figure className="code-block" dir="ltr" data-testid={testId}>
      <div className="code-block-bar">
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
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

"use client";

/**
 * The server address, front and center in the set-up section: a plug mark, the label, the URL in
 * a pill (left to right, wraps anywhere so a long host never scrolls the page) and a primary
 * copy button. A copy shows the shared "Copied" toast, announced by the toast region's
 * role="status" (aria-live polite); a failed copy shows an error toast (role="alert").
 */
import { useId } from "react";
import { CopyIcon, PlugIcon } from "@/components/studio/icons";
import { pushToast } from "@/components/studio/Toast";
import type { CopyLabels } from "./CodeBlock";

type Props = { url: string; label: string; hint: string; copyLabel: string; labels: CopyLabels; copyVariant?: "primary" | "secondary" };

export function ServerAddress({ url, label, hint, copyLabel, labels, copyVariant = "primary" }: Props) {
  const labelId = useId();

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard not available");
      await navigator.clipboard.writeText(url);
      pushToast({ kind: "success", title: labels.done, body: labels.doneBody, dedupeKey: "site-copy" });
    } catch {
      pushToast({ kind: "error", title: labels.failed, body: labels.failedBody, dedupeKey: "site-copy-failed" });
    }
  }

  return (
    <div className="server-address" data-testid="code-server-url">
      <span className="server-address-mark" aria-hidden="true">
        <PlugIcon size={24} />
      </span>
      <div className="server-address-text">
        <p className="server-address-label" id={labelId}>
          {label}
        </p>
        <p className="server-address-url">
          <code dir="ltr" translate="no">
            {url}
          </code>
        </p>
        <p className="server-address-hint">{hint}</p>
      </div>
      <button type="button" className="st-btn server-address-copy" data-variant={copyVariant} data-size="lg" aria-describedby={labelId} onClick={copy}>
        <CopyIcon size={16} />
        {copyLabel}
      </button>
    </div>
  );
}
